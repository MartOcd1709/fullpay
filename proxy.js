import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC = ["/login", "/api/health", "/api/tick", "/api/reseed", "/api/auth/", "/api/demo/", "/api/pay/", "/api/verify/", "/pay/", "/verify/"];
const isPublic = (pathname) => PUBLIC.some((rule) => (rule.endsWith("/") ? pathname.startsWith(rule) : pathname === rule));

export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (verifySession(process.env.SESSION_SECRET, request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: { code: "unauthorized", message: "Login required" } }, { status: 401 });
  }
  const login = new URL("/login", request.nextUrl);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
