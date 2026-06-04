import { requireAdminSession } from "@/lib/auth";
import { fetchBackendJson } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ interactionId: string }> }) {
  const session = await requireAdminSession();
  const { interactionId } = await params;
  const url = new URL(request.url);
  const officeSlug = url.searchParams.get("officeSlug") ?? "";
  const response = await fetchBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/status?organizationSlug=${encodeURIComponent(session.organizationSlug)}&officeSlug=${encodeURIComponent(officeSlug)}`,
  );

  return Response.json(response ?? { ok: false });
}
