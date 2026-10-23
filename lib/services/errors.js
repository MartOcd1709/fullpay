// Service errors are plain { status, code, message } objects (an Error subclass, so stacks survive).
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const appError = (status, code, message) => new AppError(status, code, message);
export const badRequest = (code, message) => new AppError(400, code, message);
export const notFound = (what = "record") => new AppError(404, "not_found", `${what} not found`);
export const conflict = (code, message) => new AppError(409, code, message);

// Engine and pg errors that are the caller's fault, mapped to 400/409; anything else is a 500 with no detail leaked.
const ENGINE_400 = new Set(["CONFIG_INVALID", "invalid_amount", "INVALID_INPUT", "UPI_AMOUNT_INVALID", "UPI_PARAMS_INVALID", "no_header"]);
const PG = { 23505: [409, "conflict"], 23503: [400, "bad_reference"], 23514: [400, "invalid_value"], "22P02": [400, "invalid_value"], "22007": [400, "invalid_date"], "22008": [400, "invalid_date"] };

export function toStatus(err) {
  if (err instanceof AppError || (Number.isInteger(err?.status) && err?.code)) return { status: err.status, code: err.code, message: err.message };
  if (ENGINE_400.has(err?.code)) return { status: 400, code: String(err.code).toLowerCase(), message: err.message };
  if (PG[err?.code]) {
    const [status, code] = PG[err.code];
    return { status, code, message: status === 409 ? "That conflicts with an existing record" : "Invalid value" };
  }
  return { status: 500, code: "internal", message: "Something went wrong" };
}

export function toResponse(err) {
  const { status, code, message } = toStatus(err);
  if (status >= 500) console.error("[service]", err);
  return Response.json({ error: { code, message } }, { status });
}
