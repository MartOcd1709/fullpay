import { NextResponse } from "next/server";
import { sessionCookieOptions, signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

// K1: one-click demo entry. Only when DEMO_MODE=1; sets the same signed session cookie as /api/auth/login.
// A plain <form method="post"> works without JavaScript: 303 to /dashboard.
export async function POST(request) {
  if (process.env.DEMO_MODE !== "1") {
    return Response.json({ error: { code: "not_found", message: "Demo sign-in is switched off" } }, { status: 404 });
  }
  if (!process.env.SESSION_SECRET) {
    return Response.json({ error: { code: "not_configured", message: "Set SESSION_SECRET in the environment." } }, { status: 500 });
  }
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set(SESSION_COOKIE, signSession(process.env.SESSION_SECRET, SESSION_TTL_SECONDS), sessionCookieOptions(request));
  return response;
}
