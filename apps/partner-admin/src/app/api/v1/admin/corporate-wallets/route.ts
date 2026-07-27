import { requireAdminSession } from "@/lib/auth";
import { fetchSecureActorBackendJson } from "@/lib/server-api";

async function organizationId() {
  const session = await requireAdminSession();
  const context = await fetchSecureActorBackendJson<{ organization: { id: string } }>(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/context?organizationSlug=${encodeURIComponent(session.organizationSlug)}`);
  return context.organization.id;
}

export async function GET() {
  const id = await organizationId();
  const result = await fetchSecureActorBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/corporate-wallets?organizationId=${encodeURIComponent(id)}`);
  return Response.json(result);
}
