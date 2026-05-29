import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentOrigin, getSecretValue, setPlatformSession } from "../../../../../lib/auth";

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

const fallbackClientId = "a6216f35d-0610-4f97-b9b8-6d0296d8e81d";

export async function GET(request: Request) {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? fallbackClientId;
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"] ?? (await getSecretValue("fixer-google-oauth-client-secret"));

  if (!clientId || !clientSecret) {
    return new NextResponse("Google OAuth is not configured.", { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("fixer_oauth_state")?.value;
  cookieStore.delete("fixer_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=state", request.url));
  }

  const origin = await currentOrigin();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenPayload.id_token) {
    return NextResponse.redirect(new URL("/login?error=token", request.url));
  }

  const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenPayload.id_token)}`, {
    cache: "no-store",
  });
  const info = (await infoResponse.json()) as GoogleTokenInfo;

  if (!infoResponse.ok || info.aud !== clientId || !info.email || info.email_verified === false || info.email_verified === "false") {
    return NextResponse.redirect(new URL("/login?error=verify", request.url));
  }

  await setPlatformSession({
    email: info.email.toLowerCase(),
    name: info.name,
    picture: info.picture,
  });

  return NextResponse.redirect(new URL("/", request.url));
}
