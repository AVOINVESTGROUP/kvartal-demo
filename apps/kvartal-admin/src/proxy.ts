import { NextResponse, type NextRequest } from "next/server";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(request: NextRequest) {
  const expectedHash = process.env.KVARTAL_ADMIN_BASIC_AUTH_SHA256;

  if (!expectedHash) {
    return new NextResponse("Admin authentication is not configured.", { status: 503 });
  }

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const actualHash = await sha256(decoded);

    if (actualHash === expectedHash) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="KVARTAL Admin", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
