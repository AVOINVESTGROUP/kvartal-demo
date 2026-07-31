import { requireAdminSession } from "@/lib/auth";
import { fetchSecureActorBackendJson } from "@/lib/server-api";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  const body = await request.json() as { walletAddress?: string };
  const context = await fetchSecureActorBackendJson<{ organization: { id: string } }>(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/context?organizationSlug=${encodeURIComponent(session.organizationSlug)}`);
  const result = await fetchSecureActorBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/corporate-wallets/challenge", { method: "POST", body: JSON.stringify({ organizationId: context.organization.id, walletAddress: body.walletAddress }) });
  return Response.json(result, { status: 201 });
}
