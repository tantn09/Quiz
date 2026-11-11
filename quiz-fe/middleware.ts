import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
  const cookie = request.headers.get("cookie") ?? "";
  try {
    const response = await fetch(`${apiUrl}/auth/me`, { headers: { cookie }, cache: "no-store" });
    if (!response.ok) return NextResponse.redirect(new URL("/login", request.url));
    const { user } = await response.json();
    if (request.nextUrl.pathname.startsWith("/admin") && user.role !== "admin") {
      return NextResponse.redirect(new URL("/teacher", request.url));
    }
    if ((request.nextUrl.pathname.startsWith("/teacher") || request.nextUrl.pathname.startsWith("/settings")) && !["admin", "teacher"].includes(user.role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = { matcher: ["/admin/:path*", "/teacher/:path*", "/settings/:path*"] };
