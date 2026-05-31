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
