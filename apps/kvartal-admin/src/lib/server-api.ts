async function getIdentityToken(audience: string) {
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
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
