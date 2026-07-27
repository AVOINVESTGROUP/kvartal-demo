import { requireAdminSession } from "@/lib/auth";
import { fetchSecureActorBackendJson } from "@/lib/server-api";

export async function POST(request: Request) {
  await requireAdminSession();
  const body = await request.json() as { walletId?: string; signature?: string };
  const result = await fetchSecureActorBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/corporate-wallets/verify", { method: "POST", body: JSON.stringify(body) });
  return Response.json(result);
}
