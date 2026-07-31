import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIREBASE_SESSION_COOKIE, firebaseAdminAuth, type ActorContext } from "@kvartal/auth";
import { fetchSecureActorBackendJson } from "./server-api";

export type PlatformSession = {
  email: string;
  name?: string;
  picture?: string;
};

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const value = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(value, true);
    return { email: decoded.email ?? decoded.uid, name: decoded.name, picture: decoded.picture };
  } catch {
    return null;
  }
}
export async function requirePlatformOwner() {
  const session = await getPlatformSession();
  if (!session) redirect("/login");

  let actor: ActorContext;
  try {
    actor = (await fetchSecureActorBackendJson<{ actor: ActorContext }>(
      process.env.PLATFORM_API_BASE_URL,
      "/api/v1/platform/actor-context",
    )).actor;
  } catch (caught) {
    if ((caught as { status?: number }).status === 401 || (caught as { status?: number }).status === 403) redirect("/unauthorized");
    throw caught;
  }

  if (!actor.platformRoles.includes("platform_owner")) redirect("/unauthorized");

  return {
    session,
    access: {
      authorized: true,
      platformRoles: [...actor.platformRoles],
      organizationMemberships: [],
    },
  };
}
