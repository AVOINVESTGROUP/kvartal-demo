import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const expected = process.env.KVARTAL_ADMIN_BASIC_AUTH;

  if (!expected) {
    return new NextResponse("Admin authentication is not configured.", { status: 503 });
  }

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));

    if (decoded === expected) {
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
