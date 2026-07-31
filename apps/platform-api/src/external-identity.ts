import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ActorAuthError, type ActorContext, digestSubject, hasExternalIdentityBindingReview,
  parseIfMatch, requestHash, structuredAuthError, validateIdempotencyKey, validateReason,
} from "@kvartal/auth";

type Json = Record<string, unknown>;
const pendingLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function send(response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

function fail(response: ServerResponse, actor: ActorContext, error: ActorAuthError) {
  send(response, error.status, structuredAuthError(error.code, error.message, actor.correlationId));
}

async function body(request: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Json : {};
}

function subjectPepper() {
  const value = process.env.EXTERNAL_IDENTITY_SUBJECT_DIGEST_PEPPER;
  if (!value && process.env.NODE_ENV === "production") throw new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "Subject digest configuration is missing.");
  return value ?? "local-test-only-subject-pepper";
}

function assertOwner(actor: ActorContext) {
  if (!hasExternalIdentityBindingReview(actor)) throw new ActorAuthError("FORBIDDEN", 403, "This action is not allowed.");
}

function cursor(value: string | null) {
  if (!value) return null;
  try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { at: string; id: string }; return { at: new Date(parsed.at), id: parsed.id }; }
  catch { return null; }
}

function nextCursor(item: { id: string; requestedAt?: Date; updatedAt?: Date } | undefined) {
  const at = item?.requestedAt ?? item?.updatedAt;
  return item && at ? Buffer.from(JSON.stringify({ at: at.toISOString(), id: item.id })).toString("base64url") : null;
}

function publicRequest(item: any) {
  return { ...item, requestedBySubject: item.requestedBySubject, subjectDigest: undefined, requestedBySubjectDigest: undefined };
}

async function expireExact(tx: any, requestId: string, now: Date) {
  const item = await tx.externalIdentityBindingRequest.findUnique({ where: { id: requestId } });
  if (item?.status === "PENDING" && item.expiresAt <= now) {
    const updated = await tx.externalIdentityBindingRequest.update({ where: { id: requestId }, data: { status: "EXPIRED", rowVersion: { increment: 1 } } });
    await tx.externalIdentityBindingEvent.create({ data: { requestId, eventType: "EXPIRED", actorType: "SYSTEM_SERVICE", previousStatus: "PENDING", nextStatus: "EXPIRED", reasonCode: "BINDING_REQUEST_EXPIRED" } });
    return updated;
  }
  return item;
}

async function expireBatch(prisma: PrismaClient, now: Date) {
  const rows = await prisma.externalIdentityBindingRequest.findMany({ where: { status: "PENDING", expiresAt: { lte: now } }, select: { id: true }, take: 100 });
  for (const row of rows) await prisma.$transaction((tx) => expireExact(tx, row.id, now));
}

function mutationHeaders(request: IncomingMessage) {
  const key = request.headers["idempotency-key"];
  const version = parseIfMatch(request.headers["if-match"]);
  if (!validateIdempotencyKey(key)) throw new ActorAuthError("IDEMPOTENCY_KEY_INVALID", 400, "A valid idempotency key is required.");
  if (version === null) throw new ActorAuthError("BINDING_VERSION_CONFLICT", 409, "The resource version is stale.");
  return { key, version };
}

async function mutate(input: {
  prisma: PrismaClient; actor: ActorContext; request: IncomingMessage; canonicalRoute: string; resourceId: string; body: Json;
  run: (tx: any, expectedVersion: number) => Promise<{ status?: number; payload: Json; version: number }>;
}) {
  const { key, version } = mutationHeaders(input.request);
  const hash = requestHash(input.body);
  const scope = `${input.actor.appUserId}:${input.request.method}:${input.canonicalRoute}:${input.resourceId}:${key}`;
  return input.prisma.$transaction(async (tx) => {
    const existing = await tx.mutationIdempotency.findUnique({ where: { scope } });
    if (existing) {
      if (existing.requestHash !== hash) throw new ActorAuthError("IDEMPOTENCY_KEY_REUSED", 409, "The idempotency key was reused.");
      if (existing.status === "SUCCEEDED") return { status: existing.responseStatus ?? 200, payload: existing.responseBody as Json, version: Number((existing.responseHeaders as any)?.etag ?? version), replay: true };
      return { status: 202, payload: { ok: false, processing: true }, version, replay: true };
    }
    await tx.mutationIdempotency.create({ data: { scope, requestHash: hash, status: "IN_PROGRESS" } });
    const result = await input.run(tx, version);
    await tx.mutationIdempotency.update({ where: { scope }, data: { status: "SUCCEEDED", responseStatus: result.status ?? 200, responseBody: result.payload as Prisma.InputJsonValue, responseHeaders: { etag: result.version }, terminalAt: new Date() } });
    return { ...result, replay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function auditDenied(prisma: PrismaClient, actor: ActorContext, requestId?: string, identityId?: string) {
  await prisma.externalIdentityBindingEvent.create({ data: { requestId, externalIdentityId: identityId, eventType: "ACTION_DENIED", actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), reasonCode: "FORBIDDEN" } }).catch(() => undefined);
}

export async function handleExternalIdentityRoute(request: IncomingMessage, response: ServerResponse, url: URL, prisma: PrismaClient, actor: ActorContext) {
  if (!url.pathname.startsWith("/api/v1/platform/external-identit")) return false;
  try { assertOwner(actor); }
  catch (caught) { await auditDenied(prisma, actor); fail(response, actor, caught as ActorAuthError); return true; }
  const now = new Date();
  try {
    if (url.pathname === "/api/v1/platform/external-identity-candidates" && request.method === "GET") {
      const query = (url.searchParams.get("q") ?? "").trim();
      const items = await prisma.appUser.findMany({
        where: query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }] } : {},
        select: { id: true, email: true, displayName: true, active: true }, orderBy: { email: "asc" }, take: 50,
      });
      send(response, 200, { items, nextCursor: null }); return true;
    }
    if (url.pathname === "/api/v1/platform/external-identity-binding-requests" && request.method === "POST") {
      const value = await body(request);
      const reason = validateReason(value.reason);
      if (!reason || value.provider !== "FIREBASE" || !["BIND", "REACTIVATE"].includes(String(value.requestType))) throw new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 400, "The binding request is invalid.");
      let subject = String(value.subject ?? ""); let candidateAppUserId = typeof value.candidateAppUserId === "string" ? value.candidateAppUserId : null; let targetExternalIdentityId: string | null = null;
      if (value.requestType === "REACTIVATE") {
        targetExternalIdentityId = typeof value.targetExternalIdentityId === "string" ? value.targetExternalIdentityId : null;
        const identity = targetExternalIdentityId ? await prisma.appUserExternalIdentity.findUnique({ where: { id: targetExternalIdentityId } }) : null;
        if (!identity || identity.status !== "REVOKED") throw new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 409, "The recovery target is invalid.");
        subject = identity.subject; candidateAppUserId = identity.appUserId;
      } else if (!subject || await prisma.appUserExternalIdentity.findUnique({ where: { provider_subject: { provider: "FIREBASE", subject } } })) {
        throw new ActorAuthError("BINDING_SUBJECT_ALREADY_BOUND", 409, "This subject is already bound.");
      }
      const created = await prisma.$transaction(async (tx) => {
        const item = await tx.externalIdentityBindingRequest.create({ data: {
          requestType: value.requestType as "BIND" | "REACTIVATE", provider: "FIREBASE", subject, subjectDigest: digestSubject(subject, subjectPepper()),
          verifiedEmail: value.emailVerified === true && typeof value.verifiedEmail === "string" ? value.verifiedEmail.trim().toLowerCase() : null,
          emailVerified: value.emailVerified === true, candidateAppUserId, targetExternalIdentityId,
          requestedByProvider: "FIREBASE", requestedBySubject: actor.subject, requestedBySubjectDigest: digestSubject(actor.subject, subjectPepper()), requestedByAppUserId: actor.appUserId,
          reason, expiresAt: new Date(now.getTime() + pendingLifetimeMs),
        } });
        await tx.externalIdentityBindingEvent.create({ data: { requestId: item.id, eventType: value.requestType === "REACTIVATE" ? "REACTIVATION_REQUESTED" : "REQUESTED", actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), nextStatus: "PENDING", reasonCode: "REQUESTED" } });
        return item;
      });
      send(response, 201, publicRequest(created), { ETag: `"${created.rowVersion}"` }); return true;
    }

    if (url.pathname === "/api/v1/platform/external-identity-binding-requests" && request.method === "GET") {
      await expireBatch(prisma, now); const take = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100); const after = cursor(url.searchParams.get("cursor"));
      const items = await prisma.externalIdentityBindingRequest.findMany({ where: after ? { OR: [{ requestedAt: { lt: after.at } }, { requestedAt: after.at, id: { lt: after.id } }] } : {}, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], take: take + 1 });
      const more = items.length > take; const page = more ? items.slice(0, take) : items;
      send(response, 200, { items: page.map(publicRequest), nextCursor: more ? nextCursor(page.at(-1)) : null }); return true;
    }

    if (url.pathname === "/api/v1/platform/external-identities" && request.method === "GET") {
      const take = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100); const after = cursor(url.searchParams.get("cursor"));
      const items = await prisma.appUserExternalIdentity.findMany({ where: after ? { OR: [{ updatedAt: { lt: after.at } }, { updatedAt: after.at, id: { lt: after.id } }] } : {}, include: { appUser: { select: { id: true, email: true, displayName: true, active: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: take + 1 });
      const more = items.length > take; const page = more ? items.slice(0, take) : items;
      send(response, 200, { items: page, nextCursor: more ? nextCursor(page.at(-1)) : null }); return true;
    }

    const requestMatch = url.pathname.match(/^\/api\/v1\/platform\/external-identity-binding-requests\/([^/]+)(?:\/(events|select-candidate|create-candidate-user|approve|reject|cancel))?$/);
    if (requestMatch) {
      const id = decodeURIComponent(requestMatch[1]); const action = requestMatch[2];
      if (!action && request.method === "GET") { const item = await prisma.$transaction((tx) => expireExact(tx, id, now)); if (!item) throw new ActorAuthError("BINDING_REQUEST_NOT_FOUND", 404, "Binding request not found."); send(response, 200, publicRequest(item), { ETag: `"${item.rowVersion}"` }); return true; }
      if (action === "events" && request.method === "GET") { const items = await prisma.externalIdentityBindingEvent.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }); send(response, 200, { items, nextCursor: null }); return true; }
      if (request.method !== "POST" || !action) return false;
      const value = await body(request); const reason = validateReason(value.reason); if (!reason) throw new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 400, "A reason of 10–1000 characters is required.");
      const result = await mutate({ prisma, actor, request, canonicalRoute: `/external-identity-binding-requests/:id/${action}`, resourceId: id, body: value, run: async (tx, expectedVersion) => {
        await tx.$queryRawUnsafe(`SELECT id FROM "ExternalIdentityBindingRequest" WHERE id = $1 FOR UPDATE`, id);
        const item = await expireExact(tx, id, now); if (!item) throw new ActorAuthError("BINDING_REQUEST_NOT_FOUND", 404, "Binding request not found.");
        if (item.rowVersion !== expectedVersion) throw new ActorAuthError("BINDING_VERSION_CONFLICT", 409, "The resource version is stale.");
        if (item.status !== "PENDING") throw new ActorAuthError(item.status === "EXPIRED" ? "BINDING_REQUEST_EXPIRED" : "BINDING_ALREADY_FINAL", 409, "The request is already final.");
        if ((action === "approve" || action === "reject") && item.requestedByProvider === "FIREBASE" && item.requestedBySubject === actor.subject) throw new ActorAuthError("BINDING_SELF_APPROVAL_FORBIDDEN", 403, "A requester cannot review their own request.");
        if (action === "select-candidate") {
          const candidateId = typeof value.candidateAppUserId === "string" ? value.candidateAppUserId : ""; const candidate = await tx.appUser.findUnique({ where: { id: candidateId } }); if (!candidate?.active) throw new ActorAuthError("BINDING_CANDIDATE_REQUIRED", 409, "An active candidate is required.");
          const updated = await tx.externalIdentityBindingRequest.update({ where: { id }, data: { candidateAppUserId: candidateId, reason, rowVersion: { increment: 1 } } });
          await tx.externalIdentityBindingEvent.create({ data: { requestId: id, eventType: "CANDIDATE_SELECTED", actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), previousStatus: "PENDING", nextStatus: "PENDING", reasonCode: "CANDIDATE_SELECTED" } });
          return { payload: publicRequest(updated), version: updated.rowVersion };
        }
        if (action === "create-candidate-user") {
          const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""; const displayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
          if (!item.emailVerified || !item.verifiedEmail || email !== item.verifiedEmail.toLowerCase() || !displayName) throw new ActorAuthError("EMAIL_NOT_VERIFIED", 409, "The verified email does not match.");
          const user = await tx.appUser.create({ data: { firebaseUid: `legacy:external-pending:${randomUUID()}`, email, displayName, active: true } });
          const updated = await tx.externalIdentityBindingRequest.update({ where: { id }, data: { candidateAppUserId: user.id, reason, rowVersion: { increment: 1 } } });
          await tx.externalIdentityBindingEvent.createMany({ data: ["CANDIDATE_USER_CREATED", "CANDIDATE_SELECTED"].map((eventType) => ({ requestId: id, eventType, actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), previousStatus: "PENDING", nextStatus: "PENDING", reasonCode: eventType })) });
          return { status: 201, payload: { ...publicRequest(updated), candidateUser: { id: user.id, email: user.email, displayName: user.displayName } }, version: updated.rowVersion };
        }
        if (action === "approve") {
          if (!item.candidateAppUserId) throw new ActorAuthError("BINDING_CANDIDATE_REQUIRED", 409, "Select a candidate first.");
          const candidate = await tx.appUser.findUnique({ where: { id: item.candidateAppUserId } }); if (!candidate?.active) throw new ActorAuthError("BINDING_CANDIDATE_REQUIRED", 409, "The candidate is inactive.");
          let identity;
          if (item.requestType === "BIND") {
            const subjectExists = await tx.appUserExternalIdentity.findUnique({ where: { provider_subject: { provider: "FIREBASE", subject: item.subject } } }); if (subjectExists) throw new ActorAuthError("BINDING_SUBJECT_ALREADY_BOUND", 409, "This subject is already bound.");
            const active = await tx.appUserExternalIdentity.findFirst({ where: { appUserId: candidate.id, provider: "FIREBASE", status: "ACTIVE" } }); if (active) throw new ActorAuthError("BINDING_USER_ALREADY_BOUND", 409, "This user already has an active identity.");
            identity = await tx.appUserExternalIdentity.create({ data: { appUserId: candidate.id, provider: "FIREBASE", subject: item.subject, boundByUserId: actor.appUserId } });
          } else {
            const target = item.targetExternalIdentityId ? await tx.appUserExternalIdentity.findUnique({ where: { id: item.targetExternalIdentityId } }) : null;
            if (!target || target.status !== "REVOKED" || target.appUserId !== candidate.id || target.subject !== item.subject) throw new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 409, "The recovery target is invalid.");
            identity = await tx.appUserExternalIdentity.update({ where: { id: target.id }, data: { status: "ACTIVE", reactivatedAt: now, reactivatedByUserId: actor.appUserId, revokedAt: null, revokedByUserId: null, revocationReason: null, rowVersion: { increment: 1 } } });
          }
          const updated = await tx.externalIdentityBindingRequest.update({ where: { id }, data: { status: "APPROVED", reviewedByUserId: actor.appUserId, reviewedBySubject: actor.subject, reviewedAt: now, reason, rowVersion: { increment: 1 } } });
          await tx.externalIdentityBindingEvent.create({ data: { requestId: id, externalIdentityId: identity.id, eventType: item.requestType === "BIND" ? "APPROVED" : "IDENTITY_REACTIVATED", actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), previousStatus: "PENDING", nextStatus: "APPROVED", reasonCode: "APPROVED" } });
          return { payload: { request: publicRequest(updated), identity }, version: updated.rowVersion };
        }
        const status = action === "reject" ? "REJECTED" : action === "cancel" ? "CANCELLED" : null; if (!status) throw new ActorAuthError("FORBIDDEN", 405, "Unsupported mutation.");
        const updated = await tx.externalIdentityBindingRequest.update({ where: { id }, data: { status, reviewedByUserId: actor.appUserId, reviewedBySubject: actor.subject, reviewedAt: now, reason, rowVersion: { increment: 1 } } });
        await tx.externalIdentityBindingEvent.create({ data: { requestId: id, eventType: status, actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), previousStatus: "PENDING", nextStatus: status, reasonCode: status } });
        return { payload: publicRequest(updated), version: updated.rowVersion };
      } });
      send(response, result.status ?? 200, result.payload, { ETag: `"${result.version}"`, ...(result.replay ? { "Idempotency-Replayed": "true" } : {}) }); return true;
    }

    const identityMatch = url.pathname.match(/^\/api\/v1\/platform\/external-identities\/([^/]+)(?:\/(events|revoke|reactivation-request))?$/);
    if (identityMatch) {
      const id = decodeURIComponent(identityMatch[1]); const action = identityMatch[2];
      if (!action && request.method === "GET") { const item = await prisma.appUserExternalIdentity.findUnique({ where: { id }, include: { appUser: { select: { id: true, email: true, displayName: true, active: true } } } }); if (!item) throw new ActorAuthError("EXTERNAL_IDENTITY_NOT_FOUND", 404, "External identity not found."); send(response, 200, item, { ETag: `"${item.rowVersion}"` }); return true; }
      if (action === "events" && request.method === "GET") { const items = await prisma.externalIdentityBindingEvent.findMany({ where: { externalIdentityId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }); send(response, 200, { items, nextCursor: null }); return true; }
      if (request.method !== "POST" || !action) return false;
      const value = await body(request); const reason = validateReason(value.reason); if (!reason) throw new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 400, "A reason of 10–1000 characters is required.");
      const result = await mutate({ prisma, actor, request, canonicalRoute: `/external-identities/:id/${action}`, resourceId: id, body: value, run: async (tx, expectedVersion) => {
        await tx.$queryRawUnsafe(`SELECT id FROM "AppUserExternalIdentity" WHERE id = $1 FOR UPDATE`, id);
        const identity = await tx.appUserExternalIdentity.findUnique({ where: { id } }); if (!identity) throw new ActorAuthError("EXTERNAL_IDENTITY_NOT_FOUND", 404, "External identity not found.");
        if (identity.rowVersion !== expectedVersion) throw new ActorAuthError("BINDING_VERSION_CONFLICT", 409, "The resource version is stale.");
        if (action === "revoke") {
          if (identity.status !== "ACTIVE") throw new ActorAuthError("BINDING_ALREADY_FINAL", 409, "The identity is already revoked.");
          const updated = await tx.appUserExternalIdentity.update({ where: { id }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.appUserId, revocationReason: reason, rowVersion: { increment: 1 } } });
          await tx.externalIdentityBindingEvent.create({ data: { externalIdentityId: id, eventType: "IDENTITY_REVOKED", actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), previousStatus: "ACTIVE", nextStatus: "REVOKED", reasonCode: "IDENTITY_REVOKED" } });
          return { payload: updated, version: updated.rowVersion };
        }
        if (identity.status !== "REVOKED") throw new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 409, "Only a revoked identity can be reactivated.");
        const created = await tx.externalIdentityBindingRequest.create({ data: { requestType: "REACTIVATE", provider: identity.provider, subject: identity.subject, subjectDigest: digestSubject(identity.subject, subjectPepper()), candidateAppUserId: identity.appUserId, targetExternalIdentityId: identity.id, requestedByProvider: "FIREBASE", requestedBySubject: actor.subject, requestedBySubjectDigest: digestSubject(actor.subject, subjectPepper()), requestedByAppUserId: actor.appUserId, reason, expiresAt: new Date(now.getTime() + pendingLifetimeMs) } });
        await tx.externalIdentityBindingEvent.create({ data: { requestId: created.id, externalIdentityId: id, eventType: "REACTIVATION_REQUESTED", actorType: "USER", actorAppUserId: actor.appUserId, actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(actor.subject, subjectPepper()), nextStatus: "PENDING", reasonCode: "REACTIVATION_REQUESTED" } });
        return { status: 201, payload: publicRequest(created), version: created.rowVersion };
      } });
      send(response, result.status ?? 200, result.payload, { ETag: `"${result.version}"`, ...(result.replay ? { "Idempotency-Replayed": "true" } : {}) }); return true;
    }
    return false;
  } catch (caught) {
    const error = caught instanceof ActorAuthError ? caught : new ActorAuthError("BINDING_RECOVERY_TARGET_INVALID", 409, "The operation could not be completed.");
    if (error.code === "FORBIDDEN" || error.code === "BINDING_SELF_APPROVAL_FORBIDDEN") {
      const requestId = url.pathname.match(/external-identity-binding-requests\/([^/]+)/)?.[1];
      const identityId = url.pathname.match(/external-identities\/([^/]+)/)?.[1];
      await auditDenied(prisma, actor, requestId, identityId);
    }
    fail(response, actor, error); return true;
  }
}
