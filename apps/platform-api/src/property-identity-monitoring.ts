import type { IncomingMessage, ServerResponse } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { ActorAuthError, type ActorContext } from "@kvartal/auth";
import { encodeRegistryOperation } from "@kvartal/web3";

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function assertMonitoringAccess(actor: ActorContext) {
  if (!actor.platformRoles.some((role) => role === "platform_owner" || role === "platform_admin")) {
    throw new ActorAuthError("FORBIDDEN", 403, "Property Identity monitoring is restricted to platform administrators.");
  }
}

function assertOwnerAccess(actor: ActorContext) {
  if (!actor.platformRoles.includes("platform_owner")) {
    throw new ActorAuthError("FORBIDDEN", 403, "Property Identity control actions are restricted to the platform owner.");
  }
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

export async function handlePropertyIdentityMonitoringRoute(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  prisma: PrismaClient;
  actor: ActorContext;
}) {
  const rightAuditAction = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/representation-rights\/([^/]+)\/audit$/);
  if (rightAuditAction && input.request.method === "POST") {
    assertOwnerAccess(input.actor);
    const body = await readJsonBody(input.request);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const action = body.action === "DISPUTE" || body.action === "SUSPEND" || body.action === "REVOKE" ? body.action : null;
    if (!action || reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "DISPUTE, SUSPEND or REVOKE and an audit reason of at least 10 characters are required.");
    const rightId = decodeURIComponent(rightAuditAction[1]);
    const right = await input.prisma.propertyRepresentationRight.findUnique({
      where: { id: rightId },
      include: { identityProfile: { include: { token: true } }, corporateWallet: true, onChainRecords: true },
    });
    if (!right) throw new ActorAuthError("FORBIDDEN", 404, "The representation right was not found.");
    if (["REVOKED", "EXPIRED"].includes(right.status)) throw new ActorAuthError("FORBIDDEN", 409, "The representation right is already terminal.");
    const nextStatus = action === "DISPUTE" ? "DISPUTED" : action === "SUSPEND" ? "SUSPENDED" : "REVOKED";
    const updated = await input.prisma.$transaction(async (tx) => {
      const result = await tx.propertyRepresentationRight.update({
        where: { id: right.id },
        data: {
          status: nextStatus,
          auditedByUserId: input.actor.appUserId,
          auditedAt: new Date(),
          auditReason: reason,
          revokedAt: action === "REVOKE" ? new Date() : null,
        },
      });
      await tx.partnerOffer.updateMany({ where: { representationRightId: right.id, status: "ACTIVE" }, data: { status: "WITHDRAWN" } });
      await tx.propertyPublicationGrant.updateMany({
        where: { partnerOffer: { representationRightId: right.id }, status: "ACTIVE" },
        data: { status: action === "REVOKE" ? "REVOKED" : "SUSPENDED" },
      });
      const token = right.identityProfile.token;
      const onChainRecord = right.onChainRecords.find((record) => ["ACTIVE", "SUSPENDED"].includes(record.status));
      if (token && right.corporateWallet && onChainRecord) {
        const operationType = action === "REVOKE" ? "REVOKE_REPRESENTATION" : "SUSPEND_REPRESENTATION";
        const encodedCall = encodeRegistryOperation(operationType, { tokenId: token.tokenId.toFixed(0), agencyWallet: right.corporateWallet.walletAddress });
        const idempotencyKey = `representation-audit:${right.id}:${action}:${right.updatedAt.getTime()}`;
        await tx.propertyTokenOperation.upsert({
          where: { idempotencyKey },
          update: {},
          create: { tokenRecordId: token.id, identityProfileId: right.identityProfileId, operationType, status: "PENDING_PLATFORM_SIGNER", payloadJson: { chainId: token.chainId, contractAddress: token.contractAddress, registryAdminWallet: token.ownerAddress, representationRightId: right.id, agencyWallet: right.corporateWallet.walletAddress, encodedCall, auditAction: action, reason }, idempotencyKey, requestedByUserId: input.actor.appUserId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
        await tx.propertyTokenRepresentation.update({ where: { id: onChainRecord.id }, data: { status: `PENDING_${action}` } });
      }
      await tx.propertyIdentityEvent.create({
        data: {
          identityProfileId: right.identityProfileId,
          actorUserId: input.actor.appUserId,
          actorOrganizationId: right.organizationId,
          actorOfficeId: right.officeId,
          eventType: `REPRESENTATION_RIGHT_${action}`,
          previousStatus: right.status,
          nextStatus,
          payload: { rightId: right.id, reason, ordinaryApproval: false },
        },
      });
      return result;
    });
    sendJson(input.response, 200, { ok: true, representationRight: updated });
    return true;
  }

  const rolloutAction = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/rollout-policies\/([^/]+)$/);
  if (rolloutAction && input.request.method === "PATCH") {
    assertOwnerAccess(input.actor);
    const body = await readJsonBody(input.request);
    const policyId = decodeURIComponent(rolloutAction[1]);
    const expectedVersion = Number(body.expectedVersion);
    const mode = body.mode === "NEW_SUBMISSIONS_ONLY" || body.mode === "STRICT" ? body.mode : "DISABLED";
    const registryEnabled = mode !== "DISABLED" && body.registryEnabled === true;
    const publishGateEnabled = registryEnabled && body.publishGateEnabled === true;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!Number.isSafeInteger(expectedVersion) || reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "Current policy version and a reason are required.");
    const before = await input.prisma.propertyIdentityRolloutPolicy.findUnique({ where: { id: policyId } });
    if (!before) throw new ActorAuthError("FORBIDDEN", 404, "The rollout policy was not found.");
    const changed = await input.prisma.$transaction(async (tx) => {
      const result = await tx.propertyIdentityRolloutPolicy.updateMany({ where: { id: policyId, version: expectedVersion }, data: { mode, registryEnabled, publishGateEnabled, version: { increment: 1 } } });
      if (result.count !== 1) throw new ActorAuthError("FORBIDDEN", 409, "The rollout policy changed. Reload before trying again.");
      const after = await tx.propertyIdentityRolloutPolicy.findUniqueOrThrow({ where: { id: policyId } });
      await tx.auditLog.create({ data: { actorUserId: input.actor.appUserId, action: "PROPERTY_IDENTITY_ROLLOUT_UPDATED", entityType: "PropertyIdentityRolloutPolicy", entityId: policyId, before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify({ ...after, reason })) } });
      return after;
    });
    sendJson(input.response, 200, { ok: true, rolloutPolicy: changed });
    return true;
  }

  if (input.url.pathname !== "/api/v1/platform/property-identity/monitoring" || input.request.method !== "GET") return false;
  assertMonitoringAccess(input.actor);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [submissionGroups, profileGroups, checkGroups, jobGroups, rolloutPolicies, authorityPolicies, recentEvents, representationRights, publicationGrants] = await Promise.all([
    input.prisma.propertyRegistrationSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
    input.prisma.propertyIdentityProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    input.prisma.propertyIdentityCheckRun.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    input.prisma.propertyIdentityJob.groupBy({ by: ["status"], _count: { _all: true } }),
    input.prisma.propertyIdentityRolloutPolicy.findMany({
      select: { id: true, scope: true, organizationId: true, marketId: true, mode: true, registryEnabled: true, publishGateEnabled: true, activationAt: true, version: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 100,
    }),
    input.prisma.propertyIdentityAuthorityPolicy.findMany({
      select: { id: true, organizationId: true, marketId: true, jurisdiction: true, assetClass: true, subjectScope: true, identifierScheme: true, authorityNamespacePattern: true, automaticExactMatchAllowed: true, active: true, effectiveFrom: true, effectiveUntil: true, version: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 100,
    }),
    input.prisma.propertyIdentityEvent.findMany({
      select: { id: true, submissionId: true, identityProfileId: true, eventType: true, previousStatus: true, nextStatus: true, reasonCode: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    input.prisma.propertyRepresentationRight.findMany({
      where: { status: { in: ["ATTESTED", "VERIFIED", "DISPUTED", "SUSPENDED"] } },
      include: {
        propertyObject: { include: { localizations: { where: { language: "ru" }, take: 1 } } },
        organization: true,
        office: true,
        corporateWallet: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    input.prisma.propertyPublicationGrant.findMany({
      where: { status: { in: ["ACTIVE", "SUSPENDED", "REVOKED"] } },
      include: { publicationSurface: true, partnerOffer: { include: { representationRight: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  sendJson(input.response, 200, {
    generatedAt: new Date().toISOString(),
    monitoringOnly: true,
    note: "Registration submissions are resolved by their authors in partner cabinets; this endpoint exposes no approval workflow.",
    submissionsByStatus: Object.fromEntries(submissionGroups.map((row) => [row.status, row._count._all])),
    profilesByStatus: Object.fromEntries(profileGroups.map((row) => [row.status, row._count._all])),
    checksLast24HoursByStatus: Object.fromEntries(checkGroups.map((row) => [row.status, row._count._all])),
    jobsByStatus: Object.fromEntries(jobGroups.map((row) => [row.status, row._count._all])),
    rolloutPolicies,
    authorityPolicies,
    recentEvents,
    representationRights: representationRights.map((right) => ({
      id: right.id,
      propertyObjectId: right.propertyObjectId,
      title: right.propertyObject.localizations[0]?.title ?? right.propertyObject.assetClass,
      organization: right.organization.legalName,
      office: right.office.legalName,
      rightType: right.rightType,
      status: right.status,
      corporateWallet: right.corporateWallet?.walletAddress ?? null,
      evidenceHash: right.evidenceHash,
      auditReason: right.auditReason,
      createdAt: right.createdAt,
      updatedAt: right.updatedAt,
    })),
    publicationGrants: publicationGrants.map((grant) => ({
      id: grant.id,
      propertyObjectId: grant.propertyObjectId,
      surface: grant.publicationSurface.canonicalHost ?? grant.publicationSurface.tenantKey ?? grant.publicationSurface.id,
      representationStatus: grant.partnerOffer.representationRight.status,
      offerStatus: grant.partnerOffer.status,
      status: grant.status,
      createdAt: grant.createdAt,
    })),
  });
  return true;
}
