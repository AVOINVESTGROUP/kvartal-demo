import { getIdentityToken } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const baseUrl = process.env.PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return Response.json({ ok: false, error: { code: "api_not_configured" } }, { status: 500 });
  }

  const token = await getIdentityToken(baseUrl);
  const body = await request.text();

  const response = await fetch(`${baseUrl}/api/v1/public/ai-search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}
