import test from "node:test";
import assert from "node:assert/strict";
import {
  clientIp,
  signSession,
  verifySession,
  checkPassword,
  loginAllowed,
  getSessionFromCookies,
  requireOwner,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "../lib/auth.js";

const SECRET = "test-secret-0123456789abcdef";

test("signSession/verifySession round trip", () => {
  const token = signSession(SECRET, 60);
  assert.match(token, /^\d+\.[0-9a-f]{64}$/);
  assert.equal(verifySession(SECRET, token), true);
});

test("tampered token fails", () => {
  const token = signSession(SECRET, 60);
  const [exp, mac] = token.split(".");
  const flipped = (mac[0] === "a" ? "b" : "a") + mac.slice(1);
  assert.equal(verifySession(SECRET, `${exp}.${flipped}`), false);
  assert.equal(verifySession(SECRET, `${Number(exp) + 3600}.${mac}`), false);
  assert.equal(verifySession("other-secret", token), false);
  assert.equal(verifySession(SECRET, mac), false);
  assert.equal(verifySession(SECRET, `${exp}.`), false);
  assert.equal(verifySession(SECRET, ""), false);
  assert.equal(verifySession(SECRET, undefined), false);
  assert.equal(verifySession("", token), false);
  assert.equal(verifySession(undefined, token), false);
});

test("expired token fails", () => {
  assert.equal(verifySession(SECRET, signSession(SECRET, -1)), false);
  assert.equal(verifySession(SECRET, signSession(SECRET, 0)), false);
  assert.equal(verifySession(SECRET, signSession(SECRET, 1)), true);
});

test("checkPassword is constant-time safe for equal and unequal lengths", () => {
  process.env.OWNER_PASSWORD = "correct horse";
  assert.equal(checkPassword("correct horse"), true);
  assert.equal(checkPassword("correct h0rse"), false);
  assert.equal(checkPassword("correct"), false);
  assert.equal(checkPassword("correct horse battery staple"), false);
  assert.equal(checkPassword(""), false);
  assert.equal(checkPassword(undefined), false);
  assert.equal(checkPassword(12345), false);
  process.env.OWNER_PASSWORD = "";
  assert.equal(checkPassword(""), false);
  delete process.env.OWNER_PASSWORD;
  assert.equal(checkPassword("anything"), false);
});

test("login rate limiter allows 5 attempts per IP per minute", () => {
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 5; i++) assert.equal(loginAllowed("10.0.0.1", t0 + i), true);
  assert.equal(loginAllowed("10.0.0.1", t0 + 10), false);
  assert.equal(loginAllowed("10.0.0.2", t0 + 10), true);
  assert.equal(loginAllowed("10.0.0.1", t0 + 60_000), true);
});

test("getSessionFromCookies and requireOwner re-check the cookie", async () => {
  process.env.SESSION_SECRET = SECRET;
  const token = signSession(SECRET, 60);
  const store = (value) => ({ get: (name) => (name === SESSION_COOKIE && value !== undefined ? { name, value } : undefined) });

  assert.equal(typeof getSessionFromCookies(store(token)).exp, "number");
  assert.equal(getSessionFromCookies(store("bad.token")), null);
  assert.equal(getSessionFromCookies(store(undefined)), null);

  const withCookie = new Request("http://localhost:3000/api/invoices", { headers: { cookie: `lang=en; ${SESSION_COOKIE}=${token}` } });
  assert.equal(requireOwner(withCookie), null);

  const nextLike = { cookies: { get: () => ({ value: token }) }, headers: new Headers() };
  assert.equal(requireOwner(nextLike), null);

  const denied = requireOwner(new Request("http://localhost:3000/api/invoices"));
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { error: { code: "unauthorized", message: "Login required" } });

  const forged = requireOwner(new Request("http://localhost:3000/api/invoices", { headers: { cookie: `${SESSION_COOKIE}=${token}x` } }));
  assert.equal(forged.status, 401);
});

test("session cookie is secure only over https", () => {
  const local = sessionCookieOptions(new Request("http://localhost:3000/api/auth/login"));
  assert.equal(local.secure, false);
  assert.equal(local.httpOnly, true);
  assert.equal(local.sameSite, "lax");
  assert.equal(local.path, "/");
  assert.equal(local.maxAge, 12 * 60 * 60);
  const proxied = sessionCookieOptions(new Request("http://fullpay.onrender.com/api/auth/login", { headers: { "x-forwarded-proto": "https" } }));
  assert.equal(proxied.secure, true);
});

test("clientIp uses the proxy-appended last X-Forwarded-For hop", () => {
  const req = { headers: new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }) };
  assert.equal(clientIp(req), "203.0.113.9");
});
