import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIREBASE_SESSION_COOKIE, firebaseAdminAuth, type ActorContext } from "@kvartal/auth";
import { fetchSecureActorBackendJson } from "./server-api";

export type AdminSession = {
  email: string;
  name?: string;
  picture?: string;
  organizationSlug: string;
  roles: string[];
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const value = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!value) return null;

  let decoded;
  try { decoded = await firebaseAdminAuth().verifySessionCookie(value, true); }
  catch { return null; }

  const actor = (await fetchSecureActorBackendJson<{ actor: ActorContext }>(
    process.env.OFFICE_API_BASE_URL ?? process.env.PARTNER_API_BASE_URL,
    "/api/v1/admin/actor-context",
  )).actor;
  const roles = [...actor.platformRoles, ...actor.organizationMemberships.flatMap((item) => item.roles), ...actor.officeMemberships.flatMap((item) => item.roles)];

  return {
    email: decoded.email ?? decoded.uid,
    name: decoded.name,
    picture: decoded.picture,
    organizationSlug: process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow",
    roles,
  };
}
export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  if (!session.roles.some((role) => ["platform_owner", "organization_owner", "organization_admin", "office_owner", "office_admin"].includes(role))) redirect("/unauthorized");
  return session;
}
