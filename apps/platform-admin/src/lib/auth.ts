import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { fetchBackendJson } from "./server-api";

export type PlatformSession = {
  email: string;
  name?: string;
  picture?: string;
};

export type PlatformAccess = {
  authorized: boolean;
  platformRoles: string[];
  organizationMemberships: Array<{
    organizationSlug: string;
    organizationName: string;
    roles: string[];
  }>;
};

const sessionCookieName = "fixer_platform_session";

function authSecret() {
  return process.env["FIXER_AUTH_COOKIE_SECRET"] ?? process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ?? "";
}

function sign(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("hex");
}

function encodeSession(session: PlatformSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string | undefined) {
  if (!value || !authSecret()) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlatformSession;
  } catch {
    return null;
  }
}

export async function getPlatformSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(sessionCookieName)?.value);
}

export async function setPlatformSession(session: PlatformSession) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
}

export async function clearPlatformSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function requirePlatformOwner() {
  const session = await getPlatformSession();

  if (!session) {
    redirect("/login");
  }

  const access = await fetchBackendJson<PlatformAccessResponse>(
    process.env.PLATFORM_API_BASE_URL,
    `/api/v1/platform/access?email=${encodeURIComponent(session.email)}&displayName=${encodeURIComponent(session.name ?? "")}`,
  );

  if (!access?.authorized) {
    redirect("/unauthorized");
  }

  return {
    session,
    access: {
      authorized: access.authorized,
      platformRoles: access.platformRoles,
      organizationMemberships: access.organizationMemberships,
    },
  };
}

type PlatformAccessResponse = PlatformAccess & {
  ok: boolean;
  email: string;
  displayName?: string | null;
};

export async function currentOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}
