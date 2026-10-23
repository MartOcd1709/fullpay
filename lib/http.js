import { randomUUID } from "node:crypto";
import { run } from "./services/context.js";
import { badRequest, toResponse } from "./services/errors.js";
import { requireOwner } from "./auth.js";

const MAX_BODY_BYTES = 1_000_000;
const NO_STORE = { "cache-control": "no-store" };

// Wraps a route handler: optional owner auth, JSON body (capped), one transaction with ctx, uniform error contract.
// handler({ request, params, body, client, ctx }) returns a plain object (sent as JSON) or a Response.
export function route(handler, { owner = true, txn = true } = {}) {
  return async (request, routeCtx) => {
    const requestId = randomUUID();
    try {
      if (owner) {
        const denied = requireOwner(request);
        if (denied) return denied;
      }
      const params = routeCtx?.params ? await routeCtx.params : {};
      const body = await readBody(request);
      const call = (client, ctx) => handler({ request, params, body, client, ctx });
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
  if (length > MAX_BODY_BYTES) throw Object.assign(badRequest("too_large", "Request body is larger than 1 MB"), { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw Object.assign(badRequest("too_large", "Request body is larger than 1 MB"), { status: 413 });
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
