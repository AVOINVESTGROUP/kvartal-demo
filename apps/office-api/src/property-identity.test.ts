import { describe, expect, it } from "vitest";
import type { ActorContext } from "@kvartal/auth";
import { resolvePartnerScope } from "./property-identity.js";

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
