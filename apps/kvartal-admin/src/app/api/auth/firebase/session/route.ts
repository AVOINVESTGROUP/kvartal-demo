import { NextResponse } from "next/server";
import {
  ActorAuthError, CSRF_COOKIE, FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE_SECONDS, assertRecentLogin, createCsrfToken, firebaseAdminAuth,
  assertValidSameOriginCsrf, canAccessAdminSurface, csrfCookieOptions, firebaseSessionCookieOptions, structuredAuthError, type ActorContext,
} from "@kvartal/auth";
import { fetchActorContextForSession } from "@/lib/server-api";

function configuredOrigin(request: Request) {
  const configured = process.env.KVARTAL_ADMIN_ORIGIN;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  throw new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "Application origin is not configured.");
}

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    const origin = configuredOrigin(request);
    assertValidSameOriginCsrf({ cookieHeader: request.headers.get("cookie"), header: request.headers.get("x-csrf-token"), origin: request.headers.get("origin"), allowedOrigin: origin });
    const body = await request.json().catch(() => null) as { idToken?: string } | null;
    if (!body?.idToken) throw new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again.");
    const auth = firebaseAdminAuth();
    const decoded = await auth.verifyIdToken(body.idToken, true);
    assertRecentLogin(decoded.auth_time, Math.floor(Date.now() / 1000));
    if (decoded.email_verified !== true) throw new ActorAuthError("EMAIL_NOT_VERIFIED", 403, "A verified email is required.");
    const sessionCookie = await auth.createSessionCookie(body.idToken, { expiresIn: FIREBASE_SESSION_MAX_AGE_SECONDS * 1000 });
    const context = await fetchActorContextForSession<{ actor: ActorContext; organizations: Array<{ id: string; slug: string }> }>(process.env.OFFICE_API_BASE_URL ?? process.env.PARTNER_API_BASE_URL, "/api/v1/admin/actor-context", sessionCookie);
    const actor = context.actor;
    const organizationSlug = process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow";
    const organization = context.organizations.find((item) => item.slug === organizationSlug);
    const allowed = organization ? canAccessAdminSurface(actor, "kvartal", organization.id) : false;
    if (!allowed) throw new ActorAuthError("FORBIDDEN", 403, "This account has no KVARTAL Admin access.");
    const response = NextResponse.json({ ok: true, correlationId });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, firebaseSessionCookieOptions);
    response.cookies.set(CSRF_COOKIE, createCsrfToken(), csrfCookieOptions);
    return response;
  } catch (caught) {
    const status = (caught as { status?: number }).status;
    const error = caught instanceof ActorAuthError ? caught : status === 403 ? new ActorAuthError("FORBIDDEN", 403, (caught as Error).message) : status && status >= 500 ? new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "The authentication service is temporarily unavailable.") : new ActorAuthError("REAUTH_REQUIRED", 401, "Sign in again.");
    return NextResponse.json(structuredAuthError(error.code, error.message, correlationId), { status: error.status });
  }
}
