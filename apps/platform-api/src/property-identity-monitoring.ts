import type { IncomingMessage, ServerResponse } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { ActorAuthError, type ActorContext } from "@kvartal/auth";

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
  const rightAction = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/representation-rights\/([^/]+)\/verify$/);
  if (rightAction && input.request.method === "POST") {
    assertOwnerAccess(input.actor);
    const body = await readJsonBody(input.request);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "A verification reason of at least 10 characters is required.");
    const rightId = decodeURIComponent(rightAction[1]);
    const right = await input.prisma.propertyRepresentationRight.findUnique({ where: { id: rightId } });
    if (!right) throw new ActorAuthError("FORBIDDEN", 404, "The representation right was not found.");
    if (!["DECLARED", "EVIDENCE_PENDING", "VERIFIED"].includes(right.status)) throw new ActorAuthError("FORBIDDEN", 409, "The representation right cannot be verified in its current state.");
    const updated = await input.prisma.$transaction(async (tx) => {
      const result = await tx.propertyRepresentationRight.update({
        where: { id: right.id },
        data: { status: "VERIFIED", verifiedByUserId: input.actor.appUserId },
      });
      await tx.propertyIdentityEvent.create({
        data: {
          identityProfileId: right.identityProfileId,
          actorUserId: input.actor.appUserId,
          actorOrganizationId: right.organizationId,
          actorOfficeId: right.officeId,
          eventType: "REPRESENTATION_RIGHT_VERIFIED",
          previousStatus: right.status,
          nextStatus: "VERIFIED",
          payload: { rightId: right.id, reason },
        },
      });
      return result;
    });
    sendJson(input.response, 200, { ok: true, representationRight: updated });
    return true;
  }

  const grantAction = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/publication-grants\/([^/]+)\/activate$/);
  if (grantAction && input.request.method === "POST") {
    assertOwnerAccess(input.actor);
    const body = await readJsonBody(input.request);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "An activation reason of at least 10 characters is required.");
    const grantId = decodeURIComponent(grantAction[1]);
    const grant = await input.prisma.propertyPublicationGrant.findUnique({
      where: { id: grantId },
      include: { identityProfile: true, partnerOffer: { include: { representationRight: true } }, publicationSurface: true },
    });
    if (!grant) throw new ActorAuthError("FORBIDDEN", 404, "The publication grant was not found.");
    if (grant.identityProfile.status !== "VERIFIED_INTERNAL" || grant.partnerOffer.status !== "ACTIVE" || grant.partnerOffer.representationRight.status !== "VERIFIED" || grant.publicationSurface.status !== "ACTIVE") {
      throw new ActorAuthError("FORBIDDEN", 409, "Identity, representation right, offer and publication surface must all be active before publication.");
    }
    const updated = await input.prisma.$transaction(async (tx) => {
      await tx.propertyPublicationGrant.updateMany({
        where: { publicationSurfaceId: grant.publicationSurfaceId, propertyObjectId: grant.propertyObjectId, status: "ACTIVE", id: { not: grant.id } },
        data: { status: "REPLACED", replacedByGrantId: grant.id },
      });
      const result = await tx.propertyPublicationGrant.update({ where: { id: grant.id }, data: { status: "ACTIVE" } });
      await tx.propertyIdentityEvent.create({
        data: {
          identityProfileId: grant.identityProfileId,
          actorUserId: input.actor.appUserId,
          actorOrganizationId: grant.sellerSideOrganizationId,
          actorOfficeId: grant.sellerSideOfficeId,
          eventType: "PUBLICATION_GRANT_ACTIVATED",
          previousStatus: grant.status,
          nextStatus: "ACTIVE",
          payload: { grantId: grant.id, publicationSurfaceId: grant.publicationSurfaceId, reason },
        },
      });
      return result;
    });
    sendJson(input.response, 200, { ok: true, publicationGrant: updated });
    return true;
  }

  if (input.url.pathname !== "/api/v1/platform/property-identity/monitoring" || input.request.method !== "GET") return false;
  assertMonitoringAccess(input.actor);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [submissionGroups, profileGroups, checkGroups, jobGroups, rolloutPolicies, authorityPolicies, recentEvents, pendingRights, pendingGrants] = await Promise.all([
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
      where: { status: { in: ["DECLARED", "EVIDENCE_PENDING"] } },
      include: {
        propertyObject: { include: { localizations: { where: { language: "ru" }, take: 1 } } },
        organization: true,
        office: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    input.prisma.propertyPublicationGrant.findMany({
      where: { status: "DRAFT" },
      include: { publicationSurface: true, partnerOffer: { include: { representationRight: true } } },
      orderBy: { createdAt: "asc" },
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
    pendingRights: pendingRights.map((right) => ({
      id: right.id,
      propertyObjectId: right.propertyObjectId,
      title: right.propertyObject.localizations[0]?.title ?? right.propertyObject.assetClass,
      organization: right.organization.legalName,
      office: right.office.legalName,
      rightType: right.rightType,
      status: right.status,
      createdAt: right.createdAt,
    })),
    pendingGrants: pendingGrants.map((grant) => ({
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
