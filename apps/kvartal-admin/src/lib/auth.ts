import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, createVerify, timingSafeEqual } from "node:crypto";
import { fetchBackendJson, fetchSecureActorBackendJson } from "./server-api";
import { FIREBASE_SESSION_COOKIE, firebaseAdminAuth, type ActorContext } from "@kvartal/auth";

export type AdminSession = {
  email: string;
  name?: string;
  picture?: string;
  organizationSlug: string;
  roles: string[];
};

type PlatformAccess = {
  authorized: boolean;
  platformRoles: string[];
  organizationMemberships: Array<{
    organizationSlug: string;
    organizationName: string;
    roles: string[];
  }>;
};

const sessionCookieName = "kvartal_admin_session";
let cachedCookieSecret: string | null = null;
let cachedFirebaseCerts: Record<string, string> | null = null;

async function getAccessToken() {
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, cache: "no-store" },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { access_token?: string };
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

async function getSecretValue(secretName: string) {
  const token = await getAccessToken();

  if (!token) {
    return null;
  }

  const response = await fetch(`https://secretmanager.googleapis.com/v1/projects/kvartal-dev/secrets/${secretName}/versions/latest:access`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { payload?: { data?: string } };
  return payload.payload?.data ? Buffer.from(payload.payload.data, "base64").toString("utf8").trim() : null;
}

async function authSecret() {
  if (cachedCookieSecret) {
    return cachedCookieSecret;
  }

  cachedCookieSecret =
    process.env["KVARTAL_ADMIN_SESSION_TOKEN"] ??
    process.env["FIXER_AUTH_COOKIE_SECRET"] ??
    (await getSecretValue("fixer-auth-cookie-secret")) ??
    "";

  return cachedCookieSecret;
}

async function sign(payload: string) {
  return createHmac("sha256", await authSecret()).update(payload).digest("hex");
}

async function encodeSession(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${await sign(payload)}`;
}

async function decodeSession(value: string | undefined) {
  if (!value || !(await authSecret())) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = await sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeJwtPart<T>(value: string) {
  return JSON.parse(decodeBase64Url(value).toString("utf8")) as T;
}

async function getFirebaseCerts() {
  if (cachedFirebaseCerts) {
    return cachedFirebaseCerts;
  }

  const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Firebase token certificates are unavailable.");
  }

  cachedFirebaseCerts = (await response.json()) as Record<string, string>;
  return cachedFirebaseCerts;
}

export async function verifyFirebaseIdToken(idToken: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const header = decodeJwtPart<{ alg?: string; kid?: string }>(encodedHeader);
  const payload = decodeJwtPart<{
    aud?: string;
    iss?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>(encodedPayload);

  const projectId = process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] ?? "kvartal-dev";
  const now = Math.floor(Date.now() / 1000);

  if (
    header.alg !== "RS256" ||
    !header.kid ||
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.exp ||
    payload.exp <= now ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    return null;
  }

  const cert = (await getFirebaseCerts())[header.kid];

  if (!cert) {
    return null;
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  if (!verifier.verify(cert, decodeBase64Url(encodedSignature))) {
    return null;
  }

  return {
    email: payload.email.toLowerCase(),
    name: payload.name,
    picture: payload.picture,
  };
}

export async function setAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, await encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(value, true);
    const actor = (await fetchSecureActorBackendJson<{ actor: ActorContext }>(process.env.OFFICE_API_BASE_URL ?? process.env.PARTNER_API_BASE_URL, "/api/v1/admin/actor-context")).actor;
    const roles = [...actor.platformRoles, ...actor.organizationMemberships.flatMap((item) => item.roles), ...actor.officeMemberships.flatMap((item) => item.roles)];
    return { email: decoded.email ?? decoded.uid, name: decoded.name, picture: decoded.picture, organizationSlug: process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow", roles };
  } catch { return null; }
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  cookieStore.delete(FIREBASE_SESSION_COOKIE);
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function getOrganizationAccess(email: string, displayName?: string) {
  const organizationSlug = process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow";
  const access = await fetchBackendJson<PlatformAccess>(
    process.env.PLATFORM_API_BASE_URL,
    `/api/v1/platform/access?email=${encodeURIComponent(email)}&displayName=${encodeURIComponent(displayName ?? "")}`,
  );
  const membership = access?.organizationMemberships.find((item) => item.organizationSlug === organizationSlug);
  const platformRoles = access?.platformRoles ?? [];
  const roles = membership?.roles ?? [];
  const allowed =
    platformRoles.includes("platform_owner") ||
    platformRoles.includes("platform_admin") ||
    roles.includes("organization_owner") ||
    roles.includes("organization_admin");

  return { organizationSlug, roles: [...platformRoles, ...roles], allowed };
}
