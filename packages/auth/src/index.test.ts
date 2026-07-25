import { describe, expect, it } from "vitest";
import {
  ActorAuthError, CSRF_COOKIE, FIREBASE_SESSION_COOKIE, assertRecentLogin, createCsrfToken,
  hasExternalIdentityBindingReview, parseIfMatch, readRetentionConfig, requestHash, resolveUserActor,
  secureActorHeaders, validateCsrf, validateIdempotencyKey, validateReason,
} from "./index.js";

describe("session and CSRF contract", () => {
  it("creates an exact 32-byte base64url token and validates origin/double submit", () => {
    const token = createCsrfToken((size) => Buffer.alloc(size, 7));
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(validateCsrf({ cookie: token, header: token, origin: "https://admin.test", allowedOrigin: "https://admin.test" })).toBe(true);
    expect(validateCsrf({ cookie: token, header: token, origin: "https://evil.test", allowedOrigin: "https://admin.test" })).toBe(false);
    expect(CSRF_COOKIE).toBe("__Host-kvartal_csrf"); expect(FIREBASE_SESSION_COOKIE).toBe("__Host-kvartal_session");
  });
  it("enforces the exact recent login window", () => {
    expect(() => assertRecentLogin(1_000, 1_360)).not.toThrow();
    expect(() => assertRecentLogin(1_061, 1_000)).toThrowError(ActorAuthError);
    expect(() => assertRecentLogin(999, 1_360)).toThrowError(/recent/i);
  });
});

describe("actor SSOT and permissions", () => {
  const record = { id:"identity-1", provider:"FIREBASE" as const, subject:"real-uid", status:"ACTIVE" as const, appUser:{ id:"user-1", active:true, platformRoleAssignments:[{active:true,role:"platform_owner" as const}], organizationMemberships:[], officeMemberships:[] } };
  it("resolves only provider+subject identity and never a legacy firebaseUid", async () => {
    let lookedUp = "";
    const actor = await resolveUserActor({ authorization:"Bearer session", correlationId:"c1", verifySession:async()=>({uid:"real-uid"}), findIdentity:async(_provider,subject)=>{lookedUp=subject;return record;} });
    expect(lookedUp).toBe("real-uid"); expect(actor.appUserId).toBe("user-1"); expect(Object.isFrozen(actor)).toBe(true);
  });
  it("rejects absent, revoked and inactive bindings", async () => {
    const base={authorization:"Bearer s",correlationId:"c",verifySession:async()=>({uid:"u"})};
    await expect(resolveUserActor({...base,findIdentity:async()=>null})).rejects.toMatchObject({code:"IDENTITY_BINDING_REQUIRED"});
    await expect(resolveUserActor({...base,findIdentity:async()=>({...record,status:"REVOKED"})})).rejects.toMatchObject({code:"IDENTITY_REVOKED"});
    await expect(resolveUserActor({...base,findIdentity:async()=>({...record,appUser:{...record.appUser,active:false}})})).rejects.toMatchObject({code:"APP_USER_INACTIVE"});
  });
  it("allows review only to platform_owner", () => {
    expect(hasExternalIdentityBindingReview({platformRoles:["platform_owner"]})).toBe(true);
    expect(hasExternalIdentityBindingReview({platformRoles:["platform_admin"]})).toBe(false);
  });
});

describe("mutation and transport contracts", () => {
  it("separates infrastructure and actor credentials", () => {
    expect(secureActorHeaders("google-id","firebase-session")).toEqual({"X-Serverless-Authorization":"Bearer google-id",Authorization:"Bearer firebase-session"});
  });
  it("validates idempotency, versions, reasons and canonical hashes", () => {
    expect(validateIdempotencyKey("actor:1234567890:key")).toBe(true); expect(validateIdempotencyKey("short")).toBe(false);
    expect(parseIfMatch('"7"')).toBe(7); expect(parseIfMatch("7")).toBeNull();
    expect(validateReason("0123456789")).toBe("0123456789"); expect(validateReason("short")).toBeNull();
    expect(requestHash({b:2,a:1})).toBe(requestHash({a:1,b:2}));
  });
  it("requires explicit valid production retention", () => {
    expect(()=>readRetentionConfig({},true)).toThrowError(ActorAuthError);
    expect(readRetentionConfig({EXTERNAL_IDENTITY_REQUEST_PII_RETENTION_DAYS:"90",EXTERNAL_IDENTITY_AUDIT_RETENTION_DAYS:"365"},true)).toEqual({requestDays:90,auditDays:365});
  });
});
