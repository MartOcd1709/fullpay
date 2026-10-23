import { NextResponse } from "next/server";
import { checkPassword, clientIp, loginAllowed, sessionCookieOptions, signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";
import { withTxn } from "@/lib/db";
import * as users from "@/lib/services/users";

const fail = (status, code, message) => Response.json({ error: { code, message } }, { status });

// { email, password } signs in a team member; { password } alone is the owner's setup password (OWNER_PASSWORD).
export async function POST(request) {
  if (!loginAllowed(clientIp(request))) return fail(429, "rate_limited", "Too many attempts. Try again in a minute.");
  if (!process.env.SESSION_SECRET) return fail(500, "not_configured", "Set SESSION_SECRET in the environment.");
  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== "string" || body.password.length > 200) return fail(400, "validation", "Send JSON { email?, password }.");
  let who = null;
  if (typeof body.email === "string" && body.email.trim()) {
    who = await withTxn((c) => users.authenticate(c, body.email, body.password));
  } else if (process.env.OWNER_PASSWORD && checkPassword(body.password)) {
    const owner = await withTxn((c) => users.byRole(c, "owner"));
    who = { uid: owner ? Number(owner.id) : 0, role: "owner" };
  }
  if (!who) return fail(401, "wrong_password", "Wrong email or password.");
  const response = NextResponse.json({ ok: true, role: who.role, expiresIn: SESSION_TTL_SECONDS });
  response.cookies.set(SESSION_COOKIE, signSession(process.env.SESSION_SECRET, SESSION_TTL_SECONDS, { uid: who.uid, role: who.role }), sessionCookieOptions(request));
  return response;
}
