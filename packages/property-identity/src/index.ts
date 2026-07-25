import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

export type PropertyIdentitySubjectScope = "PROJECT" | "LAND_PARCEL" | "BUILDING" | "PREMISE" | "UNIT";
export type PropertyRegistrationStatus =
  | "DRAFT"
  | "READY_FOR_CHECK"
  | "CHECKING"
  | "NEEDS_CORRECTION"
  | "UNIQUE_CANDIDATE"
  | "EXACT_EXISTING"
  | "PROBABLE_DUPLICATE"
  | "STRONG_IDENTIFIER_CONFLICT"
  | "CONFIRMING"
  | "CANONICAL_CREATED"
  | "LINKED_EXISTING"
  | "CANCELLED"
  | "CLOSED";
export type PropertyIdentityCheckOutcome =
  | "EXACT_EXISTING"
  | "UNIQUE_CANDIDATE"
  | "PROBABLE_DUPLICATE"
  | "INSUFFICIENT_EVIDENCE"
  | "DIFFERENT_SUBJECT_SCOPE"
  | "DIFFERENT_UNIT_SAME_PROJECT"
  | "STRONG_IDENTIFIER_CONFLICT";
export type PropertyIdentityAuthorResolution = "CREATE_NEW" | "LINK_EXISTING";

const transitions: Readonly<Record<PropertyRegistrationStatus, readonly PropertyRegistrationStatus[]>> = {
  DRAFT: ["READY_FOR_CHECK", "CANCELLED"],
  READY_FOR_CHECK: ["CHECKING", "CANCELLED"],
  CHECKING: ["NEEDS_CORRECTION", "UNIQUE_CANDIDATE", "EXACT_EXISTING", "PROBABLE_DUPLICATE", "STRONG_IDENTIFIER_CONFLICT", "CANCELLED"],
  NEEDS_CORRECTION: ["READY_FOR_CHECK", "CANCELLED"],
  UNIQUE_CANDIDATE: ["CONFIRMING", "READY_FOR_CHECK", "CANCELLED"],
  EXACT_EXISTING: ["CONFIRMING", "READY_FOR_CHECK", "CANCELLED"],
  PROBABLE_DUPLICATE: ["READY_FOR_CHECK", "CANCELLED"],
  STRONG_IDENTIFIER_CONFLICT: ["READY_FOR_CHECK", "CANCELLED"],
  CONFIRMING: ["CANONICAL_CREATED", "LINKED_EXISTING", "READY_FOR_CHECK"],
  CANONICAL_CREATED: ["CLOSED"],
  LINKED_EXISTING: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
};

export class PropertyIdentityDomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export function assertRegistrationTransition(from: PropertyRegistrationStatus, to: PropertyRegistrationStatus) {
  if (!transitions[from].includes(to)) {
    throw new PropertyIdentityDomainError("INVALID_REGISTRATION_TRANSITION", `Registration cannot transition from ${from} to ${to}.`);
  }
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new PropertyIdentityDomainError("CANONICAL_VALUE_INVALID", "Unsupported canonical value.");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

export type IdentifierTuple = Readonly<{
  scheme: string;
  jurisdiction: string;
  authorityNamespace: string;
  subjectScope: PropertyIdentitySubjectScope;
  normalizedValue: string;
}>;

function normalizeRequired(value: string, field: string) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) throw new PropertyIdentityDomainError("IDENTIFIER_FIELD_REQUIRED", `${field} is required.`);
  if (normalized.length > 512) throw new PropertyIdentityDomainError("IDENTIFIER_FIELD_TOO_LONG", `${field} is too long.`);
  return normalized;
}

export function normalizeIdentifierValue(input: {
  rawValue?: string;
  normalizerId: "opaque-v1" | "alphanumeric-v1" | "composite-unit-v1";
  structuredComponents?: Record<string, unknown>;
}) {
  if (input.normalizerId === "opaque-v1") return normalizeRequired(input.rawValue ?? "", "rawValue");
  if (input.normalizerId === "alphanumeric-v1") {
    const value = normalizeRequired(input.rawValue ?? "", "rawValue").toLocaleUpperCase("und").replace(/[\s-]+/gu, "");
    if (!/^[\p{L}\p{N}./:]+$/u.test(value)) throw new PropertyIdentityDomainError("IDENTIFIER_FORMAT_INVALID", "Identifier contains unsupported characters.");
    return value;
  }
  const components = input.structuredComponents ?? {};
  const required = ["project", "building", "unit"] as const;
  const normalized = Object.fromEntries(required.map((field) => [field, normalizeRequired(String(components[field] ?? ""), field).toLocaleUpperCase("und")]));
  const phase = components.phase === undefined ? undefined : normalizeRequired(String(components.phase), "phase").toLocaleUpperCase("und");
  const floor = components.floor === undefined ? undefined : normalizeRequired(String(components.floor), "floor").toLocaleUpperCase("und");
  return canonicalize({ ...normalized, ...(phase ? { phase } : {}), ...(floor ? { floor } : {}) });
}

export function canonicalIdentifierTuple(tuple: IdentifierTuple) {
  return canonicalize({
    authorityNamespace: normalizeRequired(tuple.authorityNamespace, "authorityNamespace").toLocaleUpperCase("und"),
    jurisdiction: normalizeRequired(tuple.jurisdiction, "jurisdiction").toLocaleUpperCase("und"),
    normalizedValue: normalizeRequired(tuple.normalizedValue, "normalizedValue"),
    scheme: normalizeRequired(tuple.scheme, "scheme").toLocaleUpperCase("und"),
    subjectScope: tuple.subjectScope,
  });
}

export function digestIdentifier(tuple: IdentifierTuple, key: Buffer) {
  if (key.length < 32) throw new PropertyIdentityDomainError("DIGEST_KEY_INVALID", "Digest key must contain at least 32 bytes.");
  return createHmac("sha256", key).update(canonicalIdentifierTuple(tuple), "utf8").digest("hex");
}

export function identityInputHash(input: unknown) {
  return createHash("sha256").update(canonicalize(input), "utf8").digest("hex");
}

export type EncryptedIdentifier = Readonly<{ ciphertext: Buffer; nonce: Buffer; authTag: Buffer }>;

export function identifierAad(input: Omit<IdentifierTuple, "normalizedValue"> & { normalizerId: string; normalizerVersion: number; valueKind: "raw" | "normalized" }) {
  return Buffer.from(canonicalize(input), "utf8");
}

export function encryptIdentifier(value: string, key: Buffer, aad: Buffer, nonce = randomBytes(12)): EncryptedIdentifier {
  if (key.length !== 32) throw new PropertyIdentityDomainError("ENCRYPTION_KEY_INVALID", "AES-256-GCM key must contain 32 bytes.");
  if (nonce.length !== 12) throw new PropertyIdentityDomainError("ENCRYPTION_NONCE_INVALID", "AES-GCM nonce must contain 12 bytes.");
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext, nonce, authTag: cipher.getAuthTag() };
}

export function decryptIdentifier(value: EncryptedIdentifier, key: Buffer, aad: Buffer) {
  if (key.length !== 32 || value.nonce.length !== 12 || value.authTag.length !== 16) {
    throw new PropertyIdentityDomainError("ENCRYPTED_IDENTIFIER_INVALID", "Encrypted identifier shape is invalid.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, value.nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(value.authTag);
    return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new PropertyIdentityDomainError("ENCRYPTED_IDENTIFIER_AUTH_FAILED", "Encrypted identifier authentication failed.");
  }
}

export function advisoryLockKey(digest: string) {
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new PropertyIdentityDomainError("DIGEST_INVALID", "Digest must be a SHA-256 hex value.");
  return Buffer.from(digest.slice(0, 16), "hex").readBigInt64BE(0);
}

export function sortedAdvisoryLockKeys(digests: readonly string[]) {
  return [...new Set(digests.map(advisoryLockKey))].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export function assertAuthorConfirmation(input: {
  registrationStatus: PropertyRegistrationStatus;
  runStatus: "RESOLVED" | string;
  outcome: PropertyIdentityCheckOutcome | null;
  resolution: PropertyIdentityAuthorResolution;
  currentIdentityInputHash: string;
  checkedIdentityInputHash: string;
}) {
  if (input.runStatus !== "RESOLVED") throw new PropertyIdentityDomainError("CHECK_RUN_NOT_RESOLVED", "The identity check is not resolved.");
  if (input.currentIdentityInputHash !== input.checkedIdentityInputHash) throw new PropertyIdentityDomainError("CHECK_RUN_STALE", "Identity input changed after the check.");
  if (input.resolution === "CREATE_NEW" && (input.registrationStatus !== "UNIQUE_CANDIDATE" || input.outcome !== "UNIQUE_CANDIDATE")) {
    throw new PropertyIdentityDomainError("CREATE_NEW_NOT_ALLOWED", "A new identity requires a unique-candidate result.");
  }
  if (input.resolution === "LINK_EXISTING" && (input.registrationStatus !== "EXACT_EXISTING" || input.outcome !== "EXACT_EXISTING")) {
    throw new PropertyIdentityDomainError("LINK_EXISTING_NOT_ALLOWED", "Linking requires an exact-existing result.");
  }
}

export function createStablePropertyIdentityId(uuid = randomUUID()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new PropertyIdentityDomainError("IDENTITY_UUID_INVALID", "Property identity UUID must be RFC 4122 version 4.");
  }
  return `IREPN-${uuid.toUpperCase()}`;
}
