import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ActorAuthError,
  parseIfMatch,
  requestHash,
  validateIdempotencyKey,
  type ActorContext,
} from "@kvartal/auth";
import {
  assertAuthorConfirmation,
  createStablePropertyIdentityId,
  digestIdentifier,
  encryptIdentifier,
  identifierAad,
  identityInputHash,
  normalizeIdentifierValue,
  PropertyIdentityDomainError,
  sortedAdvisoryLockKeys,
  type IdentifierTuple,
  type PropertyIdentitySubjectScope,
} from "@kvartal/property-identity";
import {
  buildPublicTokenPayload,
  deterministicTokenId,
  encodeRegistryOperation,
  readChainConfig,
} from "@kvartal/web3";

type JsonObject = Record<string, unknown>;
type PartnerScope = Readonly<{ organizationId: string; officeId: string }>;

export type EffectivePropertyIdentityRollout = Readonly<{
  policyId: string | null;
  mode: "DISABLED" | "NEW_SUBMISSIONS_ONLY" | "STRICT";
  registryEnabled: boolean;
  publishGateEnabled: boolean;
  activationAt: Date | null;
}>;

type RolloutPolicyCandidate = Readonly<{
  id: string;
  scope: "GLOBAL" | "MARKET" | "ORGANISATION";
  organizationId: string | null;
  marketId: string | null;
  mode: "DISABLED" | "NEW_SUBMISSIONS_ONLY" | "STRICT";
  registryEnabled: boolean;
  publishGateEnabled: boolean;
  activationAt: Date | null;
  version: number;
  updatedAt: Date;
}>;

const disabledRollout: EffectivePropertyIdentityRollout = Object.freeze({
  policyId: null,
  mode: "DISABLED",
  registryEnabled: false,
  publishGateEnabled: false,
  activationAt: null,
});

export function selectEffectivePropertyIdentityRollout(
  candidates: readonly RolloutPolicyCandidate[],
  organizationId: string,
  marketId: string,
  now = new Date(),
): EffectivePropertyIdentityRollout {
  const specificity = (candidate: RolloutPolicyCandidate) => {
    if (candidate.scope === "ORGANISATION" && candidate.organizationId === organizationId && candidate.marketId === null) return 3;
    if (candidate.scope === "MARKET" && candidate.marketId === marketId && candidate.organizationId === null) return 2;
    if (candidate.scope === "GLOBAL" && candidate.organizationId === null && candidate.marketId === null) return 1;
    return 0;
  };
  const selected = candidates
    .filter((candidate) => specificity(candidate) > 0 && (!candidate.activationAt || candidate.activationAt <= now))
    .sort((left, right) => specificity(right) - specificity(left) || right.version - left.version || right.updatedAt.getTime() - left.updatedAt.getTime())[0];
  return selected ? {
    policyId: selected.id,
    mode: selected.mode,
    registryEnabled: selected.registryEnabled && selected.mode !== "DISABLED",
    publishGateEnabled: selected.publishGateEnabled && selected.mode !== "DISABLED",
    activationAt: selected.activationAt,
  } : disabledRollout;
}

export async function readEffectivePropertyIdentityRollout(
  prisma: PrismaClient,
  organizationId: string,
  marketId: string,
  now = new Date(),
) {
  const candidates = await prisma.propertyIdentityRolloutPolicy.findMany({
    where: {
      AND: [
        { OR: [
          { scope: "GLOBAL", organizationId: null, marketId: null },
          { scope: "ORGANISATION", organizationId, marketId: null },
          { scope: "MARKET", organizationId: null, marketId },
        ] },
        { OR: [{ activationAt: null }, { activationAt: { lte: now } }] },
      ],
    },
  });
  return selectEffectivePropertyIdentityRollout(candidates, organizationId, marketId, now);
}

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
  if (organizationId && officeId && organizationMemberships.some((membership) => membership.organizationId === organizationId)) {
    return { organizationId, officeId };
  }
  const candidate = officeMemberships[0] ?? actor.officeMemberships.find((membership) =>
    organizationMemberships.some((organization) => organization.organizationId === membership.organizationId),
  );
  if (!candidate || (officeId && candidate.officeId !== officeId) || (organizationId && candidate.organizationId !== organizationId)) {
    throw new ActorAuthError("FORBIDDEN", 403, "Property Identity access is not permitted for this organisation and office.");
  }
  return { organizationId: candidate.organizationId, officeId: candidate.officeId };
}

export function hasPartnerOrganizationAccess(actor: ActorContext, organizationId: string) {
  return actor.organizationMemberships.some((membership) =>
    membership.organizationId === organizationId &&
    membership.roles.some((role) => role === "organization_owner" || role === "organization_admin"),
  ) || actor.officeMemberships.some((membership) =>
    membership.organizationId === organizationId &&
    membership.roles.some((role) => role === "office_owner" || role === "office_admin"),
  );
}

function assertSubmissionAuthor(actor: ActorContext, createdByUserId: string) {
  if (actor.appUserId !== createdByUserId) {
    throw new ActorAuthError("FORBIDDEN", 403, "Only the author can process this registration submission.");
  }
}

function readKeyConfig(env: NodeJS.ProcessEnv) {
  const encryptionKey = Buffer.from(env.PROPERTY_IDENTITY_ENCRYPTION_KEY_BASE64 ?? "", "base64");
  const encryptionKeyVersion = env.PROPERTY_IDENTITY_ENCRYPTION_KEY_VERSION?.trim();
  if (encryptionKey.length !== 32) throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity encryption is not configured.");
  if (!encryptionKeyVersion) throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity encryption key version is not configured.");
  let digestKeys: Array<{ version: string; keyBase64: string }>;
  try {
    digestKeys = JSON.parse(env.PROPERTY_IDENTITY_DIGEST_KEYS_JSON ?? "[]") as Array<{ version: string; keyBase64: string }>;
  } catch {
    throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity digest keys are not configured.");
  }
  const keys = new Map(digestKeys.map((item) => [item.version, Buffer.from(item.keyBase64, "base64")]));
  if ([...keys.values()].some((key) => key.length < 32)) throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Property Identity digest key configuration is invalid.");
  return { encryptionKey, encryptionKeyVersion, digestKeys: keys };
}

function namespaceMatches(pattern: string, namespace: string) {
  const expected = pattern.trim().toLocaleUpperCase("und");
  const actual = namespace.trim().toLocaleUpperCase("und");
  return expected.endsWith("*") ? actual.startsWith(expected.slice(0, -1)) : actual === expected;
}

type AuthorityPolicyCandidate = Readonly<{
  id: string;
  organizationId: string | null;
  marketId: string | null;
  assetClass: string | null;
  identifierScheme: string;
  authorityNamespacePattern: string;
  normalizerId: string;
  normalizerVersion: number;
  automaticExactMatchAllowed: boolean;
  version: number;
}>;

export function selectAuthorityPolicy(input: {
  candidates: readonly AuthorityPolicyCandidate[];
  organizationId: string;
  marketId: string;
  assetClass: string;
  scheme: string;
  authorityNamespace: string;
}) {
  const specificity = (candidate: AuthorityPolicyCandidate) =>
    (candidate.organizationId === input.organizationId ? 4 : 0) +
    (candidate.marketId === input.marketId ? 2 : 0) +
    (candidate.assetClass === input.assetClass ? 1 : 0);
  return input.candidates
    .filter((candidate) =>
      (!candidate.organizationId || candidate.organizationId === input.organizationId) &&
      (!candidate.marketId || candidate.marketId === input.marketId) &&
      (!candidate.assetClass || candidate.assetClass === input.assetClass) &&
      candidate.identifierScheme.toLocaleUpperCase("und") === input.scheme &&
      namespaceMatches(candidate.authorityNamespacePattern, input.authorityNamespace))
    .sort((left, right) => specificity(right) - specificity(left) || right.version - left.version)[0];
}

function registrationIdentityHash(input: {
  identityInput: unknown;
  observations: ReadonlyArray<{
    id: string;
    scheme: string;
    subjectScope: string;
    jurisdiction: string;
    authorityNamespace: string;
    normalizerId: string;
    normalizerVersion: number;
    authorityPolicyVersion: number;
    status: string;
    digests: ReadonlyArray<{ digestKeyVersion: string; digest: string }>;
  }>;
}) {
  return identityInputHash({
    identityInput: input.identityInput,
    observations: input.observations
      .map((observation) => ({
        id: observation.id,
        scheme: observation.scheme,
        subjectScope: observation.subjectScope,
        jurisdiction: observation.jurisdiction,
        authorityNamespace: observation.authorityNamespace,
        normalizerId: observation.normalizerId,
        normalizerVersion: observation.normalizerVersion,
        authorityPolicyVersion: observation.authorityPolicyVersion,
        status: observation.status,
        digests: [...observation.digests].sort((left, right) => left.digestKeyVersion.localeCompare(right.digestKeyVersion)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
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
  const execute = () => input.prisma.$transaction(async (tx) => {
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await execute();
    } catch (caught) {
      if (!(caught instanceof Prisma.PrismaClientKnownRequestError) || caught.code !== "P2034" || attempt === 5) throw caught;
    }
  }
  throw new PropertyIdentityHttpError(503, "IDENTITY_TRANSACTION_RETRY_EXHAUSTED", "Property Identity transaction retry limit was reached.");
}

async function writeIdentifierObservations(input: {
  tx: Prisma.TransactionClient;
  submissionId: string;
  actorUserId: string;
  organizationId: string;
  marketId: string;
  assetClass: string;
  jurisdiction: string;
  subjectScope: PropertyIdentitySubjectScope;
  identifiers: readonly unknown[];
  policies: readonly AuthorityPolicyCandidate[];
  cryptoVersions: ReadonlyArray<{ version: string }>;
  digestKeys: ReadonlyMap<string, Buffer>;
  encryptionKey: Buffer;
  encryptionKeyVersion: string;
}) {
  let needsCorrection = false;
  for (const rawIdentifier of input.identifiers) {
    const identifier = typeof rawIdentifier === "object" && rawIdentifier !== null && !Array.isArray(rawIdentifier) ? rawIdentifier as JsonObject : {};
    const schemeInput = typeof identifier.scheme === "string" ? identifier.scheme.normalize("NFKC").trim() : "";
    const namespaceInput = typeof identifier.authorityNamespace === "string" ? identifier.authorityNamespace.normalize("NFKC").trim() : "";
    if (schemeInput.length > 64 || namespaceInput.length > 128) throw new PropertyIdentityHttpError(400, "IDENTIFIER_FIELD_TOO_LONG", "Identifier scheme or authority namespace is too long.");
    const scheme = schemeInput ? schemeInput.toLocaleUpperCase("und") : "UNRESOLVED";
    const authorityNamespace = namespaceInput ? namespaceInput.toLocaleUpperCase("und") : "UNRESOLVED";
    const policy = selectAuthorityPolicy({ candidates: input.policies, organizationId: input.organizationId, marketId: input.marketId, assetClass: input.assetClass, scheme, authorityNamespace });
    const rawValue = typeof identifier.rawValue === "string" ? identifier.rawValue : "";
    if (rawValue.length > 4096) throw new PropertyIdentityHttpError(400, "IDENTIFIER_FIELD_TOO_LONG", "Identifier raw value is too long.");
    const supportedNormalizer = policy?.normalizerId === "opaque-v1" || policy?.normalizerId === "alphanumeric-v1" || policy?.normalizerId === "composite-unit-v1";
    const normalizerId = supportedNormalizer ? policy.normalizerId : "unresolved";
    const normalizerVersion = policy?.normalizerVersion ?? 0;
    let normalizedValue = rawValue;
    let correctionReason: string | null = null;
    if (!schemeInput || !namespaceInput) correctionReason = "IDENTIFIER_NAMESPACE_REQUIRED";
    else if (!policy) correctionReason = "AUTHORITY_POLICY_NOT_FOUND";
    else if (!supportedNormalizer) correctionReason = "IDENTIFIER_NORMALIZER_UNSUPPORTED";
    else if (!policy.automaticExactMatchAllowed) correctionReason = "AUTOMATIC_EXACT_MATCH_NOT_ALLOWED";
    else {
      try {
        normalizedValue = normalizeIdentifierValue({
          rawValue,
          normalizerId: policy.normalizerId as "opaque-v1" | "alphanumeric-v1" | "composite-unit-v1",
          structuredComponents: typeof identifier.structuredComponents === "object" && identifier.structuredComponents !== null ? identifier.structuredComponents as Record<string, unknown> : undefined,
        });
      } catch (caught) {
        correctionReason = caught instanceof PropertyIdentityDomainError ? caught.code : "IDENTIFIER_FORMAT_INVALID";
      }
    }
    const tuple: IdentifierTuple = { scheme, jurisdiction: input.jurisdiction, authorityNamespace, subjectScope: input.subjectScope, normalizedValue };
    const rawAad = identifierAad({ scheme, jurisdiction: input.jurisdiction, authorityNamespace, subjectScope: input.subjectScope, normalizerId, normalizerVersion, valueKind: "raw" });
    const normalizedAad = identifierAad({ scheme, jurisdiction: input.jurisdiction, authorityNamespace, subjectScope: input.subjectScope, normalizerId, normalizerVersion, valueKind: "normalized" });
    const rawEncrypted = encryptIdentifier(rawValue, input.encryptionKey, rawAad);
    const normalizedEncrypted = encryptIdentifier(normalizedValue, input.encryptionKey, normalizedAad);
    if (correctionReason) needsCorrection = true;
    await input.tx.propertyIdentifierObservation.create({
      data: {
        submissionId: input.submissionId,
        createdByUserId: input.actorUserId,
        scheme,
        subjectScope: input.subjectScope,
        jurisdiction: input.jurisdiction,
        authorityNamespace,
        rawValueCiphertext: rawEncrypted.ciphertext,
        rawValueNonce: rawEncrypted.nonce,
        rawValueAuthTag: rawEncrypted.authTag,
        normalizedValueCiphertext: normalizedEncrypted.ciphertext,
        normalizedValueNonce: normalizedEncrypted.nonce,
        normalizedValueAuthTag: normalizedEncrypted.authTag,
        encryptionKeyVersion: input.encryptionKeyVersion,
        normalizerId,
        normalizerVersion,
        authorityPolicyVersion: policy?.version ?? 0,
        structuredComponents: identifier.structuredComponents as Prisma.InputJsonValue | undefined,
        sourceType: typeof identifier.sourceType === "string" ? identifier.sourceType : "manual",
        sourceDocumentId: typeof identifier.sourceDocumentId === "string" ? identifier.sourceDocumentId : null,
        sourceUrl: typeof identifier.sourceUrl === "string" ? identifier.sourceUrl : null,
        status: correctionReason ? "NEEDS_CORRECTION" : "READY",
        correctionReason,
        ...(correctionReason ? {} : { digests: { create: input.cryptoVersions.map((version) => ({ digestKeyVersion: version.version, digest: digestIdentifier(tuple, input.digestKeys.get(version.version)!) })) } }),
      },
    });
  }
  return needsCorrection;
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
  const identifiers = Array.isArray(input.body.identifiers) ? input.body.identifiers : [];
  if (identifiers.length > 20) throw new PropertyIdentityHttpError(400, "IDENTIFIER_LIMIT_EXCEEDED", "At most 20 identifiers are allowed.");

  const [office, market, cryptoVersions, policies] = await Promise.all([
    input.prisma.office.findFirst({ where: { id: scope.officeId, organizationId: scope.organizationId, status: "active" }, select: { id: true } }),
    input.prisma.market.findFirst({ where: { id: marketId, active: true }, select: { id: true } }),
    input.prisma.propertyIdentityCryptoKeyVersion.findMany({ where: { status: { in: ["ACTIVE", "RETIRING"] } } }),
    input.prisma.propertyIdentityAuthorityPolicy.findMany({
      where: {
        active: true,
        jurisdiction,
        subjectScope,
        OR: [{ assetClass: assetClass as never }, { assetClass: null }],
        effectiveFrom: { lte: new Date() },
        AND: [
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] },
          { OR: [{ organizationId: scope.organizationId }, { organizationId: null }] },
          { OR: [{ marketId }, { marketId: null }] },
        ],
      },
    }),
  ]);
  if (!office || !market) throw new PropertyIdentityHttpError(403, "PARTNER_SCOPE_INVALID", "The selected office or market is not available.");
  const rollout = await readEffectivePropertyIdentityRollout(input.prisma, scope.organizationId, marketId);
  if (!rollout.registryEnabled) throw new PropertyIdentityHttpError(409, "PROPERTY_IDENTITY_REGISTRY_DISABLED", "Property Identity registration is not enabled for this organisation and market.");
  const { encryptionKey, encryptionKeyVersion, digestKeys } = readKeyConfig(input.env);
  if (!cryptoVersions.length || !cryptoVersions.some((version) => version.version === encryptionKeyVersion) || cryptoVersions.some((version) => !digestKeys.has(version.version))) {
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
          lastIdentityInputHash: null,
        },
      });

      const needsCorrection = await writeIdentifierObservations({
        tx,
        submissionId: submission.id,
        actorUserId: input.actor.appUserId,
        organizationId: scope.organizationId,
        marketId,
        assetClass,
        jurisdiction,
        subjectScope,
        identifiers,
        policies,
        cryptoVersions,
        digestKeys,
        encryptionKey,
        encryptionKeyVersion,
      });
      const observations = await tx.propertyIdentifierObservation.findMany({ where: { submissionId: submission.id }, include: { digests: true } });
      const inputHash = registrationIdentityHash({ identityInput, observations });
      await tx.propertyRegistrationSubmission.update({
        where: { id: submission.id },
        data: { status: needsCorrection ? "NEEDS_CORRECTION" : "DRAFT", lastIdentityInputHash: inputHash, ...(needsCorrection ? { rowVersion: { increment: 1 } } : {}) },
      });
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

async function updateSubmission(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  request: IncomingMessage;
  submissionId: string;
  body: JsonObject;
  env: NodeJS.ProcessEnv;
}) {
  const scopeRecord = await input.prisma.propertyRegistrationSubmission.findUnique({
    where: { id: input.submissionId },
    select: { organizationId: true, officeId: true, marketId: true, createdByUserId: true, jurisdiction: true, subjectScope: true, assetClass: true },
  });
  if (!scopeRecord) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, scopeRecord);
  assertSubmissionAuthor(input.actor, scopeRecord.createdByUserId);
  const hasIdentityInput = typeof input.body.identityInput === "object" && input.body.identityInput !== null && !Array.isArray(input.body.identityInput);
  const hasIdentifiers = Array.isArray(input.body.identifiers);
  if (!hasIdentityInput && !hasIdentifiers) throw new PropertyIdentityHttpError(400, "IDENTITY_UPDATE_REQUIRED", "identityInput or identifiers is required.");
  const expectedVersion = parseIfMatch(input.request.headers["if-match"]);
  if (expectedVersion === null) throw new PropertyIdentityHttpError(409, "SUBMISSION_VERSION_CONFLICT", "A current quoted If-Match version is required.");
  const identifiers = hasIdentifiers ? input.body.identifiers as unknown[] : [];
  if (identifiers.length > 20) throw new PropertyIdentityHttpError(400, "IDENTIFIER_LIMIT_EXCEEDED", "At most 20 identifiers are allowed.");
  const { encryptionKey, encryptionKeyVersion, digestKeys } = readKeyConfig(input.env);
  const now = new Date();
  const [cryptoVersions, policies] = await Promise.all([
    input.prisma.propertyIdentityCryptoKeyVersion.findMany({ where: { status: { in: ["ACTIVE", "RETIRING"] } } }),
    input.prisma.propertyIdentityAuthorityPolicy.findMany({
      where: {
        active: true,
        jurisdiction: scopeRecord.jurisdiction,
        subjectScope: scopeRecord.subjectScope,
        OR: [{ assetClass: scopeRecord.assetClass }, { assetClass: null }],
        effectiveFrom: { lte: now },
        AND: [
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          { OR: [{ organizationId: scopeRecord.organizationId }, { organizationId: null }] },
          { OR: [{ marketId: scopeRecord.marketId }, { marketId: null }] },
        ],
      },
    }),
  ]);
  if (!cryptoVersions.length || !cryptoVersions.some((version) => version.version === encryptionKeyVersion) || cryptoVersions.some((version) => !digestKeys.has(version.version))) {
    throw new PropertyIdentityHttpError(503, "IDENTITY_CRYPTO_UNAVAILABLE", "Active Property Identity keys are not configured.");
  }
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scopeRecord.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}`,
    body: input.body,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.findUnique({ where: { id: input.submissionId } });
      if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
      if (["CANCELLED", "CLOSED", "CONFIRMING", "CANONICAL_CREATED", "LINKED_EXISTING"].includes(submission.status)) {
        throw new PropertyIdentityHttpError(409, "SUBMISSION_STATE_INVALID", "The submission cannot be edited in its current state.");
      }
      if (submission.rowVersion !== expectedVersion) throw new PropertyIdentityHttpError(409, "SUBMISSION_VERSION_CONFLICT", "The registration submission version is stale.");
      if (hasIdentifiers) {
        await tx.propertyIdentifierObservationDigest.deleteMany({ where: { observation: { submissionId: submission.id } } });
        await tx.propertyIdentifierObservation.deleteMany({ where: { submissionId: submission.id } });
        await writeIdentifierObservations({
          tx,
          submissionId: submission.id,
          actorUserId: input.actor.appUserId,
          organizationId: submission.organizationId,
          marketId: submission.marketId,
          assetClass: submission.assetClass,
          jurisdiction: submission.jurisdiction,
          subjectScope: submission.subjectScope,
          identifiers,
          policies,
          cryptoVersions,
          digestKeys,
          encryptionKey,
          encryptionKeyVersion,
        });
      }
      const identityInput = hasIdentityInput ? input.body.identityInput as Prisma.InputJsonObject : submission.identityInput;
      const identityInputForWrite = identityInput === null ? Prisma.JsonNull : identityInput as Prisma.InputJsonValue;
      const observations = await tx.propertyIdentifierObservation.findMany({ where: { submissionId: submission.id }, include: { digests: true } });
      const needsCorrection = observations.some((observation) => observation.status !== "READY");
      const identityHash = registrationIdentityHash({ identityInput, observations });
      const updated = await tx.propertyRegistrationSubmission.update({
        where: { id: submission.id },
        data: { identityInput: identityInputForWrite, lastIdentityInputHash: identityHash, status: needsCorrection ? "NEEDS_CORRECTION" : "DRAFT", rowVersion: { increment: 1 } },
      });
      await tx.propertyIdentityEvent.create({
        data: { submissionId: submission.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "SUBMISSION_IDENTITY_UPDATED", previousStatus: submission.status, nextStatus: updated.status },
      });
      return { status: 200, payload: { ok: true, submissionId: submission.id, status: updated.status, rowVersion: updated.rowVersion } };
    },
  });
}

async function runExactCheck(input: { prisma: PrismaClient; actor: ActorContext; request: IncomingMessage; submissionId: string; body: JsonObject }) {
  const scopeRecord = await input.prisma.propertyRegistrationSubmission.findUnique({
    where: { id: input.submissionId },
    select: { organizationId: true, officeId: true, createdByUserId: true },
  });
  if (!scopeRecord) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, scopeRecord);
  assertSubmissionAuthor(input.actor, scopeRecord.createdByUserId);
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scopeRecord.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}/check`,
    body: input.body,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.findUnique({
        where: { id: input.submissionId },
        include: { observations: { include: { digests: true } } },
      });
      if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
      if (["CANCELLED", "CLOSED", "CANONICAL_CREATED", "LINKED_EXISTING", "CONFIRMING"].includes(submission.status)) {
        throw new PropertyIdentityHttpError(409, "SUBMISSION_STATE_INVALID", "The submission cannot be checked in its current state.");
      }
      const readyObservations = submission.observations.filter((observation) => observation.status === "READY");
      const digests = readyObservations.flatMap((observation) => observation.digests.map((digest) => ({ ...digest, observationId: observation.id })));
      const inputHash = registrationIdentityHash({ identityInput: submission.identityInput, observations: submission.observations });
      const authorityPolicyVersion = Math.max(0, ...readyObservations.map((observation) => observation.authorityPolicyVersion));
      if (!digests.length || readyObservations.length !== submission.observations.length) {
        const run = await tx.propertyIdentityCheckRun.create({
          data: { submissionId: submission.id, status: "RESOLVED", outcome: "INSUFFICIENT_EVIDENCE", identityInputHash: inputHash, authorityPolicyVersion, completedAt: new Date(), redactedResult: { matchedProfiles: 0 } },
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
      else if (profileIds.length === 1 && matchedObservationIds.size === readyObservations.length) outcome = status = "EXACT_EXISTING";
      else outcome = status = "STRONG_IDENTIFIER_CONFLICT";
      const run = await tx.propertyIdentityCheckRun.create({
        data: {
          submissionId: submission.id,
          status: "RESOLVED",
          outcome,
          identityInputHash: inputHash,
          authorityPolicyVersion,
          completedAt: new Date(),
          redactedResult: { matchedProfiles: profileIds.length ? 1 : 0, matchedIdentifiers: matchedObservationIds.size, totalIdentifiers: readyObservations.length },
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

function optionalNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new PropertyIdentityHttpError(400, "NUMBER_INVALID", `${field} must be a finite number.`);
  return number;
}

function optionalInteger(value: unknown, field: string) {
  const number = optionalNumber(value, field);
  if (number !== undefined && !Number.isSafeInteger(number)) throw new PropertyIdentityHttpError(400, "INTEGER_INVALID", `${field} must be an integer.`);
  return number;
}

function web3Bytes32(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
    ? value.toLowerCase()
    : `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

async function queueAutomaticWeb3Publication(input: {
  tx: Prisma.TransactionClient;
  actor: ActorContext;
  identityProfileId: string;
  representationRight: {
    id: string;
    status: string;
    corporateWalletId: string | null;
    evidenceHash: string | null;
    validFrom: Date | null;
    validUntil: Date | null;
    createdAt: Date;
  };
}) {
  if (!["ATTESTED", "VERIFIED"].includes(input.representationRight.status)) {
    return { status: "DEFERRED_REPRESENTATION_NOT_ATTESTED" as const };
  }

  const config = readChainConfig();
  const contract = await input.tx.blockchainContractRegistry.findFirst({
    where: {
      chainId: config.chainId,
      contractType: "BEP721_PROPERTY_IDENTITY",
      active: true,
      status: "ACTIVE",
      platformRegistryWalletId: { not: null },
    },
    include: { platformRegistryWallet: true },
    orderBy: { createdAt: "desc" },
  });
  if (!contract?.platformRegistryWallet || contract.platformRegistryWallet.status !== "ACTIVE") {
    return { status: "DEFERRED_REGISTRY_NOT_READY" as const };
  }

  const profile = await input.tx.propertyIdentityProfile.findUnique({
    where: { id: input.identityProfileId },
    include: {
      canonicalVersions: { where: { isCurrent: true }, orderBy: { versionNumber: "desc" }, take: 1 },
      claims: { where: { status: "ACTIVE" }, orderBy: { id: "asc" } },
      originatorRecords: { where: { status: "RECORDED" }, take: 1 },
      token: true,
    },
  });
  if (!profile || profile.status !== "VERIFIED_INTERNAL" || !profile.canonicalVersions[0] || !profile.originatorRecords[0]) {
    return { status: "DEFERRED_IDENTITY_NOT_READY" as const };
  }

  let token = profile.token;
  let mintQueued = false;
  if (!token) {
    const tokenId = deterministicTokenId(profile.stableId).toString();
    const publicPayload = buildPublicTokenPayload({
      stablePropertyIdentityId: profile.stableId,
      canonicalVersionHash: web3Bytes32(profile.canonicalVersions[0].snapshotHash),
      evidencePackageHash: web3Bytes32(JSON.stringify(profile.claims.map((claim) => ({ id: claim.id, scheme: claim.scheme, status: claim.status })))),
    });
    const encodedCall = encodeRegistryOperation("MINT", {
      tokenId,
      to: contract.platformRegistryWallet.walletAddress,
      ...publicPayload,
      uri: "",
    });
    token = await input.tx.propertyIdentityToken.create({
      data: {
        identityProfileId: profile.id,
        tokenId: new Prisma.Decimal(tokenId),
        chainId: config.chainId,
        contractAddress: contract.contractAddress,
        platformRegistryWalletId: contract.platformRegistryWallet.id,
        ownerAddress: contract.platformRegistryWallet.walletAddress,
        status: "PENDING",
        reconciliationStatus: "PENDING",
      },
    });
    await input.tx.propertyTokenOperation.create({
      data: {
        tokenRecordId: token.id,
        identityProfileId: profile.id,
        operationType: "MINT",
        status: "PENDING_PLATFORM_SIGNER",
        payloadJson: {
          chainId: config.chainId,
          contractAddress: contract.contractAddress,
          registryAdminWallet: contract.platformRegistryWallet.walletAddress,
          targetAddress: contract.platformRegistryWallet.walletAddress,
          encodedCall,
          trigger: "AGENCY_PUBLICATION_AFTER_UNIQUENESS_CHECK",
        },
        idempotencyKey: `auto-mint:${contract.id}:${profile.id}`,
        requestedByUserId: input.actor.appUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    mintQueued = true;
  }

  if (token.status !== "ACTIVE" || !input.representationRight.corporateWalletId || !input.representationRight.evidenceHash) {
    return { status: mintQueued ? "MINT_QUEUED" as const : "TOKEN_PENDING" as const, tokenId: token.id };
  }

  const corporateWallet = await input.tx.organizationCorporateWallet.findUnique({ where: { id: input.representationRight.corporateWalletId } });
  if (!corporateWallet || corporateWallet.status !== "ACTIVE") return { status: "DEFERRED_WALLET_NOT_ACTIVE" as const, tokenId: token.id };
  const validFrom = Math.floor((input.representationRight.validFrom ?? input.representationRight.createdAt).getTime() / 1000);
  const validUntil = input.representationRight.validUntil ? Math.floor(input.representationRight.validUntil.getTime() / 1000) : 0;
  const evidenceHash = web3Bytes32(input.representationRight.evidenceHash);
  const encodedCall = encodeRegistryOperation("ATTEST_REPRESENTATION", {
    tokenId: token.tokenId.toFixed(0),
    agencyWallet: corporateWallet.walletAddress,
    evidenceHash,
    validFrom,
    validUntil,
  });
  await input.tx.propertyTokenRepresentation.upsert({
    where: { tokenRecordId_representationRightId: { tokenRecordId: token.id, representationRightId: input.representationRight.id } },
    update: { corporateWalletId: corporateWallet.id, walletAddress: corporateWallet.walletAddress, evidenceHash, status: "PENDING", validFrom: new Date(validFrom * 1000), validUntil: validUntil ? new Date(validUntil * 1000) : null },
    create: { tokenRecordId: token.id, identityProfileId: profile.id, representationRightId: input.representationRight.id, corporateWalletId: corporateWallet.id, walletAddress: corporateWallet.walletAddress, evidenceHash, status: "PENDING", validFrom: new Date(validFrom * 1000), validUntil: validUntil ? new Date(validUntil * 1000) : null },
  });
  await input.tx.propertyTokenOperation.upsert({
    where: { idempotencyKey: `representation-attest:${token.id}:${input.representationRight.id}` },
    update: {},
    create: {
      tokenRecordId: token.id,
      identityProfileId: profile.id,
      operationType: "ATTEST_REPRESENTATION",
      status: "PENDING_PLATFORM_SIGNER",
      payloadJson: { chainId: token.chainId, contractAddress: token.contractAddress, registryAdminWallet: token.ownerAddress, representationRightId: input.representationRight.id, agencyWallet: corporateWallet.walletAddress, evidenceHash, validFrom, validUntil, encodedCall, trigger: "AGENCY_PUBLICATION" },
      idempotencyKey: `representation-attest:${token.id}:${input.representationRight.id}`,
      requestedByUserId: input.actor.appUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { status: "REPRESENTATION_ATTESTATION_QUEUED" as const, tokenId: token.id };
}

async function writePartnerCommercialLayer(input: {
  tx: Prisma.TransactionClient;
  actor: ActorContext;
  identityProfileId: string;
  propertyObjectId: string;
  canonicalVersionId: string;
  organizationId: string;
  officeId: string;
  commercialInput: JsonObject;
  originator: boolean;
}) {
  const [corporateWallet, evidenceDocuments] = await Promise.all([
    input.tx.organizationCorporateWallet.findFirst({ where: { organizationId: input.organizationId, status: "ACTIVE" }, orderBy: { verifiedAt: "desc" } }),
    input.tx.propertyDocument.findMany({ where: { propertyObjectId: input.propertyObjectId, ownerOrganizationId: input.organizationId }, select: { id: true, checksum: true, documentType: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const evidenceHash = evidenceDocuments.length > 0 ? `0x${requestHash(evidenceDocuments.map((document) => ({ id: document.id, checksum: document.checksum, type: document.documentType })))}` : null;
  const canAttest = Boolean(corporateWallet && evidenceHash);
  if (input.commercialInput.requestPublication === true && !corporateWallet) throw new PropertyIdentityHttpError(409, "CORPORATE_WALLET_REQUIRED", "Connect and verify the agency corporate wallet before publication.");
  if (input.commercialInput.requestPublication === true && evidenceDocuments.length === 0) throw new PropertyIdentityHttpError(409, "REPRESENTATION_EVIDENCE_REQUIRED", "Attach representation evidence documents before publication.");
  if (input.originator) {
    await input.tx.propertyOriginatorRecord.upsert({
      where: {
        identityProfileId_organizationId_officeId: {
          identityProfileId: input.identityProfileId,
          organizationId: input.organizationId,
          officeId: input.officeId,
        },
      },
      update: { status: "RECORDED", revokedAt: null },
      create: {
        identityProfileId: input.identityProfileId,
        organizationId: input.organizationId,
        officeId: input.officeId,
        recordedByUserId: input.actor.appUserId,
      },
    });
  }

  const existingRight = await input.tx.propertyRepresentationRight.findFirst({
    where: {
      propertyObjectId: input.propertyObjectId,
      organizationId: input.organizationId,
      officeId: input.officeId,
      status: { in: ["DECLARED", "EVIDENCE_PENDING", "ATTESTED", "VERIFIED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const representationData = {
      propertyObjectId: input.propertyObjectId,
      identityProfileId: input.identityProfileId,
      organizationId: input.organizationId,
      officeId: input.officeId,
      corporateWalletId: corporateWallet?.id ?? null,
      rightType: typeof input.commercialInput.rightType === "string" ? input.commercialInput.rightType : "NON_EXCLUSIVE_SELLER_REPRESENTATIVE",
      status: canAttest ? "ATTESTED" as const : evidenceDocuments.length > 0 ? "DECLARED" as const : "EVIDENCE_PENDING" as const,
      scope: { source: "PARTNER_OBJECT_FORM", declaration: "PARTNER_DECLARED" },
      territory: typeof input.commercialInput.territory === "string" ? input.commercialInput.territory : null,
      channel: "KVARTAL_PARTNER_NETWORK",
      evidenceDocumentIds: evidenceDocuments.map((document) => document.id),
      evidenceHash,
      declaredByUserId: input.actor.appUserId,
      attestedAt: canAttest ? new Date() : null,
  };
  const representationRight = existingRight
    ? await input.tx.propertyRepresentationRight.update({ where: { id: existingRight.id }, data: representationData })
    : await input.tx.propertyRepresentationRight.create({ data: representationData });
  if (evidenceDocuments.length > 0) {
    await input.tx.representationEvidenceDocument.createMany({ data: evidenceDocuments.map((document) => ({ representationRightId: representationRight.id, propertyDocumentId: document.id, attachedByUserId: input.actor.appUserId })), skipDuplicates: true });
  }

  const priceAmount = optionalNumber(input.commercialInput.priceAmount, "commercialInput.priceAmount");
  const priceCurrency = typeof input.commercialInput.priceCurrency === "string" && ["RUB", "USD", "EUR", "GEL", "AMD", "AED"].includes(input.commercialInput.priceCurrency)
    ? input.commercialInput.priceCurrency as "RUB" | "USD" | "EUR" | "GEL" | "AMD" | "AED"
    : undefined;
  const existingOffer = await input.tx.partnerOffer.findFirst({
    where: { representationRightId: representationRight.id, status: { in: ["DRAFT", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
  });
  const offerData = {
    priceAmount,
    priceCurrency,
    availability: typeof input.commercialInput.availability === "string" ? input.commercialInput.availability : "available",
    commercialTerms: {
      priceDisplay: typeof input.commercialInput.priceDisplay === "string" ? input.commercialInput.priceDisplay : null,
      priceDisplayEn: typeof input.commercialInput.priceDisplayEn === "string" ? input.commercialInput.priceDisplayEn : null,
    },
    sourceLabel: "PARTNER_OBJECT_FORM",
    status: canAttest ? "ACTIVE" as const : "DRAFT" as const,
    createdByUserId: input.actor.appUserId,
  } as const;
  const offer = existingOffer
    ? await input.tx.partnerOffer.update({ where: { id: existingOffer.id }, data: offerData })
    : await input.tx.partnerOffer.create({
        data: {
          propertyObjectId: input.propertyObjectId,
          representationRightId: representationRight.id,
          sellerOrganizationId: input.organizationId,
          sellerOfficeId: input.officeId,
          ...offerData,
        },
      });

  if (input.commercialInput.requestPublication !== true) return { representationRight, offer, grants: [] };
  const siteConfigs = await input.tx.siteConfig.findMany({
    where: { organizationId: input.organizationId, officeId: input.officeId, active: true },
  });
  const networkSurface = await input.tx.propertyPublicationSurface.upsert({
    where: { tenantKey: `partner-network:${input.organizationId}:${input.officeId}` },
    update: { status: "ACTIVE", organizationId: input.organizationId, officeId: input.officeId },
    create: { tenantKey: `partner-network:${input.organizationId}:${input.officeId}`, surfaceType: "PARTNER_NETWORK", organizationId: input.organizationId, officeId: input.officeId, status: "ACTIVE" },
  });
  const publicationSurfaces = [networkSurface];
  for (const siteConfig of siteConfigs) {
    publicationSurfaces.push(await input.tx.propertyPublicationSurface.upsert({
      where: { siteConfigId: siteConfig.id },
      update: { status: "ACTIVE", canonicalHost: siteConfig.domain ?? siteConfig.subdomain },
      create: { siteConfigId: siteConfig.id, canonicalHost: siteConfig.domain ?? siteConfig.subdomain, surfaceType: "PARTNER_SITE", organizationId: siteConfig.organizationId, officeId: siteConfig.officeId },
    }));
  }
  const grants = [];
  for (const surface of publicationSurfaces) {
    const activeGrant = await input.tx.propertyPublicationGrant.findFirst({
      where: { publicationSurfaceId: surface.id, propertyObjectId: input.propertyObjectId, status: { in: ["DRAFT", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
    });
    const grantData = {
        publicationSurfaceId: surface.id,
        propertyObjectId: input.propertyObjectId,
        identityProfileId: input.identityProfileId,
        partnerOfferId: offer.id,
        canonicalVersionId: input.canonicalVersionId,
        buyerSideOrganizationId: input.organizationId,
        buyerSideOfficeId: input.officeId,
        sellerSideOrganizationId: input.organizationId,
        sellerSideOfficeId: input.officeId,
        status: representationRight.status === "ATTESTED" || representationRight.status === "VERIFIED" ? "ACTIVE" : "DRAFT",
    } as const;
    grants.push(activeGrant
      ? await input.tx.propertyPublicationGrant.update({ where: { id: activeGrant.id }, data: grantData })
      : await input.tx.propertyPublicationGrant.create({ data: grantData }));
  }
  const web3 = await queueAutomaticWeb3Publication({ tx: input.tx, actor: input.actor, identityProfileId: input.identityProfileId, representationRight });
  return { representationRight, offer, grants, web3 };
}

export async function publishPartnerProperty(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  propertyObjectId: string;
  organizationId: string;
  officeId: string;
  commercialInput: JsonObject;
}) {
  resolvePartnerScope(input.actor, { organizationId: input.organizationId, officeId: input.officeId });
  return input.prisma.$transaction(async (tx) => {
    const profile = await tx.propertyIdentityProfile.findUnique({
      where: { propertyObjectId: input.propertyObjectId },
      include: { canonicalVersions: { where: { isCurrent: true }, orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!profile || profile.status !== "VERIFIED_INTERNAL" || profile.canonicalVersions.length !== 1) {
      throw new PropertyIdentityHttpError(409, "PROPERTY_IDENTITY_VERIFICATION_REQUIRED", "The property must have one verified identity profile and one current canonical version before publication.");
    }
    return writePartnerCommercialLayer({
      tx,
      actor: input.actor,
      identityProfileId: profile.id,
      propertyObjectId: input.propertyObjectId,
      canonicalVersionId: profile.canonicalVersions[0].id,
      organizationId: input.organizationId,
      officeId: input.officeId,
      commercialInput: { ...input.commercialInput, requestPublication: true },
      originator: false,
    });
  });
}

export async function savePartnerPropertyOffer(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  propertyObjectId: string;
  organizationId: string;
  officeId: string;
  commercialInput: JsonObject;
}) {
  resolvePartnerScope(input.actor, { organizationId: input.organizationId, officeId: input.officeId });
  return input.prisma.$transaction(async (tx) => {
    const profile = await tx.propertyIdentityProfile.findUnique({
      where: { propertyObjectId: input.propertyObjectId },
      include: { canonicalVersions: { where: { isCurrent: true }, orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!profile || profile.status !== "VERIFIED_INTERNAL" || profile.canonicalVersions.length !== 1) {
      throw new PropertyIdentityHttpError(409, "PROPERTY_IDENTITY_VERIFICATION_REQUIRED", "The property must have one verified identity profile and one current canonical version before an agency offer can be saved.");
    }
    return writePartnerCommercialLayer({
      tx,
      actor: input.actor,
      identityProfileId: profile.id,
      propertyObjectId: input.propertyObjectId,
      canonicalVersionId: profile.canonicalVersions[0].id,
      organizationId: input.organizationId,
      officeId: input.officeId,
      commercialInput: { ...input.commercialInput, requestPublication: false },
      originator: false,
    });
  });
}

export async function withdrawPartnerProperty(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  propertyObjectId: string;
  organizationId: string;
  officeId: string;
}) {
  resolvePartnerScope(input.actor, { organizationId: input.organizationId, officeId: input.officeId });
  return input.prisma.$transaction(async (tx) => {
    const rights = await tx.propertyRepresentationRight.findMany({
      where: { propertyObjectId: input.propertyObjectId, organizationId: input.organizationId, officeId: input.officeId },
      select: { id: true },
    });
    const rightIds = rights.map((right) => right.id);
    if (rightIds.length) {
      await tx.propertyPublicationGrant.updateMany({ where: { partnerOffer: { representationRightId: { in: rightIds } }, status: "ACTIVE" }, data: { status: "REVOKED" } });
      await tx.partnerOffer.updateMany({ where: { representationRightId: { in: rightIds }, status: "ACTIVE" }, data: { status: "WITHDRAWN" } });
    }
    const activeOfferCount = await tx.partnerOffer.count({ where: { propertyObjectId: input.propertyObjectId, status: "ACTIVE", publicationGrants: { some: { status: "ACTIVE" } } } });
    if (activeOfferCount === 0) await tx.propertyObject.update({ where: { id: input.propertyObjectId }, data: { status: "draft", visibility: "private", publishedAt: null, canBeShownByOtherOffices: false } });
    return { withdrawnOffers: rightIds.length, activeOfferCount };
  });
}

async function confirmSubmission(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  request: IncomingMessage;
  submissionId: string;
  body: JsonObject;
  resolution: "CREATE_NEW" | "LINK_EXISTING";
}) {
  const scopeRecord = await input.prisma.propertyRegistrationSubmission.findUnique({
    where: { id: input.submissionId },
    select: { organizationId: true, officeId: true, createdByUserId: true },
  });
  if (!scopeRecord) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, scopeRecord);
  assertSubmissionAuthor(input.actor, scopeRecord.createdByUserId);
  const checkRunId = requiredString(input.body.checkRunId, "checkRunId", 128);
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scopeRecord.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}/${input.resolution === "CREATE_NEW" ? "confirm-create" : "confirm-link"}`,
    body: input.body,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.findUnique({
        where: { id: input.submissionId },
        include: {
          observations: { include: { digests: true } },
          checkRuns: { where: { id: checkRunId }, take: 1 },
        },
      });
      if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
      const checkRun = submission.checkRuns[0];
      if (!checkRun) throw new PropertyIdentityHttpError(409, "CHECK_RUN_NOT_FOUND", "The selected identity check was not found.");
      const latestCheckRun = await tx.propertyIdentityCheckRun.findFirst({
        where: { submissionId: submission.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      if (latestCheckRun?.id !== checkRun.id) throw new PropertyIdentityHttpError(409, "CHECK_RUN_STALE", "A newer identity check exists. Confirm the latest check result.");
      const currentHash = registrationIdentityHash({ identityInput: submission.identityInput, observations: submission.observations });
      assertAuthorConfirmation({
        registrationStatus: submission.status,
        runStatus: checkRun.status,
        outcome: checkRun.outcome,
        resolution: input.resolution,
        currentIdentityInputHash: currentHash,
        checkedIdentityInputHash: checkRun.identityInputHash,
      });
      const observationDigests = submission.observations.flatMap((observation) => observation.digests);
      if (!observationDigests.length || submission.observations.some((observation) => observation.status !== "READY")) {
        throw new PropertyIdentityHttpError(409, "IDENTIFIERS_REQUIRED", "All authoritative identifiers must be ready and checked.");
      }
      for (const lockKey of sortedAdvisoryLockKeys(observationDigests.map((digest) => digest.digest))) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
      }
      const aliases = await tx.propertyIdentifierClaimDigest.findMany({
        where: { active: true, OR: observationDigests.map((digest) => ({ digestKeyVersion: digest.digestKeyVersion, digest: digest.digest })) },
        include: { claim: { include: { identityProfile: true } } },
      });
      const matchedProfileIds = [...new Set(aliases.map((alias) => alias.claim.identityProfileId))];

      if (input.resolution === "CREATE_NEW") {
        if (matchedProfileIds.length) throw new PropertyIdentityHttpError(409, "IDENTITY_CHANGED_RECHECK_REQUIRED", "An existing identity was found during finalisation. Run the check again.");
        const physical = submission.identityInput as JsonObject;
        const migrationObject = submission.migrationSourcePropertyObjectId ? await tx.propertyObject.findFirst({
          where: {
            id: submission.migrationSourcePropertyObjectId,
            ownerOrganizationId: submission.organizationId,
            ownerOfficeId: submission.officeId,
            identityProfile: null,
          },
        }) : null;
        if (submission.migrationSourcePropertyObjectId && !migrationObject) {
          throw new PropertyIdentityHttpError(409, "MIGRATION_SOURCE_UNAVAILABLE", "The migration source object is no longer eligible for registration.");
        }
        const propertyObject = migrationObject ?? await tx.propertyObject.create({
          data: {
            ownerOrganizationId: submission.organizationId,
            ownerOfficeId: submission.officeId,
            informationOwnerOrganizationId: submission.organizationId,
            informationOwnerOfficeId: submission.officeId,
            createdByUserId: input.actor.appUserId,
            marketId: submission.marketId,
            status: "draft",
            visibility: "private",
            assetClass: submission.assetClass,
            assetSubtype: typeof physical.assetSubtype === "string" ? physical.assetSubtype : null,
            addressPrivate: typeof physical.addressPrivate === "string" ? physical.addressPrivate : null,
            areaSqm: optionalNumber(physical.areaSqm, "identityInput.areaSqm"),
            landAreaSqm: optionalNumber(physical.landAreaSqm, "identityInput.landAreaSqm"),
            buildingAreaSqm: optionalNumber(physical.buildingAreaSqm, "identityInput.buildingAreaSqm"),
            rentableAreaSqm: optionalNumber(physical.rentableAreaSqm, "identityInput.rentableAreaSqm"),
            floorNumber: optionalInteger(physical.floorNumber, "identityInput.floorNumber"),
            floorsTotal: optionalInteger(physical.floorsTotal, "identityInput.floorsTotal"),
            roomsCount: optionalInteger(physical.roomsCount, "identityInput.roomsCount"),
            bedroomsCount: optionalInteger(physical.bedroomsCount, "identityInput.bedroomsCount"),
            bathroomsCount: optionalInteger(physical.bathroomsCount, "identityInput.bathroomsCount"),
            representationSide: "originator",
            exclusivity: "unknown",
            canBeShownByOtherOffices: false,
            ...(typeof physical.title === "string" && physical.title.trim() && typeof physical.addressDisplay === "string" && physical.addressDisplay.trim() ? {
              localizations: {
                create: [
                  {
                    language: "ru",
                    title: physical.title.trim(),
                    description: typeof physical.description === "string" ? physical.description.trim() || null : null,
                    addressDisplay: physical.addressDisplay.trim(),
                  },
                  ...(typeof physical.titleEn === "string" && physical.titleEn.trim() ? [{
                    language: "en" as const,
                    title: physical.titleEn.trim(),
                    description: typeof physical.descriptionEn === "string" ? physical.descriptionEn.trim() || null : null,
                    addressDisplay: typeof physical.addressDisplayEn === "string" ? physical.addressDisplayEn.trim() || physical.addressDisplay.trim() : physical.addressDisplay.trim(),
                  }] : []),
                ],
              },
            } : {}),
          },
        });
        const profile = await tx.propertyIdentityProfile.create({
          data: {
            stableId: createStablePropertyIdentityId(),
            propertyObjectId: propertyObject.id,
            createdFromSubmissionId: submission.id,
            subjectScope: submission.subjectScope,
            jurisdiction: submission.jurisdiction,
            status: "PROVISIONAL",
          },
        });
        const confirmation = await tx.propertyIdentityAuthorConfirmation.create({
          data: {
            submissionId: submission.id,
            checkRunId: checkRun.id,
            identityProfileId: profile.id,
            confirmedByUserId: input.actor.appUserId,
            resolution: "CREATE_NEW",
            identityInputHash: currentHash,
            reason: typeof input.body.reason === "string" ? input.body.reason.trim() || null : null,
          },
        });
        const canonicalSnapshot: Prisma.InputJsonObject = {
          subjectScope: submission.subjectScope,
          jurisdiction: submission.jurisdiction,
          assetClass: submission.assetClass,
          physical: physical as Prisma.InputJsonObject,
          observations: submission.observations.map((observation) => ({ id: observation.id, scheme: observation.scheme, authorityNamespace: observation.authorityNamespace, normalizerId: observation.normalizerId, normalizerVersion: observation.normalizerVersion })),
        };
        const canonicalVersion = await tx.propertyCanonicalVersion.create({
          data: {
            identityProfileId: profile.id,
            versionNumber: 1,
            snapshotSchemaVersion: 1,
            snapshotJson: canonicalSnapshot,
            snapshotHash: identityInputHash(canonicalSnapshot),
            authorConfirmationId: confirmation.id,
            createdByUserId: input.actor.appUserId,
          },
        });
        for (const observation of submission.observations) {
          await tx.propertyIdentifierClaim.create({
            data: {
              identityProfileId: profile.id,
              originObservationId: observation.id,
              scheme: observation.scheme,
              subjectScope: observation.subjectScope,
              jurisdiction: observation.jurisdiction,
              authorityNamespace: observation.authorityNamespace,
              normalizedValueCiphertext: observation.normalizedValueCiphertext,
              normalizedValueNonce: observation.normalizedValueNonce,
              normalizedValueAuthTag: observation.normalizedValueAuthTag,
              encryptionKeyVersion: observation.encryptionKeyVersion,
              normalizerId: observation.normalizerId,
              normalizerVersion: observation.normalizerVersion,
              digests: { create: observation.digests.map((digest) => ({ digestKeyVersion: digest.digestKeyVersion, digest: digest.digest, active: true })) },
            },
          });
        }
        await tx.propertyIdentifierObservation.updateMany({ where: { submissionId: submission.id, status: "READY" }, data: { status: "ACCEPTED" } });
        await tx.propertyIdentityProfile.update({ where: { id: profile.id }, data: { status: "VERIFIED_INTERNAL" } });
        const commercialInput = typeof input.body.commercialInput === "object" && input.body.commercialInput !== null ? input.body.commercialInput as JsonObject : {};
        const commercial = await writePartnerCommercialLayer({
          tx,
          actor: input.actor,
          identityProfileId: profile.id,
          propertyObjectId: propertyObject.id,
          canonicalVersionId: canonicalVersion.id,
          organizationId: submission.organizationId,
          officeId: submission.officeId,
          commercialInput,
          originator: true,
        });
        await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { status: "CLOSED", canonicalPropertyObjectId: propertyObject.id, closedAt: new Date(), rowVersion: { increment: 1 } } });
        await tx.propertyIdentityEvent.create({
          data: { submissionId: submission.id, identityProfileId: profile.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "AUTHOR_CONFIRMED_CREATE", previousStatus: submission.status, nextStatus: "CLOSED", payload: { checkRunId: checkRun.id, propertyObjectId: propertyObject.id } },
        });
        return { status: 201, payload: { ok: true, submissionId: submission.id, status: "CLOSED", resolution: "CREATE_NEW", propertyObjectId: propertyObject.id, propertyIdentityId: profile.stableId, representationRightId: commercial.representationRight.id, offerId: commercial.offer.id } };
      }

      if (matchedProfileIds.length !== 1) throw new PropertyIdentityHttpError(409, "IDENTITY_CHANGED_RECHECK_REQUIRED", "The exact identity result changed. Run the check again.");
      const matchedKeys = new Set(aliases.map((alias) => `${alias.digestKeyVersion}:${alias.digest}`));
      if (observationDigests.some((digest) => !matchedKeys.has(`${digest.digestKeyVersion}:${digest.digest}`))) {
        throw new PropertyIdentityHttpError(409, "IDENTITY_CHANGED_RECHECK_REQUIRED", "Not all authoritative identifiers resolve to the same identity.");
      }
      const profile = await tx.propertyIdentityProfile.findUnique({ where: { id: matchedProfileIds[0] } });
      if (!profile || profile.status !== "VERIFIED_INTERNAL") throw new PropertyIdentityHttpError(409, "IDENTITY_LINK_UNAVAILABLE", "The existing identity is not available for linking.");
      await tx.propertyIdentityAuthorConfirmation.create({
        data: {
          submissionId: submission.id,
          checkRunId: checkRun.id,
          identityProfileId: profile.id,
          confirmedByUserId: input.actor.appUserId,
          resolution: "LINK_EXISTING",
          identityInputHash: currentHash,
          reason: typeof input.body.reason === "string" ? input.body.reason.trim() || null : null,
        },
      });
      await tx.propertyIdentifierObservation.updateMany({ where: { submissionId: submission.id, status: "READY" }, data: { status: "ACCEPTED" } });
      const canonicalVersion = await tx.propertyCanonicalVersion.findFirst({
        where: { identityProfileId: profile.id, isCurrent: true },
        orderBy: { versionNumber: "desc" },
      });
      if (!canonicalVersion) throw new PropertyIdentityHttpError(409, "CANONICAL_VERSION_UNAVAILABLE", "The canonical property version is unavailable.");
      const commercialInput = typeof input.body.commercialInput === "object" && input.body.commercialInput !== null ? input.body.commercialInput as JsonObject : {};
      const commercial = await writePartnerCommercialLayer({
        tx,
        actor: input.actor,
        identityProfileId: profile.id,
        propertyObjectId: profile.propertyObjectId,
        canonicalVersionId: canonicalVersion.id,
        organizationId: submission.organizationId,
        officeId: submission.officeId,
        commercialInput,
        originator: false,
      });
      await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { status: "CLOSED", canonicalPropertyObjectId: profile.propertyObjectId, closedAt: new Date(), rowVersion: { increment: 1 } } });
      await tx.propertyIdentityEvent.create({
        data: { submissionId: submission.id, identityProfileId: profile.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "AUTHOR_CONFIRMED_LINK", previousStatus: submission.status, nextStatus: "CLOSED", payload: { checkRunId: checkRun.id, propertyObjectId: profile.propertyObjectId } },
      });
      return { status: 200, payload: { ok: true, submissionId: submission.id, status: "CLOSED", resolution: "LINK_EXISTING", propertyObjectId: profile.propertyObjectId, propertyIdentityId: profile.stableId, representationRightId: commercial.representationRight.id, offerId: commercial.offer.id } };
    },
  });
}

export async function createPropertyFromUnifiedIngress(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  request: IncomingMessage;
  organizationId: string;
  officeId: string;
  marketId: string;
  jurisdiction: string;
  subjectScope: PropertyIdentitySubjectScope;
  assetClass: string;
  identityInput: JsonObject;
  identifiers: JsonObject[];
  commercialInput: JsonObject;
  env?: NodeJS.ProcessEnv;
}) {
  const submissionBody: JsonObject = {
    organizationId: input.organizationId,
    officeId: input.officeId,
    marketId: input.marketId,
    jurisdiction: input.jurisdiction,
    subjectScope: input.subjectScope,
    assetClass: input.assetClass,
    identityInput: input.identityInput,
    identifiers: input.identifiers,
  };
  const created = await createSubmission({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    body: submissionBody,
    env: input.env ?? process.env,
  });
  const submissionId = typeof created.payload.submissionId === "string" ? created.payload.submissionId : null;
  if (!submissionId) return created;
  if (created.payload.status === "NEEDS_CORRECTION") {
    throw new PropertyIdentityHttpError(409, "IDENTIFIER_CORRECTION_REQUIRED", "The official property identifier must be corrected before the object can be saved.");
  }

  const checked = await runExactCheck({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    submissionId,
    body: {},
  });
  const checkRunId = typeof checked.payload.checkRunId === "string" ? checked.payload.checkRunId : null;
  const outcome = checked.payload.outcome;
  if (!checkRunId || (outcome !== "UNIQUE_CANDIDATE" && outcome !== "EXACT_EXISTING")) {
    throw new PropertyIdentityHttpError(409, "PROPERTY_IDENTITY_REVIEW_REQUIRED", "The property identity could not be resolved automatically.");
  }

  return confirmSubmission({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    submissionId,
    body: { checkRunId, commercialInput: input.commercialInput },
    resolution: outcome === "EXACT_EXISTING" ? "LINK_EXISTING" : "CREATE_NEW",
  });
}

async function cancelSubmission(input: { prisma: PrismaClient; actor: ActorContext; request: IncomingMessage; submissionId: string; body: JsonObject }) {
  const scopeRecord = await input.prisma.propertyRegistrationSubmission.findUnique({
    where: { id: input.submissionId },
    select: { organizationId: true, officeId: true, createdByUserId: true },
  });
  if (!scopeRecord) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, scopeRecord);
  assertSubmissionAuthor(input.actor, scopeRecord.createdByUserId);
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scopeRecord.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}/cancel`,
    body: input.body,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.findUnique({ where: { id: input.submissionId } });
      if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
      if (submission.status === "CANCELLED") return { status: 200, payload: { ok: true, submissionId: submission.id, status: "CANCELLED" } };
      if (["CLOSED", "CONFIRMING", "CANONICAL_CREATED", "LINKED_EXISTING"].includes(submission.status)) {
        throw new PropertyIdentityHttpError(409, "SUBMISSION_STATE_INVALID", "The submission can no longer be cancelled.");
      }
      const updated = await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { status: "CANCELLED", cancelledAt: new Date(), rowVersion: { increment: 1 } } });
      await tx.propertyIdentityEvent.create({
        data: { submissionId: submission.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "SUBMISSION_CANCELLED", previousStatus: submission.status, nextStatus: "CANCELLED", reasonCode: typeof input.body.reason === "string" ? input.body.reason.trim().slice(0, 128) || null : null },
      });
      return { status: 200, payload: { ok: true, submissionId: submission.id, status: updated.status, rowVersion: updated.rowVersion } };
    },
  });
}

export async function recordPropertyIdentityDriveDraft(input: {
  prisma: PrismaClient;
  actor: ActorContext;
  request: IncomingMessage;
  submissionId: string;
  driveFolderUrl: string;
  fileRefs: string[];
  extracted: JsonObject;
  confidence: "high" | "medium" | "low";
  missingFields: string[];
}) {
  const scopeRecord = await input.prisma.propertyRegistrationSubmission.findUnique({
    where: { id: input.submissionId },
    select: { organizationId: true, officeId: true, createdByUserId: true },
  });
  if (!scopeRecord) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, scopeRecord);
  assertSubmissionAuthor(input.actor, scopeRecord.createdByUserId);
  const requestBody = { driveFolderUrl: input.driveFolderUrl, fileRefs: input.fileRefs };
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scopeRecord.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}/process-drive-folder`,
    body: requestBody,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.findUnique({ where: { id: input.submissionId } });
      if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
      if (["CANCELLED", "CLOSED", "CONFIRMING", "CANONICAL_CREATED", "LINKED_EXISTING"].includes(submission.status)) {
        throw new PropertyIdentityHttpError(409, "SUBMISSION_STATE_INVALID", "Drive intake cannot update this submission.");
      }
      const allowedDraftFields = ["title", "titleEn", "description", "descriptionEn", "addressDisplay", "addressDisplayEn", "assetClass", "assetSubtype", "areaSqm", "landAreaSqm", "buildingAreaSqm", "roomsCount", "bedroomsCount", "floorNumber", "floorsTotal", "priceAmount", "priceCurrency", "priceDisplay", "priceDisplayEn", "tags", "tagsEn", "confidence"];
      const safeExtracted = Object.fromEntries(allowedDraftFields.filter((field) => input.extracted[field] !== undefined).map((field) => [field, input.extracted[field]])) as JsonObject;
      const intake = await tx.propertyIntakeSubmission.create({
        data: {
          organizationId: submission.organizationId,
          officeId: submission.officeId,
          createdByUserId: input.actor.appUserId,
          sourceType: "file",
          fileRefs: input.fileRefs,
          status: input.missingFields.length ? "needs_clarification" : "draft_ready",
        },
      });
      const draft = await tx.propertyAIDraft.create({
        data: {
          intakeSubmissionId: intake.id,
          organizationId: submission.organizationId,
          officeId: submission.officeId,
          createdByUserId: input.actor.appUserId,
          proposedAssetClass: typeof safeExtracted.assetClass === "string" ? safeExtracted.assetClass as never : null,
          proposedPropertyObject: safeExtracted as Prisma.InputJsonObject,
          confidence: input.confidence,
          fieldConfidence: { overall: safeExtracted.confidence ?? null },
          missingFields: input.missingFields,
          conflicts: [],
          clarificationQuestions: input.missingFields.map((field) => `Confirm ${field}`),
          verificationSummary: { source: "google_drive", driveFolderUrl: input.driveFolderUrl, fileCount: input.fileRefs.length },
          status: input.missingFields.length ? "needs_clarification" : "draft",
        },
      });
      const updated = await tx.propertyRegistrationSubmission.update({
        where: { id: submission.id },
        data: { intakeSubmissionId: intake.id, aiDraftId: draft.id, rowVersion: { increment: 1 } },
      });
      await tx.propertyAIExtractionEvent.create({
        data: { intakeSubmissionId: intake.id, draftId: draft.id, organizationId: submission.organizationId, officeId: submission.officeId, actorUid: input.actor.subject, eventType: "PROPERTY_IDENTITY_DRIVE_DRAFT_CREATED", payload: { submissionId: submission.id, missingFields: input.missingFields, fileCount: input.fileRefs.length } },
      });
      await tx.propertyIdentityEvent.create({
        data: { submissionId: submission.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "DRIVE_AI_DRAFT_CREATED", previousStatus: submission.status, nextStatus: submission.status, payload: { intakeSubmissionId: intake.id, aiDraftId: draft.id } },
      });
      return { status: 200, payload: { ok: true, submissionId: submission.id, aiDraftId: draft.id, rowVersion: updated.rowVersion, missingFields: input.missingFields } };
    },
  });
}

async function applyAiDraft(input: { prisma: PrismaClient; actor: ActorContext; request: IncomingMessage; submissionId: string; body: JsonObject }) {
  const scopeRecord = await input.prisma.propertyRegistrationSubmission.findUnique({ where: { id: input.submissionId }, select: { organizationId: true, officeId: true, createdByUserId: true } });
  if (!scopeRecord) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(input.actor, scopeRecord);
  assertSubmissionAuthor(input.actor, scopeRecord.createdByUserId);
  const expectedVersion = parseIfMatch(input.request.headers["if-match"]);
  if (expectedVersion === null) throw new PropertyIdentityHttpError(409, "SUBMISSION_VERSION_CONFLICT", "A current quoted If-Match version is required.");
  return idempotentMutation({
    prisma: input.prisma,
    actor: input.actor,
    request: input.request,
    organizationId: scopeRecord.organizationId,
    route: `/api/v1/admin/property-identity/submissions/${input.submissionId}/apply-ai-draft`,
    body: input.body,
    run: async (tx) => {
      const submission = await tx.propertyRegistrationSubmission.findUnique({ where: { id: input.submissionId }, include: { aiDraft: true, observations: { include: { digests: true } } } });
      if (!submission?.aiDraft || !submission.aiDraftId) throw new PropertyIdentityHttpError(409, "AI_DRAFT_NOT_FOUND", "No AI draft is available for this submission.");
      if (submission.rowVersion !== expectedVersion) throw new PropertyIdentityHttpError(409, "SUBMISSION_VERSION_CONFLICT", "The registration submission version is stale.");
      if (["CANCELLED", "CLOSED", "CONFIRMING", "CANONICAL_CREATED", "LINKED_EXISTING"].includes(submission.status)) throw new PropertyIdentityHttpError(409, "SUBMISSION_STATE_INVALID", "The AI draft cannot be applied in this state.");
      const proposed = typeof submission.aiDraft.proposedPropertyObject === "object" && submission.aiDraft.proposedPropertyObject !== null && !Array.isArray(submission.aiDraft.proposedPropertyObject) ? submission.aiDraft.proposedPropertyObject as JsonObject : {};
      const current = typeof submission.identityInput === "object" && submission.identityInput !== null && !Array.isArray(submission.identityInput) ? submission.identityInput as JsonObject : {};
      const allowedFields = ["title", "titleEn", "description", "descriptionEn", "addressDisplay", "addressDisplayEn", "assetSubtype", "areaSqm", "landAreaSqm", "buildingAreaSqm", "roomsCount", "bedroomsCount", "floorNumber", "floorsTotal"];
      const accepted = Object.fromEntries(allowedFields.filter((field) => proposed[field] !== null && proposed[field] !== undefined).map((field) => [field, proposed[field]]));
      const identityInput = { ...current, ...accepted, ...(typeof proposed.addressDisplay === "string" ? { addressPrivate: proposed.addressDisplay } : {}) };
      const identityHash = registrationIdentityHash({ identityInput, observations: submission.observations });
      const needsCorrection = submission.observations.some((observation) => observation.status !== "READY");
      const updated = await tx.propertyRegistrationSubmission.update({ where: { id: submission.id }, data: { identityInput, lastIdentityInputHash: identityHash, status: needsCorrection ? "NEEDS_CORRECTION" : "DRAFT", rowVersion: { increment: 1 } } });
      await tx.propertyAIDraft.update({ where: { id: submission.aiDraftId }, data: { status: "approved" } });
      if (submission.intakeSubmissionId) await tx.propertyIntakeSubmission.update({ where: { id: submission.intakeSubmissionId }, data: { status: "confirmed" } });
      await tx.propertyIdentityEvent.create({ data: { submissionId: submission.id, actorUserId: input.actor.appUserId, actorOrganizationId: submission.organizationId, actorOfficeId: submission.officeId, eventType: "DRIVE_AI_DRAFT_APPLIED_BY_AUTHOR", previousStatus: submission.status, nextStatus: updated.status, payload: { aiDraftId: submission.aiDraftId, acceptedFields: Object.keys(accepted) } } });
      return { status: 200, payload: { ok: true, submissionId: submission.id, status: updated.status, rowVersion: updated.rowVersion, acceptedFields: Object.keys(accepted) } };
    },
  });
}

async function listSubmissions(prisma: PrismaClient, actor: ActorContext, url: URL) {
  const scope = resolvePartnerScope(actor, { organizationId: url.searchParams.get("organizationId") ?? undefined, officeId: url.searchParams.get("officeId") ?? undefined });
  const submissions = await prisma.propertyRegistrationSubmission.findMany({
    where: { organizationId: scope.organizationId, officeId: scope.officeId, createdByUserId: actor.appUserId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100),
    select: { id: true, status: true, subjectScope: true, jurisdiction: true, assetClass: true, canonicalPropertyObjectId: true, rowVersion: true, createdAt: true, updatedAt: true },
  });
  return { ok: true, submissions };
}

async function getPropertyIdentityContext(prisma: PrismaClient, actor: ActorContext) {
  const organisationAdminIds = new Set(actor.organizationMemberships
    .filter((membership) => membership.roles.some((role) => role === "organization_owner" || role === "organization_admin"))
    .map((membership) => membership.organizationId));
  const scopeKeys = new Set<string>();
  const explicitScopes = actor.officeMemberships
    .filter((membership) => organisationAdminIds.has(membership.organizationId) || membership.roles.some((role) => role === "office_owner" || role === "office_admin" || role === "broker"))
    .filter((membership) => {
      const key = `${membership.organizationId}:${membership.officeId}`;
      if (scopeKeys.has(key)) return false;
      scopeKeys.add(key);
      return true;
    });
  if (!explicitScopes.length && !organisationAdminIds.size) throw new ActorAuthError("FORBIDDEN", 403, "No writable partner office is available.");
  const [offices, markets, rolloutCandidates, authorityPolicies] = await Promise.all([
    prisma.office.findMany({
      where: {
        status: "active",
        OR: [
          ...(organisationAdminIds.size ? [{ organizationId: { in: [...organisationAdminIds] } }] : []),
          ...explicitScopes.map((scope) => ({ id: scope.officeId, organizationId: scope.organizationId })),
        ],
      },
      select: { id: true, organizationId: true, legalName: true, city: true, country: true, defaultMarketId: true, organization: { select: { legalName: true, slug: true } } },
      orderBy: [{ organizationId: "asc" }, { legalName: "asc" }],
    }),
    prisma.market.findMany({ where: { active: true }, select: { id: true, slug: true, city: true, country: true, assetClasses: true, defaultCurrency: true }, orderBy: [{ country: "asc" }, { city: "asc" }] }),
    prisma.propertyIdentityRolloutPolicy.findMany(),
    prisma.propertyIdentityAuthorityPolicy.findMany({
      where: { active: true, effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] },
      select: { id: true, organizationId: true, marketId: true, jurisdiction: true, assetClass: true, subjectScope: true, identifierScheme: true, authorityNamespacePattern: true, normalizerId: true, normalizerVersion: true, automaticExactMatchAllowed: true, version: true },
    }),
  ]);
  const enabledScopes = offices.flatMap((office) => markets.map((market) => ({
    organizationId: office.organizationId,
    officeId: office.id,
    marketId: market.id,
    rollout: selectEffectivePropertyIdentityRollout(rolloutCandidates, office.organizationId, market.id),
  })));
  return {
    ok: true,
    offices: offices.map((office) => ({ ...office, organizationName: office.organization.legalName, organizationSlug: office.organization.slug, organization: undefined })),
    markets,
    rollout: enabledScopes,
    authorityPolicies: authorityPolicies.filter((policy) =>
      (!policy.organizationId || offices.some((office) => office.organizationId === policy.organizationId)) &&
      (!policy.marketId || markets.some((market) => market.id === policy.marketId))),
  };
}

async function getSubmission(prisma: PrismaClient, actor: ActorContext, submissionId: string) {
  const submission = await prisma.propertyRegistrationSubmission.findUnique({
    where: { id: submissionId },
    include: {
      observations: { select: { id: true, scheme: true, subjectScope: true, jurisdiction: true, authorityNamespace: true, normalizerId: true, normalizerVersion: true, sourceType: true, status: true, correctionReason: true, createdAt: true } },
      checkRuns: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, status: true, outcome: true, redactedResult: true, startedAt: true, completedAt: true, createdAt: true } },
      confirmations: { select: { id: true, resolution: true, createdAt: true } },
      aiDraft: { select: { id: true, proposedAssetClass: true, proposedPropertyObject: true, confidence: true, missingFields: true, conflicts: true, clarificationQuestions: true, status: true, createdAt: true } },
    },
  });
  if (!submission) throw new PropertyIdentityHttpError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
  resolvePartnerScope(actor, { organizationId: submission.organizationId, officeId: submission.officeId });
  assertSubmissionAuthor(actor, submission.createdByUserId);
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
    if (input.url.pathname === "/api/v1/admin/property-identity/context" && input.request.method === "GET") {
      sendJson(input.response, 200, await getPropertyIdentityContext(input.prisma, input.actor));
      return true;
    }
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
    const match = input.url.pathname.match(/^\/api\/v1\/admin\/property-identity\/submissions\/([^/]+)(?:\/(check|confirm-create|confirm-link|cancel|apply-ai-draft))?$/);
    if (!match) return false;
    const submissionId = decodeURIComponent(match[1]);
    if (!match[2] && input.request.method === "GET") {
      sendJson(input.response, 200, await getSubmission(input.prisma, input.actor, submissionId));
      return true;
    }
    if (!match[2] && input.request.method === "PATCH") {
      const body = await readJsonBody(input.request);
      const result = await updateSubmission({ prisma: input.prisma, actor: input.actor, request: input.request, submissionId, body, env: input.env ?? process.env });
      const rowVersion = typeof result.payload.rowVersion === "number" ? result.payload.rowVersion : null;
      sendJson(input.response, result.status, result.payload, { ...(result.replay ? { "idempotent-replay": "true" } : {}), ...(rowVersion !== null ? { ETag: `"${rowVersion}"` } : {}) });
      return true;
    }
    if (match[2] === "check" && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const result = await runExactCheck({ prisma: input.prisma, actor: input.actor, request: input.request, submissionId, body });
      sendJson(input.response, result.status, result.payload, result.replay ? { "idempotent-replay": "true" } : {});
      return true;
    }
    if ((match[2] === "confirm-create" || match[2] === "confirm-link") && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const result = await confirmSubmission({ prisma: input.prisma, actor: input.actor, request: input.request, submissionId, body, resolution: match[2] === "confirm-create" ? "CREATE_NEW" : "LINK_EXISTING" });
      sendJson(input.response, result.status, result.payload, result.replay ? { "idempotent-replay": "true" } : {});
      return true;
    }
    if (match[2] === "cancel" && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const result = await cancelSubmission({ prisma: input.prisma, actor: input.actor, request: input.request, submissionId, body });
      sendJson(input.response, result.status, result.payload, result.replay ? { "idempotent-replay": "true" } : {});
      return true;
    }
    if (match[2] === "apply-ai-draft" && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const result = await applyAiDraft({ prisma: input.prisma, actor: input.actor, request: input.request, submissionId, body });
      const rowVersion = typeof result.payload.rowVersion === "number" ? result.payload.rowVersion : null;
      sendJson(input.response, result.status, result.payload, { ...(result.replay ? { "idempotent-replay": "true" } : {}), ...(rowVersion !== null ? { ETag: `"${rowVersion}"` } : {}) });
      return true;
    }
    throw new PropertyIdentityHttpError(405, "METHOD_NOT_ALLOWED", "The method is not allowed for this Property Identity resource.");
  } catch (caught) {
    if (caught instanceof PropertyIdentityDomainError) {
      const status = caught.code.startsWith("IDENTIFIER_") || caught.code.startsWith("ENCRYPTION_") || caught.code === "CANONICAL_VALUE_INVALID" ? 400 : 409;
      sendJson(input.response, status, { ok: false, error: { code: caught.code, message: caught.message, correlationId: input.actor.correlationId } });
      return true;
    }
    const error = caught as { status?: number; code?: string; message?: string };
    if (!error.status || error.status >= 500) console.error("property_identity_request_failed", { code: error.code ?? "UNKNOWN", message: error.message ?? "Unknown error", correlationId: input.actor.correlationId });
    sendJson(input.response, error.status ?? 500, { ok: false, error: { code: error.code ?? "PROPERTY_IDENTITY_INTERNAL_ERROR", message: error.status && error.status < 500 ? error.message : "Property Identity operation failed.", correlationId: input.actor.correlationId } });
    return true;
  }
}
