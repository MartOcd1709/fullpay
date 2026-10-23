import { NextResponse } from "next/server";
import { checkPassword, clientIp, loginAllowed, sessionCookieOptions, signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

const fail = (status, code, message) => Response.json({ error: { code, message } }, { status });

export async function POST(request) {
  if (!loginAllowed(clientIp(request))) return fail(429, "rate_limited", "Too many attempts. Try again in a minute.");
  if (!process.env.OWNER_PASSWORD || !process.env.SESSION_SECRET) {
    return fail(500, "not_configured", "Set OWNER_PASSWORD and SESSION_SECRET in the environment.");
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== "string") return fail(400, "validation", "Send JSON { password }.");
  if (!checkPassword(body.password)) return fail(401, "wrong_password", "Wrong password.");
  const response = NextResponse.json({ ok: true, expiresIn: SESSION_TTL_SECONDS });
  response.cookies.set(SESSION_COOKIE, signSession(process.env.SESSION_SECRET, SESSION_TTL_SECONDS), sessionCookieOptions(request));
  return response;
}
