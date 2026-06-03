import { getIdentityToken } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const baseUrl = process.env.PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return Response.json({ ok: false, error: { code: "api_not_configured" } }, { status: 500 });
  }

  const token = await getIdentityToken(baseUrl);
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Forward client signals from the original request
  const incoming = new Headers(request.headers);
  for (const key of ["cf-ipcountry", "cf-ipcity", "accept-language", "user-agent", "referer", "x-client-timezone", "x-client-language"]) {
    const val = incoming.get(key);
    if (val) headers[key] = val;
  }

  const response = await fetch(`${baseUrl}/api/v1/public/session-context`, {
    headers,
    cache: "no-store",
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}
