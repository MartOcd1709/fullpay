import { NextResponse } from "next/server";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request) {
  const response = new NextResponse(null, { status: 303, headers: { Location: "/login" } }) // relative: request.url is the internal host on Render;
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(request), maxAge: 0 });
  return response;
}
