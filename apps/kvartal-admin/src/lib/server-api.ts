import { secureActorHeaders } from "@kvartal/auth";

export async function getIdentityToken(audience: string) {
  try {
    const response = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
      { headers: { "Metadata-Flavor": "Google" }, cache: "no-store" },
    );

    if (!response.ok) {
      return null;
    }

    return response.text();
  } catch {
    return null;
  }
}

export async function fetchSecureActorBackendJson<T>(baseUrl: string | undefined, path: string, init: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new Error("Secure backend URL is not configured.");
  const [{ cookies }, serviceToken] = await Promise.all([import("next/headers"), getIdentityToken(baseUrl)]);
  const session = (await cookies()).get("__Host-kvartal_session")?.value;
  if (!session) throw new Error("REAUTH_REQUIRED");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...secureActorHeaders(serviceToken, session),
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message ?? `Backend request failed with ${response.status}`), { status: response.status, payload });
  return payload as T;
}

export function writeSecureActorBackendJson<T>(baseUrl: string | undefined, path: string, method: "POST" | "PATCH", body: unknown, headers: Record<string, string>) {
  return fetchSecureActorBackendJson<T>(baseUrl, path, { method, headers, body: JSON.stringify(body) });
}

async function getAccessToken() {
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, cache: "no-store" },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { access_token?: string };
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

export async function getSecretValue(secretName: string) {
  const token = await getAccessToken();

  if (!token) {
    return null;
  }

  const response = await fetch(`https://secretmanager.googleapis.com/v1/projects/kvartal-dev/secrets/${secretName}/versions/latest:access`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { payload?: { data?: string } };
  return payload.payload?.data ? Buffer.from(payload.payload.data, "base64").toString("utf8").trim() : null;
}

export async function fetchBackendJson<T>(baseUrl: string | undefined, path: string): Promise<T | null> {
  if (!baseUrl) {
    return null;
  }

  const token = await getIdentityToken(baseUrl);
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<T>;
}

export async function writeBackendJson<T>(baseUrl: string | undefined, path: string, method: "POST" | "PATCH", body: unknown): Promise<T | null> {
  if (!baseUrl) {
    return null;
  }

  const token = await getIdentityToken(baseUrl);
  const adminWriteToken = await getSecretValue("kvartal-admin-write-token");
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(adminWriteToken ? { "x-kvartal-admin-write-token": adminWriteToken } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Backend request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
