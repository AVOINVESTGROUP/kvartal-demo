import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const sessionToken = process.env.KVARTAL_ADMIN_SESSION_TOKEN;

  if (!sessionToken) {
    return new NextResponse("Admin authentication is not configured.", { status: 503 });
  }

  if (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/logout")) {
    return NextResponse.next();
  }

  if (request.cookies.get("kvartal_admin_session")?.value === sessionToken) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
