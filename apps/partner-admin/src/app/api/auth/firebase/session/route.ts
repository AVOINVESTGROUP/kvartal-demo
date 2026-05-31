import { NextResponse } from "next/server";
import { getOrganizationAccess, setAdminSession, verifyFirebaseIdToken } from "../../../../../lib/auth";

type SessionRequest = {
  idToken?: string;
  organizationSlug?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SessionRequest | null;

  if (!body?.idToken) {
    return new NextResponse("Firebase ID token is required.", { status: 400 });
  }

  const user = await verifyFirebaseIdToken(body.idToken);

  if (!user) {
    return new NextResponse("Firebase ID token is invalid.", { status: 401 });
  }

  const access = await getOrganizationAccess(user.email, user.name, body.organizationSlug);

  if (!access.allowed) {
    return new NextResponse("Access is not granted for this organization.", { status: 403 });
  }

  await setAdminSession({
    email: user.email,
    name: user.name,
    picture: user.picture,
    organizationSlug: access.organizationSlug,
    roles: access.roles,
  });

  return NextResponse.json({ ok: true, email: user.email, organizationSlug: access.organizationSlug, roles: access.roles });
}
