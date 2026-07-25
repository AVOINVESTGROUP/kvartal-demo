import { CSRF_COOKIE, CSRF_MAX_AGE_SECONDS, createCsrfToken } from "@kvartal/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const token = createCsrfToken();
  const response = NextResponse.json({ csrfToken: token }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(CSRF_COOKIE, token, { httpOnly: false, secure: true, sameSite: "strict", path: "/", maxAge: CSRF_MAX_AGE_SECONDS });
  return response;
}
