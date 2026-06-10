import { NextResponse } from "next/server";

import { postBackendJson } from "../../../lib/server-api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: { code: "invalid_body", message: "JSON body is required." } }, { status: 400 });
  }

  const result = await postBackendJson(process.env.PUBLIC_API_BASE_URL, "/api/v1/public/client-intents", body);

  return NextResponse.json(result.data ?? { ok: false, error: { code: "backend_unavailable", message: "Public API is unavailable." } }, { status: result.status });
}
