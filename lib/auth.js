import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 5;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const hmacHex = (secret, message) => createHmac("sha256", secret).update(message).digest("hex");
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest();
const sameBytes = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export function signSession(secret, ttlSeconds = SESSION_TTL_SECONDS) {
  if (typeof secret !== "string" || secret.length === 0) throw new Error("signSession: secret required");
  const exp = String(nowSeconds() + Math.trunc(ttlSeconds));
  return `${exp}.${hmacHex(secret, exp)}`;
}

export function verifySession(secret, token) {
  if (typeof secret !== "string" || secret.length === 0 || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d{1,12}$/.test(exp)) return false;
  if (!sameBytes(Buffer.from(mac, "utf8"), Buffer.from(hmacHex(secret, exp), "utf8"))) return false;
  return Number(exp) > nowSeconds();
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
  const token = cookieStore?.get?.(SESSION_COOKIE)?.value;
  if (!verifySession(process.env.SESSION_SECRET, token)) return null;
  return { exp: Number(token.slice(0, token.indexOf("."))) };
}

export function requireOwner(request) {
  if (verifySession(process.env.SESSION_SECRET, readCookie(request, SESSION_COOKIE))) return null;
  return Response.json({ error: { code: "unauthorized", message: "Login required" } }, { status: 401 });
}
