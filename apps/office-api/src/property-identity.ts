import type { IncomingMessage, ServerResponse } from "node:http";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ActorAuthError,
  requestHash,
  validateIdempotencyKey,
  type ActorContext,
} from "@kvartal/auth";
import {
  digestIdentifier,
  encryptIdentifier,
  identifierAad,
  identityInputHash,
  normalizeIdentifierValue,
  type IdentifierTuple,
  type PropertyIdentitySubjectScope,
} from "@kvartal/property-identity";

type JsonObject = Record<string, unknown>;
type PartnerScope = Readonly<{ organizationId: string; officeId: string }>;

class PropertyIdentityHttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

function sendJson(response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) as JsonObject : {};
  } catch {
    throw new PropertyIdentityHttpError(400, "INVALID_JSON", "A valid JSON body is required.");
  }
}

function requiredString(value: unknown, field: string, maxLength = 512) {
  if (typeof value !== "string" || !value.trim()) throw new PropertyIdentityHttpError(400, "FIELD_REQUIRED", `${field} is required.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new PropertyIdentityHttpError(400, "FIELD_TOO_LONG", `${field} is too long.`);
  return normalized;
}

function assertSubjectScope(value: unknown): PropertyIdentitySubjectScope {
  if (value === "PROJECT" || value === "LAND_PARCEL" || value === "BUILDING" || value === "PREMISE" || value === "UNIT") return value;
  throw new PropertyIdentityHttpError(400, "SUBJECT_SCOPE_INVALID", "A valid physical subject scope is required.");
}

function assertAssetClass(value: unknown) {
  const values = new Set(["land", "apartment", "house", "warehouse", "industrial_site", "factory", "hotel", "office", "retail", "mixed_use", "development_project", "investment_project", "other"]);
  if (typeof value === "string" && values.has(value)) return value;
  throw new PropertyIdentityHttpError(400, "ASSET_CLASS_INVALID", "A valid asset class is required.");
}

export function resolvePartnerScope(actor: ActorContext, requested: { organizationId?: unknown; officeId?: unknown }): PartnerScope {
  const organizationId = typeof requested.organizationId === "string" ? requested.organizationId : undefined;
  const officeId = typeof requested.officeId === "string" ? requested.officeId : undefined;
  const officeMemberships = actor.officeMemberships.filter((membership) =>
    (!organizationId || membership.organizationId === organizationId) &&
    (!officeId || membership.officeId === officeId) &&
    membership.roles.some((role) => role === "office_owner" || role === "office_admin" || role === "broker"),
  );
  const organizationMemberships = actor.organizationMemberships.filter((membership) =>
    (!organizationId || membership.organizationId === organizationId) &&
    membership.roles.some((role) => role === "organization_owner" || role === "organization_admin"),
  );
  const candidate = officeMemberships[0] ?? actor.officeMemberships.find((membership) =>
    organizationMemberships.some((organization) => organization.organizationId === membership.organizationId),
  );
  if (!candidate || (officeId && candidate.officeId !== officeId) || (organizationId && candidate.organizationId !== organizationId)) {
    throw new ActorAuthError("FORBIDDEN", 403, "Property Identity access is not permitted for this organisation and office.");
  }
  return { organizationId: candidate.organizationId, officeId: candidate.officeId };
}

function readKeyConfig(env: NodeJS.ProcessEnv) {
  const encryptionKey = Buffer.from(env.PROPERTY_IDENTITY_ENCRYPTION_KEY_BASE64 ?? "", "base64");
  if (encryptionKey.length !== 32) throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity encryption is not configured.");
  let digestKeys: Array<{ version: string; keyBase64: string }>;
  try {
    digestKeys = JSON.parse(env.PROPERTY_IDENTITY_DIGEST_KEYS_JSON ?? "[]") as Array<{ version: string; keyBase64: string }>;
  } catch {
    throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity digest keys are not configured.");
  }
  const keys = new Map(digestKeys.map((item) => [item.version, Buffer.from(item.keyBase64, "base64")]));
  if ([...keys.values()].some((key) => key.length < 32)) throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity digest key configuration is invalid.");
  return { encryptionKey, digestKeys: keys };
}

function namespaceMatches(pattern: string, namespace: string) {
  const expected = pattern.trim().toLocaleUpperCase("und");
  const actual = namespace.trim().toLocaleUpperCase("und");
  return expected.endsWith("*") ? actual.startsWith(expected.slice(0, -1)) : actual === expected;
}

async function idempotentMutation(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  request: IncomingMessage;
  organizationId: string;
  route: string;
  body: JsonObject;
  run: (tx: Prisma.TransactionClient) => Promise<{ status: number; payload: JsonObject }>;
}) {
  const key = input.request.headers["idempotency-key"];
  if (!validateIdempotencyKey(key)) throw new PropertyIdentityHttpError(400, "IDEMPOTENCY_KEY_INVALID", "A valid Idempotency-Key is required.");
  const hash = requestHash(input.body);
  const scope = `${input.actor.appUserId}:${input.organizationId}:${input.request.method}:${input.route}:${key}`;
  return input.prisma.$transaction(async (tx) => {
    const existing = await tx.mutationIdempotency.findUnique({ where: { scope } });
    if (existing) {
      if (existing.requestHash !== hash) throw new PropertyIdentityHttpError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was reused with a different payload.");
      if (existing.status === "SUCCEEDED") return { status: existing.responseStatus ?? 200, payload: existing.responseBody as JsonObject, replay: true };
      return { status: 202, payload: { ok: true, processing: true }, replay: true };
    }
    await tx.mutationIdempotency.create({ data: { scope, requestHash: hash, status: "IN_PROGRESS" } });
    const result = await input.run(tx);
    await tx.mutationIdempotency.update({
      where: { scope },
      data: { status: "SUCCEEDED", responseStatus: result.status, responseBody: result.payload as Prisma.InputJsonValue, terminalAt: new Date() },
    });
    return { ...result, replay: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function createSubmission(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  request: IncomingMessage;
  body: JsonObject;
  env: NodeJS.ProcessEnv;
}) {
  const scope = resolvePartnerScope(input.actor, input.body);
  const marketId = requiredString(input.body.marketId, "marketId", 128);
  const jurisdiction = requiredString(input.body.jurisdiction, "jurisdiction", 16).toLocaleUpperCase("und");
  const subjectScope = assertSubjectScope(input.body.subjectScope);
  const assetClass = assertAssetClass(input.body.assetClass);
  const identityInput = typeof input.body.identityInput === "object" && input.body.identityInput !== null ? input.body.identityInput : {};
  const identifiers = Array.isArray(input.body.identifiers) ? input.body.identifiers as JsonObject[] : [];
  if (identifiers.length > 20) throw new PropertyIdentityHttpError(400, "IDENTIFIER_LIMIT_EXCEEDED", "At most 20 identifiers are allowed.");
  const { encryptionKey, digestKeys } = readKeyConfig(input.env);

  const [office, market, cryptoVersions, policies] = await Promise.all([
    input.prisma.office.findFirst({ where: { id: scope.officeId, organizationId: scope.organizationId, status: "active" }, select: { id: true } }),
    input.prisma.market.findFirst({ where: { id: marketId, active: true }, select: { id: true } }),
    input.prisma.propertyIdentityCryptoKeyVersion.findMany({ where: { status: { in: ["ACTIVE", "RETIRING"] } } }),
    input.prisma.propertyIdentityAuthorityPolicy.findMany({
      where: {
        active: true,
        jurisdiction,
        subjectScope,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        AND: [{ OR: [{ organizationId: scope.organizationId }, { organizationId: null }] }, { OR: [{ marketId }, { marketId: null }] }],
      },
      orderBy: [{ organizationId: "desc" }, { marketId: "desc" }, { version: "desc" }],
    }),
  ]);
  if (!office || !market) throw new PropertyIdentityHttpError(403, "PARTNER_SCOPE_INVALID", "The selected office or market is not available.");
  if (!cryptoVersions.length || cryptoVersions.some((version) => !digestKeys.has(version.version))) {
    throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Active Property Identity digest keys are not configured.");
  }

  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scope.organizationId,
    route: "/api/v1/admin/property-identity/submissions",
    body: input.body,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.create({
        data: {
          organizationId: scope.organizationId,
          officeId: scope.officeId,
          marketId,
          createdByUserId: input.actor.appUserId,
          subjectScope,
          jurisdiction,
          assetClass: assetClass as never,
          identityInput: identityInput as Prisma.InputJsonValue,
          lastIdentityInputHash: identityInputHash(identityInput),
        },
      });

      let needsCorrection = false;
      for (const identifier of identifiers) {
        const scheme = requiredString(identifier.scheme, "identifier.scheme", 64).toLocaleUpperCase("und");
        const authorityNamespace = requiredString(identifier.authorityNamespace, "identifier.authorityNamespace", 128).toLocaleUpperCase("und");
        const policy = policies.find((candidate) => candidate.identifierScheme.toLocaleUpperCase("und") === scheme && namespaceMatches(candidate.authorityNamespacePattern, authorityNamespace));
        const rawValue = typeof identifier.rawValue === "string" ? identifier.rawValue : "";
        const normalizerId = policy?.normalizerId as "opaque-v1" | "alphanumeric-v1" | "composite-unit-v1" | undefined;
        if (!policy || !normalizerId || !["opaque-v1", "alphanumeric-v1", "composite-unit-v1"].includes(normalizerId)) {
          needsCorrection = true;
          continue;
        }
        const normalizedValue = normalizeIdentifierValue({
          rawValue,
          normalizerId,
          structuredComponents: typeof identifier.structuredComponents === "object" && identifier.structuredComponents !== null ? identifier.structuredComponents as Record<string, unknown> : undefined,
        });
        const tuple: IdentifierTuple = { scheme, jurisdiction, authorityNamespace, subjectScope, normalizedValue };
        const rawAad = identifierAad({ scheme, jurisdiction, authorityNamespace, subjectScope, normalizerId, normalizerVersion: policy.normalizerVersion, valueKind: "raw" });
        const normalizedAad = identifierAad({ scheme, jurisdiction, authorityNamespace, subjectScope, normalizerId, normalizerVersion: policy.normalizerVersion, valueKind: "normalized" });
        const rawEncrypted = encryptIdentifier(rawValue, encryptionKey, rawAad);
        const normalizedEncrypted = encryptIdentifier(normalizedValue, encryptionKey, normalizedAad);
        await tx.propertyIdentifierObservation.create({
          data: {
            submissionId: submission.id,
            createdByUserId: input.actor.appUserId,
            scheme,
            subjectScope,
            jurisdiction,
            authorityNamespace,
            rawValueCiphertext: rawEncrypted.ciphertext,
            rawValueNonce: rawEncrypted.nonce,
            rawValueAuthTag: rawEncrypted.authTag,
            normalizedValueCiphertext: normalizedEncrypted.ciphertext,
            normalizedValueNonce: normalizedEncrypted.nonce,
            normalizedValueAuthTag: normalizedEncrypted.authTag,
            normalizerId,
            normalizerVersion: policy.normalizerVersion,
            structuredComponents: identifier.structuredComponents as Prisma.InputJsonValue | undefined,
            sourceType: typeof identifier.sourceType === "string" ? identifier.sourceType : "manual",
            sourceDocumentId: typeof identifier.sourceDocumentId === "string" ? identifier.sourceDocumentId : null,
            sourceUrl: typeof identifier.sourceUrl === "string" ? identifier.sourceUrl : null,
            status: "READY",
            digests: {
              create: cryptoVersions.map((version) => ({
                digestKeyVersion: version.version,
                digest: digestIdentifier(tuple, digestKeys.get(version.version)!),
              })),
            },
          },
        });
      }
      if (needsCorrection) {
        await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { status: "NEEDS_CORRECTION", rowVersion: { increment: 1 } } });
      }
      await tx.propertyIdentityEvent.create({
        data: {
          submissionId: submission.id,
          actorUserId: input.actor.appUserId,
          actorOrganizationId: scope.organizationId,
          actorOfficeId: scope.officeId,
          eventType: "SUBMISSION_CREATED",
          previousStatus: null,
          nextStatus: needsCorrection ? "NEEDS_CORRECTION" : "DRAFT",
        },
      });
      return { status: 201, payload: { ok: true, submissionId: submission.id, status: needsCorrection ? "NEEDS_CORRECTION" : "DRAFT" } };
    },
  });
}

async function runExactCheck(input: { prisma: PrismaClient; actor: ActorContext; request: IncomingMessage; submissionId: string; body: JsonObject }) {
  const submission = await input.prisma.propertyRegistrationSubmission.findUnique({
    where: { id: input.submissionId },
    include: { observations: { where: { status: "READY" }, include: { digests: true } } },
  });
  if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, { organizationId: submission.organizationId, officeId: submission.officeId });
  if (["CANCELLED", "CLOSED", "CANONICAL_CREATED", "LINKED_EXISTING", "CONFIRMING"].includes(submission.status)) {
    throw new PropertyIdentityHttpError(409, "SUBMISSION_STATE_INVALID", "The submission cannot be checked in its current state.");
  }
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: submission.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}/check`,
    body: input.body,
    run: async (tx) => {
      const digests = submission.observations.flatMap((observation) => observation.digests.map((digest) => ({ ...digest, observationId: observation.id })));
      const inputHash = identityInputHash(submission.identityInput);
      if (!digests.length) {
        const run = await tx.propertyIdentityCheckRun.create({
          data: { submissionId: submission.id, status: "RESOLVED", outcome: "INSUFFICIENT_EVIDENCE", identityInputHash: inputHash, authorityPolicyVersion: 1, completedAt: new Date(), redactedResult: { matchedProfiles: 0 } },
        });
        await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { status: "NEEDS_CORRECTION", lastIdentityInputHash: inputHash, rowVersion: { increment: 1 } } });
        return { status: 200, payload: { ok: true, checkRunId: run.id, outcome: "INSUFFICIENT_EVIDENCE", status: "NEEDS_CORRECTION" } };
      }
      const aliases = await tx.propertyIdentifierClaimDigest.findMany({
        where: { active: true, OR: digests.map((digest) => ({ digestKeyVersion: digest.digestKeyVersion, digest: digest.digest })) },
        include: { claim: { include: { identityProfile: true } } },
      });
      const profileIds = [...new Set(aliases.map((alias) => alias.claim.identityProfileId))];
      const matchedObservationKeys = new Set(aliases.map((alias) => `${alias.digestKeyVersion}:${alias.digest}`));
      const matchedObservationIds = new Set(digests.filter((digest) => matchedObservationKeys.has(`${digest.digestKeyVersion}:${digest.digest}`)).map((digest) => digest.observationId));
      let outcome: "UNIQUE_CANDIDATE" | "EXACT_EXISTING" | "STRONG_IDENTIFIER_CONFLICT";
      let status: "UNIQUE_CANDIDATE" | "EXACT_EXISTING" | "STRONG_IDENTIFIER_CONFLICT";
      if (!profileIds.length) outcome = status = "UNIQUE_CANDIDATE";
      else if (profileIds.length === 1 && matchedObservationIds.size === submission.observations.length) outcome = status = "EXACT_EXISTING";
      else outcome = status = "STRONG_IDENTIFIER_CONFLICT";
      const run = await tx.propertyIdentityCheckRun.create({
        data: {
          submissionId: submission.id,
          status: "RESOLVED",
          outcome,
          identityInputHash: inputHash,
          authorityPolicyVersion: 1,
          completedAt: new Date(),
          redactedResult: { matchedProfiles: profileIds.length, matchedIdentifiers: matchedObservationIds.size, totalIdentifiers: submission.observations.length },
          candidateEvidence: { create: profileIds.map((profileId) => ({ candidateProfileId: profileId, evidenceType: "AUTHORITATIVE_IDENTIFIER", signalCode: "EXACT_NAMESPACED_DIGEST" })) },
        },
      });
      await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { status, lastIdentityInputHash: inputHash, rowVersion: { increment: 1 } } });
      await tx.propertyIdentityEvent.create({
        data: { submissionId: submission.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "EXACT_CHECK_RESOLVED", previousStatus: submission.status, nextStatus: status, payload: { checkRunId: run.id, outcome } },
      });
      return { status: 200, payload: { ok: true, checkRunId: run.id, outcome, status, candidateCount: profileIds.length ? 1 : 0 } };
    },
  });
}

async function listSubmissions(prisma: PrismaClient, actor: ActorContext, url: URL) {
  const scope = resolvePartnerScope(actor, { organizationId: url.searchParams.get("organizationId") ?? undefined, officeId: url.searchParams.get("officeId") ?? undefined });
  const submissions = await prisma.propertyRegistrationSubmission.findMany({
    where: { organizationId: scope.organizationId, officeId: scope.officeId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100),
    select: { id: true, status: true, subjectScope: true, jurisdiction: true, assetClass: true, canonicalPropertyObjectId: true, rowVersion: true, createdAt: true, updatedAt: true },
  });
  return { ok: true, submissions };
}

async function getSubmission(prisma: PrismaClient, actor: ActorContext, submissionId: string) {
  const submission = await prisma.propertyRegistrationSubmission.findUnique({
    where: { id: submissionId },
    include: {
      observations: { select: { id: true, scheme: true, subjectScope: true, jurisdiction: true, authorityNamespace: true, normalizerId: true, normalizerVersion: true, sourceType: true, status: true, correctionReason: true, createdAt: true } },
      checkRuns: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, status: true, outcome: true, redactedResult: true, startedAt: true, completedAt: true, createdAt: true } },
      confirmations: { select: { id: true, resolution: true, createdAt: true } },
    },
  });
  if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(actor, { organizationId: submission.organizationId, officeId: submission.officeId });
  return { ok: true, submission };
}

export async function handlePropertyIdentityRequest(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  prisma: PrismaClient;
  actor: ActorContext;
  env?: NodeJS.ProcessEnv;
}) {
  const base = "/api/v1/admin/property-identity/submissions";
  try {
    if (input.url.pathname === base && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const result = await createSubmission({ prisma: input.prisma, actor: input.actor, request: input.request, body, env: input.env ?? process.env });
      sendJson(input.response, result.status, result.payload, result.replay ? { "idempotent-replay": "true" } : {});
      return true;
    }
    if (input.url.pathname === base && input.request.method === "GET") {
      sendJson(input.response, 200, await listSubmissions(input.prisma, input.actor, input.url));
      return true;
    }
    const match = input.url.pathname.match(/^\/api\/v1\/admin\/property-identity\/submissions\/([^/]+)(?:\/(check))?$/);
    if (!match) return false;
    const submissionId = decodeURIComponent(match[1]);
    if (!match[2] && input.request.method === "GET") {
      sendJson(input.response, 200, await getSubmission(input.prisma, input.actor, submissionId));
      return true;
    }
    if (match[2] === "check" && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const result = await runExactCheck({ prisma: input.prisma, actor: input.actor, request: input.request, submissionId, body });
      sendJson(input.response, result.status, result.payload, result.replay ? { "idempotent-replay": "true" } : {});
      return true;
    }
    throw new PropertyIdentityHttpError(405, "METHOD_NOT_ALLOWED", "The method is not allowed for this Property Identity resource.");
  } catch (caught) {
    const error = caught as { status?: number; code?: string; message?: string };
    sendJson(input.response, error.status ?? 500, { ok: false, error: { code: error.code ?? "PROPERTY_IDENTITY_INTERNAL_ERROR", message: error.status && error.status < 500 ? error.message : "Property Identity operation failed.", correlationId: input.actor.correlationId } });
    return true;
  }
}
