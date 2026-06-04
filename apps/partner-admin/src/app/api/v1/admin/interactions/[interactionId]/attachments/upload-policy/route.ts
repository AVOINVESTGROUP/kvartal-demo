import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { writeBackendJson } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ interactionId: string }> }) {
  const session = await requireAdminSession();
  const { interactionId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const response = await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/attachments/upload-policy`,
    "POST",
    {
      ...body,
      organizationSlug: session.organizationSlug,
      uploadedByEmail: session.email,
      uploadedByName: session.name,
    },
  );

  return NextResponse.json(response);
}
