import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentOrigin, getSecretValue } from "../../../../../lib/auth";

export async function GET() {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? (await getSecretValue("fixer-google-oauth-client-id"));

  if (!clientId) {
    return new NextResponse("Google OAuth is not configured.", { status: 503 });
  }

  const origin = await currentOrigin();
  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("fixer_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 10,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(url);
}
