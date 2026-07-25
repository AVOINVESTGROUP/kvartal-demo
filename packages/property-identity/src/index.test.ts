import { describe, expect, it } from "vitest";
import {
  PropertyIdentityDomainError,
  advisoryLockKey,
  assertAuthorConfirmation,
  assertRegistrationTransition,
  canonicalIdentifierTuple,
  canonicalize,
  createStablePropertyIdentityId,
  decryptIdentifier,
  digestIdentifier,
  encryptIdentifier,
  identifierAad,
  identityInputHash,
  normalizeIdentifierValue,
  sortedAdvisoryLockKeys,
} from "./index.js";

const tuple = {
  scheme: "registry_id",
  jurisdiction: "zz",
  authorityNamespace: "test:registry",
  subjectScope: "UNIT" as const,
  normalizedValue: "ABC123",
};

describe("Property Identity domain contracts", () => {
  it("guards the self-service registration state machine", () => {
    expect(() => assertRegistrationTransition("DRAFT", "READY_FOR_CHECK")).not.toThrow();
    expect(() => assertRegistrationTransition("UNIQUE_CANDIDATE", "CONFIRMING")).not.toThrow();
    expect(() => assertRegistrationTransition("CHECKING", "CANONICAL_CREATED")).toThrowError(PropertyIdentityDomainError);
    expect(() => assertRegistrationTransition("CLOSED", "READY_FOR_CHECK")).toThrowError(PropertyIdentityDomainError);
  });

  it("uses canonical JSON encoding without delimiter collisions", () => {
    expect(canonicalize({ b: "x|y", a: [2, 1] })).toBe('{"a":[2,1],"b":"x|y"}');
    expect(canonicalIdentifierTuple(tuple)).toBe('{"authorityNamespace":"TEST:REGISTRY","jurisdiction":"ZZ","normalizedValue":"ABC123","scheme":"REGISTRY_ID","subjectScope":"UNIT"}');
  });

  it("normalizes supported values deterministically", () => {
    expect(normalizeIdentifierValue({ rawValue: " ab-12 3 ", normalizerId: "alphanumeric-v1" })).toBe("AB123");
    expect(normalizeIdentifierValue({ normalizerId: "composite-unit-v1", structuredComponents: { project: " Alpha ", building: "b-1", floor: 4, unit: " 42 " } }))
      .toBe('{"building":"B-1","floor":"4","project":"ALPHA","unit":"42"}');
  });

  it("creates keyed digests and stable signed advisory lock keys", () => {
    const digest = digestIdentifier(tuple, Buffer.alloc(32, 7));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(advisoryLockKey(digest)).toBeTypeOf("bigint");
    expect(sortedAdvisoryLockKeys([digest, digest])).toHaveLength(1);
  });

  it("encrypts identifiers with deterministic AAD and rejects row swapping", () => {
    const key = Buffer.alloc(32, 3);
    const aad = identifierAad({ ...tuple, normalizerId: "alphanumeric-v1", normalizerVersion: 1, valueKind: "normalized" });
    const encrypted = encryptIdentifier("ABC123", key, aad, Buffer.alloc(12, 9));
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(decryptIdentifier(encrypted, key, aad)).toBe("ABC123");
    const wrongAad = identifierAad({ ...tuple, authorityNamespace: "OTHER", normalizerId: "alphanumeric-v1", normalizerVersion: 1, valueKind: "normalized" });
    expect(() => decryptIdentifier(encrypted, key, wrongAad)).toThrowError(/authentication failed/i);
  });

  it("binds author confirmation to the latest resolved eligible check", () => {
    const hash = identityInputHash({ unit: "42", project: "alpha" });
    expect(() => assertAuthorConfirmation({ registrationStatus: "UNIQUE_CANDIDATE", runStatus: "RESOLVED", outcome: "UNIQUE_CANDIDATE", resolution: "CREATE_NEW", currentIdentityInputHash: hash, checkedIdentityInputHash: hash })).not.toThrow();
    expect(() => assertAuthorConfirmation({ registrationStatus: "EXACT_EXISTING", runStatus: "RESOLVED", outcome: "EXACT_EXISTING", resolution: "LINK_EXISTING", currentIdentityInputHash: hash, checkedIdentityInputHash: hash })).not.toThrow();
    expect(() => assertAuthorConfirmation({ registrationStatus: "STRONG_IDENTIFIER_CONFLICT", runStatus: "RESOLVED", outcome: "STRONG_IDENTIFIER_CONFLICT", resolution: "CREATE_NEW", currentIdentityInputHash: hash, checkedIdentityInputHash: hash })).toThrowError(/requires a unique-candidate/i);
    expect(() => assertAuthorConfirmation({ registrationStatus: "UNIQUE_CANDIDATE", runStatus: "RESOLVED", outcome: "UNIQUE_CANDIDATE", resolution: "CREATE_NEW", currentIdentityInputHash: "changed", checkedIdentityInputHash: hash })).toThrowError(/changed after the check/i);
  });

  it("creates an opaque non-semantic stable identifier", () => {
    expect(createStablePropertyIdentityId("123e4567-e89b-42d3-a456-426614174000")).toBe("IREPN-123E4567-E89B-42D3-A456-426614174000");
  });
});
