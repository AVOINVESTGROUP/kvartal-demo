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

export async function handlePropertyIdentityMonitoringRoute(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  prisma: PrismaClient;
  actor: ActorContext;
}) {
  if (input.url.pathname !== "/api/v1/platform/property-identity/monitoring" || input.request.method !== "GET") return false;
  assertMonitoringAccess(input.actor);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [submissionGroups, profileGroups, checkGroups, jobGroups, rolloutPolicies, authorityPolicies, recentEvents] = await Promise.all([
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
  });
  return true;
}
