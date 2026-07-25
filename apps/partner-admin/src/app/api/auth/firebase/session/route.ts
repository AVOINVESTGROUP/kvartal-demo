import { NextResponse } from "next/server";
import {
  ActorAuthError, CSRF_COOKIE, CSRF_MAX_AGE_SECONDS, FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE_SECONDS, assertRecentLogin, createCsrfToken, firebaseAdminAuth,
  structuredAuthError, validateCsrf,
} from "@kvartal/auth";

function configuredOrigin(request: Request) {
  const configured = process.env.PARTNER_ADMIN_ORIGIN;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  throw new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "Application origin is not configured.");
}

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    const origin = configuredOrigin(request);
    if (!validateCsrf({
      cookie: request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-kvartal_csrf=([^;]+)/)?.[1],
      header: request.headers.get("x-csrf-token"), origin: request.headers.get("origin"), allowedOrigin: origin,
    })) throw new ActorAuthError("CSRF_INVALID", 403, "The request could not be validated.");
    const body = await request.json().catch(() => null) as { idToken?: string } | null;
    if (!body?.idToken) throw new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again.");
    const auth = firebaseAdminAuth();
    const decoded = await auth.verifyIdToken(body.idToken, true);
    assertRecentLogin(decoded.auth_time, Math.floor(Date.now() / 1000));
    if (decoded.email_verified !== true) throw new ActorAuthError("EMAIL_NOT_VERIFIED", 403, "A verified email is required.");
    const sessionCookie = await auth.createSessionCookie(body.idToken, { expiresIn: FIREBASE_SESSION_MAX_AGE_SECONDS * 1000 });
    const response = NextResponse.json({ ok: true, correlationId });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: FIREBASE_SESSION_MAX_AGE_SECONDS });
    response.cookies.set(CSRF_COOKIE, createCsrfToken(), { httpOnly: false, secure: true, sameSite: "strict", path: "/", maxAge: CSRF_MAX_AGE_SECONDS });
    return response;
  } catch (caught) {
    const error = caught instanceof ActorAuthError ? caught : new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again.");
    return NextResponse.json(structuredAuthError(error.code, error.message, correlationId), { status: error.status });
  }
}
