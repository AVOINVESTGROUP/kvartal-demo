import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FIREBASE_SESSION_COOKIE, firebaseAdminAuth, type ActorContext } from "@kvartal/auth";
import { fetchSecureActorBackendJson } from "./server-api";

export type AdminSession = {
  email: string;
  name?: string;
  picture?: string;
  organizationSlug: string;
  organizations: Array<{ id: string; slug: string; legalName: string }>;
  roles: string[];
};

type ActorContextResponse = {
  actor: ActorContext;
  organizations: Array<{ id: string; slug: string; legalName: string }>;
};

const activeOrganizationCookieName = "partner_admin_organization";

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!value) return null;

  let decoded;
  try { decoded = await firebaseAdminAuth().verifySessionCookie(value, true); }
  catch { return null; }

  const context = await fetchSecureActorBackendJson<ActorContextResponse>(
    process.env.OFFICE_API_BASE_URL ?? process.env.PARTNER_API_BASE_URL,
    "/api/v1/admin/actor-context",
  );
  const actor = context.actor;
  const roles = [...actor.platformRoles, ...actor.organizationMemberships.flatMap((item) => item.roles), ...actor.officeMemberships.flatMap((item) => item.roles)];
  const preferredSlug = cookieStore.get(activeOrganizationCookieName)?.value ?? process.env.PARTNER_ORGANIZATION_SLUG;
  const organization = context.organizations.find((item) => item.slug === preferredSlug) ?? context.organizations[0];

  return {
    email: decoded.email ?? decoded.uid,
    name: decoded.name,
    picture: decoded.picture,
    organizationSlug: organization?.slug ?? "",
    organizations: context.organizations,
    roles,
  };
}
export async function setActiveOrganization(organizationSlug: string) {
  const session = await getAdminSession();
  if (!session || !session.organizations.some((organization) => organization.slug === organizationSlug)) return false;
  const cookieStore = await cookies();
  cookieStore.set(activeOrganizationCookieName, organizationSlug, {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  return true;
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  if (!session.roles.some((role) => ["platform_owner", "organization_owner", "organization_admin", "office_owner", "office_admin"].includes(role))) redirect("/unauthorized");
  if (!session.organizationSlug) redirect("/unauthorized?reason=organization_access_required");
  return session;
}
