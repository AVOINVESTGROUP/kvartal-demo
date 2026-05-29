import { NextResponse } from "next/server";
import { fetchBackendJson } from "../../../../../lib/server-api";
import { setPlatformSession, verifyFirebaseIdToken, type PlatformAccess } from "../../../../../lib/auth";

type SessionRequest = {
  idToken?: string;
};

type PlatformAccessResponse = PlatformAccess & {
  ok: boolean;
  email: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SessionRequest | null;

  if (!body?.idToken) {
    return new NextResponse("Firebase ID token is required.", { status: 400 });
  }

  const session = await verifyFirebaseIdToken(body.idToken);

  if (!session) {
    return new NextResponse("Firebase ID token is invalid.", { status: 401 });
  }

  const access = await fetchBackendJson<PlatformAccessResponse>(
    process.env.PLATFORM_API_BASE_URL,
    `/api/v1/platform/access?email=${encodeURIComponent(session.email)}&displayName=${encodeURIComponent(session.name ?? "")}`,
  );

  if (!access?.authorized) {
    return new NextResponse("Access is not granted in Fixer.guru platform.", { status: 403 });
  }

  await setPlatformSession(session);
  return NextResponse.json({ ok: true, email: session.email });
}
