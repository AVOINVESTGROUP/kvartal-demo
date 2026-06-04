import { requireAdminSession } from "@/lib/auth";
import { getIdentityToken, getSecretValue } from "@/lib/server-api";

export const dynamic = "force-dynamic";

function forwardedHeaders(source: Response) {
  const headers = new Headers();

  for (const key of ["content-type", "content-length", "cache-control", "etag", "last-modified"]) {
    const value = source.headers.get(key);

    if (value) {
      headers.set(key, value);
    }
  }

  return headers;
}

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await requireAdminSession();
  const { attachmentId } = await params;
  const baseUrl = process.env.PARTNER_API_BASE_URL;

  if (!baseUrl) {
    return Response.json({ ok: false, error: { code: "api_not_configured" } }, { status: 500 });
  }

  const [identityToken, adminWriteToken] = await Promise.all([
    getIdentityToken(baseUrl),
    getSecretValue("kvartal-admin-write-token"),
  ]);
  const response = await fetch(
    `${baseUrl}/api/v1/admin/interactions/attachments/${encodeURIComponent(attachmentId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}`,
    {
      headers: {
        ...(identityToken ? { Authorization: `Bearer ${identityToken}` } : {}),
        ...(adminWriteToken ? { "x-kvartal-admin-write-token": adminWriteToken } : {}),
      },
      cache: "no-store",
    },
  );

  return new Response(response.body, {
    status: response.status,
    headers: forwardedHeaders(response),
  });
}
