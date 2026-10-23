import { randomUUID } from "node:crypto";
import { run } from "./services/context.js";
import { badRequest, toResponse } from "./services/errors.js";
import { sessionFromRequest } from "./auth.js";

const MAX_BODY_BYTES = 2_000_000;
const NO_STORE = { "cache-control": "no-store" };

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const deny = (status, code, message) => Response.json({ error: { code, message } }, { status, headers: NO_STORE });

// Wraps a route handler: session check, role check (viewers are read-only; `roles` narrows further), JSON body
// (capped), one transaction with ctx (ctx.user = the signed-in user), an activity row for every change, error contract.
// handler({ request, params, body, client, ctx, user }) returns a plain object (sent as JSON) or a Response.
export function route(handler, { owner = true, txn = true, roles = null } = {}) {
  return async (request, routeCtx) => {
    const requestId = randomUUID();
    try {
      let user = null;
      if (owner) {
        user = sessionFromRequest(request);
        if (!user) return deny(401, "unauthorized", "Login required");
        const allowed = roles ?? (WRITE.has(request.method) ? ["owner", "accountant"] : null);
        if (allowed && !allowed.includes(user.role)) {
          return deny(403, "forbidden", user.role === "viewer" ? "View-only access: ask the owner to make this change" : "Only the owner can do this");
        }
      }
      const params = routeCtx?.params ? await routeCtx.params : {};
      const body = await readBody(request);
      const call = async (client, ctx) => {
        if (ctx) ctx.user = user;
        const out = await handler({ request, params, body, client, ctx, user });
        if (client && user && WRITE.has(request.method)) {
          const target = new URL(request.url).pathname;
          await client.query("INSERT INTO activity (user_id, role, action, target, status) VALUES ($1, $2, $3, $4, $5)", [
            user.uid || null, user.role, request.method, target, out instanceof Response ? out.status : out?.approval_pending ? 202 : 200,
          ]);
        }
        return out;
      };
      const out = txn ? await run(call) : await call(null, null);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true }, { headers: { ...NO_STORE, "x-request-id": requestId } });
    } catch (err) {
      const res = toResponse(err);
      res.headers.set("x-request-id", requestId);
      res.headers.set("cache-control", "no-store");
      return res;
    }
  };
}

async function readBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const type = request.headers.get("content-type") || "";
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw Object.assign(badRequest("too_large", "Request body is larger than 2 MB"), { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw Object.assign(badRequest("too_large", "Request body is larger than 2 MB"), { status: 413 });
  if (!text) return {};
  if (type.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw badRequest("invalid_json", "Body is not valid JSON");
    }
  }
  return { text };
}

// Small boundary validators: throw 400 with the field name.
export const v = {
  int(obj, key, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
    const x = obj?.[key];
    if (x == null && optional) return null;
    if (!Number.isSafeInteger(x) || x < min || x > max) throw badRequest("validation", `${key} must be an integer between ${min} and ${max}`);
    return x;
  },
  str(obj, key, { max = 500, optional = false, pattern } = {}) {
    const x = obj?.[key];
    if ((x == null || x === "") && optional) return null;
    if (typeof x !== "string" || x.length === 0 || x.length > max) throw badRequest("validation", `${key} must be a non-empty string up to ${max} characters`);
    if (pattern && !pattern.test(x)) throw badRequest("validation", `${key} has an invalid format`);
    return x;
  },
  date(obj, key, { optional = false } = {}) {
    return v.str(obj, key, { max: 10, optional, pattern: /^\d{4}-\d{2}-\d{2}$/ });
  },
  oneOf(obj, key, values, { optional = false } = {}) {
    const x = obj?.[key];
    if (x == null && optional) return null;
    if (!values.includes(x)) throw badRequest("validation", `${key} must be one of ${values.join(", ")}`);
    return x;
  },
  id(params, key = "id") {
    const n = Number(params?.[key]);
    if (!Number.isSafeInteger(n) || n <= 0) throw badRequest("validation", `${key} must be a positive integer`);
    return n;
  },
};
