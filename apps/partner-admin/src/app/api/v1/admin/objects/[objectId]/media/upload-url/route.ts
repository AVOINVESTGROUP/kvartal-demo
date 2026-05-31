import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { writeBackendJson } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ objectId: string }> }) {
  const session = await requireAdminSession();
  const { objectId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const response = await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/objects/${encodeURIComponent(objectId)}/media/upload-url`,
    "POST",
    {
      ...body,
      organizationSlug: session.organizationSlug,
      uploadedByEmail: session.email,
    },
  );

  return NextResponse.json(response);
}
