import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
  const cookie = request.headers.get("cookie") ?? "";
  try {
    const response = await fetch(`${apiUrl}/auth/me`, { headers: { cookie }, cache: "no-store" });
    if (!response.ok) return NextResponse.redirect(new URL("/login", request.url));
    const { user } = await response.json();
    if (user.role !== "admin" && user.role !== "teacher") return NextResponse.redirect(new URL("/login", request.url));

    const pathname = request.nextUrl.pathname;
    const quizPath = user.role === "admin" ? "/admin/quiz" : "/teacher/quiz";
    const legacyQuizPath = "/teacher/quizzes";
    const sharedPage = pathname.match(/^\/(admin|teacher)\/(students|results)$/);
    let destination: string | undefined;

    if (sharedPage && sharedPage[1] !== user.role) {
      destination = `/${user.role}/${sharedPage[2]}`;
    } else if (pathname === "/teacher" && user.role === "admin") {
      destination = "/admin";
    } else if (pathname === legacyQuizPath || pathname.startsWith(legacyQuizPath + "/")) {
      destination = quizPath + pathname.slice(legacyQuizPath.length);
    } else if (user.role === "admin" && (pathname === "/teacher/quiz" || pathname.startsWith("/teacher/quiz/"))) {
      destination = quizPath + pathname.slice("/teacher/quiz".length);
    } else if (user.role === "teacher" && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      destination = quizPath;
    }
    if (destination) {
      const url = request.nextUrl.clone();
      url.pathname = destination;
      return NextResponse.redirect(url);
    }
    const headers = new Headers(request.headers);
    headers.set("x-dashboard-role", user.role);
    return NextResponse.next({ request: { headers } });
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = { matcher: ["/admin/:path*", "/teacher/:path*", "/settings/:path*"] };
