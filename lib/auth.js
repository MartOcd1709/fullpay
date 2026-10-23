import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 5;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const hmacHex = (secret, message) => createHmac("sha256", secret).update(message).digest("hex");
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest();
const sameBytes = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export const ROLES = ["owner", "accountant", "viewer"];

// Token: "<uid>.<role>.<exp>.<hmac>". A legacy "<exp>.<hmac>" token reads as the owner (uid 0).
export function signSession(secret, ttlSeconds = SESSION_TTL_SECONDS, { uid = 0, role = "owner" } = {}) {
  if (typeof secret !== "string" || secret.length === 0) throw new Error("signSession: secret required");
  if (!ROLES.includes(role) || !Number.isSafeInteger(uid) || uid < 0) throw new Error("signSession: bad user");
  const body = `${uid}.${role}.${nowSeconds() + Math.trunc(ttlSeconds)}`;
  return `${body}.${hmacHex(secret, body)}`;
}

export function parseSession(secret, token) {
  if (typeof secret !== "string" || secret.length === 0 || typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  let uid = 0, role = "owner", exp, body;
  if (parts.length === 2) [exp] = parts, body = exp;
  else if (parts.length === 4) {
    [uid, role, exp] = parts;
    body = `${uid}.${role}.${exp}`;
    if (!/^\d{1,12}$/.test(uid) || !ROLES.includes(role)) return null;
    uid = Number(uid);
  } else return null;
  if (!/^\d{1,12}$/.test(exp)) return null;
  if (!sameBytes(Buffer.from(parts.at(-1), "utf8"), Buffer.from(hmacHex(secret, body), "utf8"))) return null;
  if (Number(exp) <= nowSeconds()) return null;
  return { uid, role, exp: Number(exp) };
}

export function verifySession(secret, token) {
  return parseSession(secret, token) !== null;
}

export function checkPassword(input) {
  const expected = process.env.OWNER_PASSWORD;
  if (typeof input !== "string" || typeof expected !== "string" || expected.length === 0) return false;
  return sameBytes(sha256(input), sha256(expected));
}

const attempts = new Map();
// ponytail: per-process Map, resets on restart and is not shared across instances; move to Postgres if we ever run more than one.
export function loginAllowed(ip, now = Date.now()) {
  if (attempts.size > 1000) {
    for (const [key, times] of attempts) if (now - times[times.length - 1] >= LOGIN_WINDOW_MS) attempts.delete(key);
  }
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  const allowed = recent.length < LOGIN_MAX_ATTEMPTS;
  if (allowed) recent.push(now);
  attempts.set(ip, recent);
  return allowed;
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  // The last hop is appended by the platform proxy; earlier entries are client-supplied and spoofable.
  return forwarded?.split(",").at(-1).trim() || request.headers.get("x-real-ip") || "local";
}

export function sessionCookieOptions(request) {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return { httpOnly: true, secure: proto === "https", sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS };
}

function readCookie(request, name) {
  const fromStore = request.cookies?.get?.(name)?.value;
  if (fromStore !== undefined) return fromStore;
  const header = request.headers?.get?.("cookie") ?? "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function getSessionFromCookies(cookieStore) {
  return parseSession(process.env.SESSION_SECRET, cookieStore?.get?.(SESSION_COOKIE)?.value);
}

export function sessionFromRequest(request) {
  return parseSession(process.env.SESSION_SECRET, readCookie(request, SESSION_COOKIE));
}

export function requireOwner(request) {
  if (sessionFromRequest(request)) return null;
  return Response.json({ error: { code: "unauthorized", message: "Login required" } }, { status: 401 });
}
