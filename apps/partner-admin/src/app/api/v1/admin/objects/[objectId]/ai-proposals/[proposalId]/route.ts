import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { writeBackendJson } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ objectId: string; proposalId: string }> }) {
  const session = await requireAdminSession();
  const { objectId, proposalId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const response = await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/objects/${encodeURIComponent(objectId)}/ai-proposals/${encodeURIComponent(proposalId)}`,
    "POST",
    {
      ...body,
      organizationSlug: session.organizationSlug,
      decidedByEmail: session.email,
    },
  );

  return NextResponse.json(response);
}
