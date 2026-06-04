import { requireAdminSession } from "@/lib/auth";
import { deleteBackendJson, getIdentityToken, getSecretValue } from "@/lib/server-api";

export const dynamic = "force-dynamic";

function forwardedHeaders(source: Response) {
  const headers = new Headers();

  for (const key of ["content-type", "content-length", "cache-control", "etag", "last-modified"]) {
    const value = source.headers.get(key);
    if (value) headers.set(key, value);
  }

  return headers;
}

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await requireAdminSession();
  const { documentId } = await params;
  const baseUrl = process.env.PARTNER_API_BASE_URL;

  if (!baseUrl) {
    return Response.json({ ok: false, error: { code: "api_not_configured" } }, { status: 500 });
  }

  const [identityToken, adminWriteToken] = await Promise.all([
    getIdentityToken(baseUrl),
    getSecretValue("kvartal-admin-write-token"),
  ]);
  const response = await fetch(
    `${baseUrl}/api/v1/admin/documents/${encodeURIComponent(documentId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}`,
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await requireAdminSession();
  const { documentId } = await params;
  const response = await deleteBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/documents/${encodeURIComponent(documentId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}`,
  );

  return Response.json(response);
}
