import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export type PlatformRole = "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";
export type OrganizationRole = "organization_owner" | "organization_admin";
export type OfficeRole = "office_owner" | "office_admin" | "broker" | "office_analyst" | "office_viewer";

export const FIREBASE_SESSION_COOKIE = "__Host-kvartal_session";
export const CSRF_COOKIE = "__Host-kvartal_csrf";
export const FIREBASE_SESSION_MAX_AGE_SECONDS = 432_000;
export const CSRF_MAX_AGE_SECONDS = 900;

export type ApiAuthPolicy = "PUBLIC" | "LEGACY_SERVICE_AUTH" | "ACTOR_AUTH_REQUIRED" | "SYSTEM_SERVICE_ONLY";
export type ActorType = "USER" | "SYSTEM_SERVICE" | "BOOTSTRAP_SYSTEM";

export type ActorContext = Readonly<{
  actorType: "USER";
  appUserId: string;
  externalIdentityId: string;
  provider: "FIREBASE";
  subject: string;
  platformRoles: readonly PlatformRole[];
  organizationMemberships: ReadonlyArray<Readonly<{ organizationId: string; roles: readonly OrganizationRole[] }>>;
  officeMemberships: ReadonlyArray<Readonly<{ organizationId: string; officeId: string; roles: readonly OfficeRole[] }>>;
  correlationId: string;
}>;

export type SystemActorContext = Readonly<{
  actorType: "SYSTEM_SERVICE";
  serviceId: string;
  purpose: string;
  correlationId: string;
}>;

export type AuthErrorCode =
  | "REAUTH_REQUIRED" | "CSRF_INVALID" | "RECENT_LOGIN_REQUIRED" | "EMAIL_NOT_VERIFIED"
  | "IDENTITY_BINDING_REQUIRED" | "IDENTITY_REVOKED" | "APP_USER_INACTIVE" | "MEMBERSHIP_INACTIVE"
  | "FORBIDDEN" | "BINDING_REQUEST_NOT_FOUND" | "EXTERNAL_IDENTITY_NOT_FOUND" | "BINDING_ALREADY_FINAL"
  | "BINDING_REQUEST_EXPIRED" | "BINDING_SUBJECT_ALREADY_BOUND" | "BINDING_USER_ALREADY_BOUND"
  | "BINDING_SELF_APPROVAL_FORBIDDEN" | "BINDING_VERSION_CONFLICT" | "BINDING_CANDIDATE_REQUIRED"
  | "BINDING_RECOVERY_TARGET_INVALID" | "IDEMPOTENCY_KEY_INVALID" | "IDEMPOTENCY_KEY_REUSED"
  | "BOOTSTRAP_ALREADY_COMPLETED" | "BOOTSTRAP_DISABLED" | "DEPLOYMENT_PREREQUISITE_MISSING";

export class ActorAuthError extends Error {
  constructor(public readonly code: AuthErrorCode, public readonly status: number, message: string) {
    super(message);
  }
}

export function structuredAuthError(code: AuthErrorCode, message: string, correlationId: string) {
  return { error: { code, message, correlationId } };
}

export function createCsrfToken(random: (size: number) => Buffer = randomBytes) {
  return random(32).toString("base64url");
}

const csrfPattern = /^[A-Za-z0-9_-]{43}$/;

export function validateCsrf(input: { cookie?: string | null; header?: string | null; origin?: string | null; allowedOrigin: string }) {
  const { cookie, header, origin, allowedOrigin } = input;
  if (!cookie || !header || !csrfPattern.test(cookie) || !csrfPattern.test(header) || origin !== allowedOrigin) return false;
  const left = Buffer.from(cookie, "ascii");
  const right = Buffer.from(header, "ascii");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function assertRecentLogin(authTime: unknown, nowSeconds: number) {
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) {
    throw new ActorAuthError("RECENT_LOGIN_REQUIRED", 401, "A recent sign-in is required.");
  }
  const age = nowSeconds - authTime;
  if (age < -60 || age > 360) throw new ActorAuthError("RECENT_LOGIN_REQUIRED", 401, "A recent sign-in is required.");
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("und");
}

export function digestSubject(subject: string, pepper: string) {
  return createHash("sha256").update(`${pepper}\0${subject}`, "utf8").digest("hex");
}

export function hasExternalIdentityBindingReview(context: Pick<ActorContext, "platformRoles">) {
  return context.platformRoles.includes("platform_owner");
}

export const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;
export function validateIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && idempotencyKeyPattern.test(value);
}

export function secureActorHeaders(serviceToken: string | null, firebaseSession: string) {
  return {
    ...(serviceToken ? { "X-Serverless-Authorization": `Bearer ${serviceToken}` } : {}),
    Authorization: `Bearer ${firebaseSession}`,
  } as const;
}

export function parseIfMatch(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? undefined : value;
  const match = text?.match(/^"(0|[1-9][0-9]*)"$/);
  return match ? Number(match[1]) : null;
}

export function validateReason(value: unknown) {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 10 && reason.length <= 1000 ? reason : null;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

export function requestHash(body: unknown) {
  return createHash("sha256").update(canonicalize(body), "utf8").digest("hex");
}

export function readRetentionConfig(env: NodeJS.ProcessEnv, production = env.NODE_ENV === "production") {
  const requestDays = Number(env.EXTERNAL_IDENTITY_REQUEST_PII_RETENTION_DAYS ?? (production ? NaN : 90));
  const auditDays = Number(env.EXTERNAL_IDENTITY_AUDIT_RETENTION_DAYS ?? (production ? NaN : 365));
  if (!Number.isInteger(requestDays) || requestDays < 30 || requestDays > 365 || !Number.isInteger(auditDays) || auditDays < 365 || auditDays > 2555) {
    throw new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "External identity retention configuration is invalid.");
  }
  return { requestDays, auditDays };
}

export function firebaseAdminAuth(projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "kvartal-dev") {
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
  return getAuth(app);
}

export type ActorIdentityRecord = {
  id: string;
  provider: "FIREBASE";
  subject: string;
  status: "ACTIVE" | "REVOKED";
  appUser: {
    id: string;
    active: boolean;
    platformRoleAssignments: Array<{ active: boolean; role: PlatformRole }>;
    organizationMemberships: Array<{ active: boolean; organizationId: string; roles: OrganizationRole[] }>;
    officeMemberships: Array<{ active: boolean; organizationId: string; officeId: string; roles: OfficeRole[] }>;
  };
};

export async function resolveUserActor(input: {
  authorization?: string | null;
  correlationId: string;
  verifySession: (token: string, checkRevoked: true) => Promise<{ uid: string }>;
  findIdentity: (provider: "FIREBASE", subject: string) => Promise<ActorIdentityRecord | null>;
}): Promise<ActorContext> {
  const match = input.authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again.");
  let decoded: { uid: string };
  try { decoded = await input.verifySession(match[1], true); }
  catch { throw new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again."); }
  const identity = await input.findIdentity("FIREBASE", decoded.uid);
  if (!identity) throw new ActorAuthError("IDENTITY_BINDING_REQUIRED", 403, "An identity binding is required.");
  if (identity.status !== "ACTIVE") throw new ActorAuthError("IDENTITY_REVOKED", 403, "This identity is revoked.");
  if (!identity.appUser.active) throw new ActorAuthError("APP_USER_INACTIVE", 403, "This user is inactive.");
  const actor: ActorContext = {
    actorType: "USER", appUserId: identity.appUser.id, externalIdentityId: identity.id,
    provider: "FIREBASE", subject: identity.subject,
    platformRoles: identity.appUser.platformRoleAssignments.filter((item) => item.active).map((item) => item.role),
    organizationMemberships: identity.appUser.organizationMemberships.filter((item) => item.active).map((item) => ({ organizationId: item.organizationId, roles: item.roles })),
    officeMemberships: identity.appUser.officeMemberships.filter((item) => item.active).map((item) => ({ organizationId: item.organizationId, officeId: item.officeId, roles: item.roles })),
    correlationId: input.correlationId,
  };
  return Object.freeze({
    ...actor,
    platformRoles: Object.freeze([...actor.platformRoles]),
    organizationMemberships: Object.freeze(actor.organizationMemberships.map((item) => Object.freeze(item))),
    officeMemberships: Object.freeze(actor.officeMemberships.map((item) => Object.freeze(item))),
  }) as ActorContext;
}

export type RequestAuthContext = {
  uid: string;
  email?: string;
  platformRoles: PlatformRole[];
  organizationMemberships: Array<{
    organizationId: string;
    roles: OrganizationRole[];
    active?: boolean;
  }>;
  officeMemberships: Array<{
    organizationId: string;
    officeId: string;
    roles: OfficeRole[];
    active?: boolean;
  }>;
  activeOrganizationId?: string;
  activeOfficeId?: string;
};

export const hasPlatformRole = (context: RequestAuthContext, roles: PlatformRole[]) =>
  roles.some((role) => context.platformRoles.includes(role));

export const hasActiveOrganizationRole = (context: RequestAuthContext, roles: OrganizationRole[]) =>
  context.activeOrganizationId !== undefined &&
  context.organizationMemberships.some(
    (membership) =>
      membership.organizationId === context.activeOrganizationId &&
      roles.some((role) => membership.roles.includes(role)),
  );

export const hasActiveOfficeRole = (context: RequestAuthContext, roles: OfficeRole[]) =>
  context.activeOrganizationId !== undefined &&
  context.activeOfficeId !== undefined &&
  context.officeMemberships.some(
    (membership) =>
      membership.organizationId === context.activeOrganizationId &&
      membership.officeId === context.activeOfficeId &&
      roles.some((role) => membership.roles.includes(role)),
  );

export type InformationRightsScope = {
  ownerOrganizationId: string;
  ownerOfficeId: string;
  visibility: "private" | "office_network" | "public";
  publicationStatus?: "draft" | "published" | "archived";
};

export type AccessDecision = {
  allowed: boolean;
  reason:
    | "platform_owner_audited_access"
    | "same_office_information_owner"
    | "same_organization_information_owner"
    | "public_showcase"
    | "denied";
  auditRequired: boolean;
};

export const canAccessOwnedInformation = (
  context: RequestAuthContext,
  scope: InformationRightsScope,
): AccessDecision => {
  if (hasPlatformRole(context, ["platform_owner"])) {
    return { allowed: true, reason: "platform_owner_audited_access", auditRequired: true };
  }

  if (
    context.officeMemberships.some(
      (membership) =>
        membership.active !== false &&
        membership.organizationId === scope.ownerOrganizationId &&
        membership.officeId === scope.ownerOfficeId,
    )
  ) {
    return { allowed: true, reason: "same_office_information_owner", auditRequired: false };
  }

  if (
    context.organizationMemberships.some(
      (membership) => membership.active !== false && membership.organizationId === scope.ownerOrganizationId,
    )
  ) {
    return { allowed: true, reason: "same_organization_information_owner", auditRequired: false };
  }

  if (scope.visibility === "public" && scope.publicationStatus === "published") {
    return { allowed: true, reason: "public_showcase", auditRequired: false };
  }

  return { allowed: false, reason: "denied", auditRequired: false };
};

export const canExposeOnPublicShowcase = (scope: InformationRightsScope) =>
  scope.visibility === "public" && scope.publicationStatus === "published";
