import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Prisma, type PrismaClient } from "@prisma/client";

export type PlatformRole = "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";
export type OrganizationRole = "organization_owner" | "organization_admin";
export type OfficeRole = "office_owner" | "office_admin" | "broker" | "office_analyst" | "office_viewer";

export const FIREBASE_SESSION_COOKIE = "__Host-kvartal_session";
export const CSRF_COOKIE = "__Host-kvartal_csrf";
export const FIREBASE_SESSION_MAX_AGE_SECONDS = 432_000;
export const CSRF_MAX_AGE_SECONDS = 900;

export const firebaseSessionCookieOptions = Object.freeze({
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: FIREBASE_SESSION_MAX_AGE_SECONDS,
});

export const csrfCookieOptions = Object.freeze({
  httpOnly: false,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: CSRF_MAX_AGE_SECONDS,
});

export const expiredAuthCookieOptions = Object.freeze({
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 0,
});

export function readCookieHeader(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`))?.[1];
}

export function assertValidSameOriginCsrf(input: { cookieHeader?: string | null; header?: string | null; origin?: string | null; allowedOrigin?: string | null }) {
  if (!input.allowedOrigin || !validateCsrf({
    cookie: readCookieHeader(input.cookieHeader, CSRF_COOKIE),
    header: input.header,
    origin: input.origin,
    allowedOrigin: input.allowedOrigin,
  })) {
    throw new ActorAuthError("CSRF_INVALID", 403, "The request could not be validated.");
  }
}

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

export type AdminSurface = "platform" | "partner" | "kvartal";

export function canAccessAdminSurface(actor: Pick<ActorContext, "platformRoles" | "organizationMemberships" | "officeMemberships">, surface: AdminSurface, organizationId?: string) {
  if (surface === "platform") return actor.platformRoles.includes("platform_owner");
  if (actor.platformRoles.includes("platform_owner")) return true;
  return actor.organizationMemberships.some((membership) =>
    (!organizationId || membership.organizationId === organizationId) &&
    membership.roles.some((role) => role === "organization_owner" || role === "organization_admin"),
  ) || actor.officeMemberships.some((membership) =>
    (!organizationId || membership.organizationId === organizationId) &&
    membership.roles.some((role) => role === "office_owner" || role === "office_admin"),
  );
}

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

export type VerifiedFirebaseSession = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
};

const actorIdentityInclude = { appUser: { include: { platformRoleAssignments: true, organizationMemberships: true, officeMemberships: true } } } as const;

async function findActorIdentity(client: PrismaClient | Prisma.TransactionClient, provider: "FIREBASE", subject: string) {
  return client.appUserExternalIdentity.findUnique({ where: { provider_subject: { provider, subject } }, include: actorIdentityInclude });
}

export async function bindPreprovisionedFirebaseIdentity(prisma: PrismaClient, claim: { provider: "FIREBASE"; subject: string; verifiedEmail: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
      const existing = await findActorIdentity(tx, claim.provider, claim.subject);
      if (existing) return existing;
      const candidates = await tx.appUser.findMany({ where: { email: { equals: claim.verifiedEmail, mode: "insensitive" } }, select: { id: true }, take: 2 });
      if (candidates.length !== 1) return null;
      await tx.$queryRawUnsafe('SELECT id FROM "AppUser" WHERE id = $1 FOR UPDATE', candidates[0].id);
      const user = await tx.appUser.findUnique({
        where: { id: candidates[0].id },
        include: { platformRoleAssignments: true, organizationMemberships: true, officeMemberships: true },
      });
      const hasActiveAccess = Boolean(user?.active && (
        user.platformRoleAssignments.some((assignment) => assignment.active)
        || user.organizationMemberships.some((membership) => membership.active)
        || user.officeMemberships.some((membership) => membership.active)
      ));
      if (!user || !hasActiveAccess) return null;
      const userIdentity = await tx.appUserExternalIdentity.findFirst({ where: { appUserId: user.id, provider: claim.provider, status: "ACTIVE" } });
      if (userIdentity) return null;
      const identity = await tx.appUserExternalIdentity.create({ data: { appUserId: user.id, provider: claim.provider, subject: claim.subject } });
      await tx.externalIdentityBindingEvent.create({
        data: {
          eventType: "APPROVED", externalIdentityId: identity.id, actorType: "SYSTEM_SERVICE",
          previousStatus: null, nextStatus: "ACTIVE", reasonCode: "PREPROVISIONED_VERIFIED_GOOGLE_FIRST_LOGIN",
          metadata: { emailMatched: true, correlationIndependent: true },
        },
      });
      return findActorIdentity(tx, claim.provider, claim.subject);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
    } catch (caught) {
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") return findActorIdentity(prisma, claim.provider, claim.subject);
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2034" && attempt < 2) continue;
      throw caught;
    }
  }
  return null;
}

export async function resolveUserActor(input: {
  authorization?: string | null;
  correlationId: string;
  verifySession: (token: string, checkRevoked: true) => Promise<VerifiedFirebaseSession>;
  findIdentity: (provider: "FIREBASE", subject: string) => Promise<ActorIdentityRecord | null>;
  bindPreprovisionedIdentity?: (claim: { provider: "FIREBASE"; subject: string; verifiedEmail: string }) => Promise<ActorIdentityRecord | null>;
}): Promise<ActorContext> {
  const match = input.authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) throw new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again.");
  let decoded: VerifiedFirebaseSession;
  try { decoded = await input.verifySession(match[1], true); }
  catch { throw new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again."); }
  let identity = await input.findIdentity("FIREBASE", decoded.uid);
  const verifiedEmail = decoded.email?.trim().toLowerCase();
  if (!identity && input.bindPreprovisionedIdentity && decoded.email_verified === true && decoded.firebase?.sign_in_provider === "google.com" && verifiedEmail) {
    identity = await input.bindPreprovisionedIdentity({ provider: "FIREBASE", subject: decoded.uid, verifiedEmail });
  }
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
