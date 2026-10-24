import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Exact paths, then prefixes (ending in "/"). "/" is exact only, so it never opens everything. /print/ is owner-only.
const PUBLIC_EXACT = new Set(["/", "/login", "/status", "/proof", "/calculator", "/verify", "/api/health", "/api/tick", "/api/reseed", "/api/status"]);
const PUBLIC_PREFIX = ["/api/auth/", "/api/demo/", "/api/pay/", "/api/verify/", "/pay/", "/s/", "/verify/", "/v/"];
const isPublic = (pathname) => PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some((rule) => pathname.startsWith(rule));

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
