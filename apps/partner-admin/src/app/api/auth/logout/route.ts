import { ActorAuthError, CSRF_COOKIE, FIREBASE_SESSION_COOKIE, structuredAuthError, validateCsrf } from "@kvartal/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const allowedOrigin = process.env.PARTNER_ADMIN_ORIGIN ?? (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : "");
  const csrfCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-kvartal_csrf=([^;]+)/)?.[1];
  if (!allowedOrigin || !validateCsrf({ cookie: csrfCookie, header: request.headers.get("x-csrf-token"), origin: request.headers.get("origin"), allowedOrigin })) {
    const error = new ActorAuthError("CSRF_INVALID", 403, "The request could not be validated.");
    return NextResponse.json(structuredAuthError(error.code, error.message, correlationId), { status: error.status });
  }
  const response = NextResponse.json({ ok: true, correlationId });
  for (const name of [FIREBASE_SESSION_COOKIE, "partner_admin_session", CSRF_COOKIE]) response.cookies.set(name, "", { httpOnly: name !== CSRF_COOKIE, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
