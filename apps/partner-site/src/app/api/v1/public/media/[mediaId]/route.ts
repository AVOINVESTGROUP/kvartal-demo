import { getIdentityToken } from "@/lib/server-api";

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

export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const baseUrl = process.env.PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return Response.json({ ok: false, error: { code: "api_not_configured" } }, { status: 500 });
  }

  const token = await getIdentityToken(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/public/media/${encodeURIComponent(mediaId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    headers: forwardedHeaders(response),
  });
}
