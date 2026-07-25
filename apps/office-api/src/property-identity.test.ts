import { describe, expect, it } from "vitest";
import type { ActorContext } from "@kvartal/auth";
import { resolvePartnerScope, selectEffectivePropertyIdentityRollout } from "./property-identity.js";

const actor: ActorContext = Object.freeze({
  actorType: "USER",
  appUserId: "user-1",
  externalIdentityId: "identity-1",
  provider: "FIREBASE",
  subject: "firebase-user-1",
  platformRoles: Object.freeze([]),
  organizationMemberships: Object.freeze([
    Object.freeze({ organizationId: "org-1", roles: Object.freeze(["organization_admin" as const]) }),
  ]),
  officeMemberships: Object.freeze([
    Object.freeze({ organizationId: "org-1", officeId: "office-1", roles: Object.freeze(["office_admin" as const]) }),
    Object.freeze({ organizationId: "org-2", officeId: "office-2", roles: Object.freeze(["office_viewer" as const]) }),
  ]),
  correlationId: "correlation-1",
});

describe("Property Identity partner scope", () => {
  it("derives the authorised organisation and office from ActorContext", () => {
    expect(resolvePartnerScope(actor, {})).toEqual({ organizationId: "org-1", officeId: "office-1" });
    expect(resolvePartnerScope(actor, { organizationId: "org-1", officeId: "office-1" })).toEqual({ organizationId: "org-1", officeId: "office-1" });
  });

  it("rejects body selectors outside active write memberships", () => {
    expect(() => resolvePartnerScope(actor, { organizationId: "org-2", officeId: "office-2" })).toThrowError(/not permitted/i);
    expect(() => resolvePartnerScope(actor, { organizationId: "org-3", officeId: "office-3" })).toThrowError(/not permitted/i);
  });
});

describe("Property Identity rollout policy", () => {
  const base = {
    mode: "STRICT" as const,
    registryEnabled: true,
    publishGateEnabled: true,
    activationAt: null,
    version: 1,
    updatedAt: new Date("2026-07-25T00:00:00Z"),
  };

  it("uses the most specific active policy and normalises disabled mode", () => {
    const effective = selectEffectivePropertyIdentityRollout([
      { ...base, id: "global", scope: "GLOBAL", organizationId: null, marketId: null },
      { ...base, id: "market", scope: "MARKET", organizationId: null, marketId: "market-1" },
      { ...base, id: "org", scope: "ORGANISATION", organizationId: "org-1", marketId: null, mode: "DISABLED", version: 2 },
    ], "org-1", "market-1", new Date("2026-07-25T01:00:00Z"));
    expect(effective).toEqual({ policyId: "org", mode: "DISABLED", registryEnabled: false, publishGateEnabled: false });
  });

  it("ignores future and wrongly scoped policies and fails closed to disabled", () => {
    const effective = selectEffectivePropertyIdentityRollout([
      { ...base, id: "future", scope: "ORGANISATION", organizationId: "org-1", marketId: null, activationAt: new Date("2026-07-26T00:00:00Z") },
      { ...base, id: "other", scope: "MARKET", organizationId: null, marketId: "market-2" },
    ], "org-1", "market-1", new Date("2026-07-25T01:00:00Z"));
    expect(effective).toEqual({ policyId: null, mode: "DISABLED", registryEnabled: false, publishGateEnabled: false });
  });
});
