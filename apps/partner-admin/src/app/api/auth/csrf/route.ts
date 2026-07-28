import { CSRF_COOKIE, createCsrfToken, csrfCookieOptions } from "@kvartal/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const token = createCsrfToken();
  const response = NextResponse.json({ csrfToken: token }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(CSRF_COOKIE, token, csrfCookieOptions);
  return response;
}
