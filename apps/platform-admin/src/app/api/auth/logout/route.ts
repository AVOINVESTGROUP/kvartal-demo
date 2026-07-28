import { ActorAuthError, CSRF_COOKIE, FIREBASE_SESSION_COOKIE, assertValidSameOriginCsrf, expiredAuthCookieOptions, structuredAuthError } from "@kvartal/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const allowedOrigin = process.env.PLATFORM_ADMIN_ORIGIN ?? (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : "");
  try {
    assertValidSameOriginCsrf({ cookieHeader: request.headers.get("cookie"), header: request.headers.get("x-csrf-token"), origin: request.headers.get("origin"), allowedOrigin });
  } catch (caught) {
    const error = caught instanceof ActorAuthError ? caught : new ActorAuthError("CSRF_INVALID", 403, "The request could not be validated.");
    return NextResponse.json(structuredAuthError(error.code, error.message, correlationId), { status: error.status });
  }
  const response = NextResponse.json({ ok: true, correlationId });
  for (const name of [FIREBASE_SESSION_COOKIE, "fixer_platform_session", CSRF_COOKIE]) response.cookies.set(name, "", { ...expiredAuthCookieOptions, httpOnly: name !== CSRF_COOKIE });
  return response;
}
