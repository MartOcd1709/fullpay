import { NextResponse } from "next/server";
import { sessionCookieOptions, signSession, SESSION_COOKIE, SESSION_TTL_SECONDS, ROLES } from "@/lib/auth";
import { withTxn } from "@/lib/db";
import * as users from "@/lib/services/users";

// K1: one-click demo entry, only when DEMO_MODE=1. ?as=owner|accountant|viewer (default owner) signs in as that demo team member.
// A plain <form method="post"> works without JavaScript: 303 to /dashboard.
export async function POST(request) {
  if (process.env.DEMO_MODE !== "1") {
    return Response.json({ error: { code: "not_found", message: "Demo sign-in is switched off" } }, { status: 404 });
  }
  if (!process.env.SESSION_SECRET) {
    return Response.json({ error: { code: "not_configured", message: "Set SESSION_SECRET in the environment." } }, { status: 500 });
  }
  const url = new URL(request.url);
  const form = request.headers.get("content-type")?.includes("form") ? await request.formData().catch(() => null) : null;
  const asked = form?.get("as") ?? url.searchParams.get("as") ?? "owner";
  const role = ROLES.includes(asked) ? asked : "owner";
  const member = await withTxn(async (c) => {
    await users.ensureDemoTeam(c);
    return users.byRole(c, role);
  });
  const asked_next = String(form?.get("next") ?? url.searchParams.get("next") ?? "");
  const next = /^\/(?![/\\])[\w\-/]*$/.test(asked_next) ? asked_next : role === "accountant" ? "/payments" : "/dashboard";
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, signSession(process.env.SESSION_SECRET, SESSION_TTL_SECONDS, { uid: Number(member?.id ?? 0), role }), sessionCookieOptions(request));
  return response;
}
