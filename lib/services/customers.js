import { validateGSTIN, STATE_CODES } from "../gst.js";
import { reliability } from "../forecast.js";
import { event, stamp } from "./common.js";
import { badRequest, notFound } from "./errors.js";

const MAX_CREDIT_DAYS = 45; // MSMED Act s.15: an agreed credit period cannot exceed 45 days

// Paid history per customer: { due_date, paid_on } where paid_on is the day the invoice was fully settled.
async function histories(client, customerId = null) {
  const { rows } = await client.query(
    `SELECT i.customer_id, i.due_date, i.status, b.outstanding_paise, b.last_settled_on
     FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
     WHERE i.status <> 'draft' AND ($1::bigint IS NULL OR i.customer_id = $1)`,
    [customerId],
  );
  const by = new Map();
  for (const r of rows) {
    const h = by.get(r.customer_id) ?? { invoices: [], owed: 0 };
    h.invoices.push({ due_date: r.due_date, paid_on: r.status === "paid" ? r.last_settled_on : null });
    if (r.status !== "paid") h.owed += Math.max(0, r.outstanding_paise);
    by.set(r.customer_id, h);
  }
  return by;
}

function decorate(row, h, ctx) {
  const rel = reliability(row, h?.invoices ?? [], { today: ctx.asOf, thresholds: ctx.cfg.reliability });
  return { ...row, total_owed_paise: h?.owed ?? 0, ...rel };
}

// For forecast/chase: [{ id, name, avg_late_days, grade, ... }]
export async function listWithReliability(client, ctx) {
  const { rows } = await client.query("SELECT * FROM customers ORDER BY id");
  const by = await histories(client);
  return rows.map((r) => decorate(r, by.get(r.id), ctx));
}

export const list = listWithReliability;

export async function get(client, ctx, id) {
  if (!/^\d+$/.test(String(id))) throw notFound("customer");
  const { rows } = await client.query("SELECT * FROM customers WHERE id = $1", [id]);
  if (!rows.length) throw notFound("customer");
  const by = await histories(client, rows[0].id);
  return decorate(rows[0], by.get(rows[0].id), ctx);
}

const text = (v, max = 500) => {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || v.length > max) throw badRequest("invalid_text", `text must be at most ${max} characters`);
  return v.trim() || null;
};

function normalize(input, existing = {}) {
  const merged = { ...existing, ...input };
  const name = text(merged.name, 200);
  if (!name) throw badRequest("name_required", "Customer name is required");
  let gstin = text(merged.gstin, 15);
  let state_code = merged.state_code == null ? null : String(merged.state_code).padStart(2, "0");
  if (gstin) {
    const v = validateGSTIN(gstin);
    if (!v.valid) throw badRequest("invalid_gstin", `GSTIN is not valid (${v.reason})`);
    gstin = v.gstin;
    state_code = v.state_code;
  } else if (!state_code || !Object.hasOwn(STATE_CODES, state_code)) {
    throw badRequest("state_required", "An unregistered customer needs a valid two-digit state code");
  }
  let credit_days = merged.credit_days;
  if (credit_days === "" || credit_days === undefined) credit_days = null;
  if (credit_days !== null) {
    if (!Number.isInteger(credit_days) || credit_days < 0) throw badRequest("invalid_credit_days", "credit_days must be a whole number of days");
    credit_days = Math.min(credit_days, MAX_CREDIT_DAYS);
  }
  const preferred_lang = merged.preferred_lang ?? "en";
  if (!["en", "hi"].includes(preferred_lang)) throw badRequest("invalid_lang", "preferred_lang must be en or hi");
  return {
    name,
    gstin,
    state_code,
    address: text(merged.address),
    email: text(merged.email, 200),
    phone: text(merged.phone, 40),
    credit_days,
    preferred_lang,
  };
}

const COLS = ["name", "gstin", "state_code", "address", "email", "phone", "credit_days", "preferred_lang"];

export async function create(client, ctx, input) {
  const c = normalize(input);
  const { rows } = await client.query(
    `INSERT INTO customers (${COLS.join(", ")}, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [...COLS.map((k) => c[k]), stamp(ctx)],
  );
  return get(client, ctx, rows[0].id);
}

export async function update(client, ctx, id, input) {
  const current = await get(client, ctx, id);
  if (current.anonymized_at) throw badRequest("anonymized", "This customer was anonymised and cannot be edited");
  const c = normalize(input, Object.fromEntries(COLS.map((k) => [k, current[k]])));
  await client.query(`UPDATE customers SET ${COLS.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [
    current.id,
    ...COLS.map((k) => c[k]),
  ]);
  return get(client, ctx, current.id);
}

export async function setOptOut(client, ctx, id, opt_out) {
  if (typeof opt_out !== "boolean") throw badRequest("invalid_opt_out", "opt_out must be true or false");
  const current = await get(client, ctx, id);
  if (current.opt_out !== opt_out) {
    await client.query("UPDATE customers SET opt_out = $2 WHERE id = $1", [current.id, opt_out]);
    await event(client, ctx, null, "optout_set", "owner", { customer_id: current.id, opt_out });
  }
  return get(client, ctx, current.id);
}

// DPDP-style erasure: personal fields go, invoices and totals stay (CGST s.36 retention). GSTIN stays on issued tax invoices.
export async function anonymize(client, ctx, id) {
  const current = await get(client, ctx, id);
  if (!current.anonymized_at) {
    await client.query(
      `UPDATE customers SET name = 'Anonymised customer #' || id, email = NULL, phone = NULL, address = NULL, anonymized_at = $2
       WHERE id = $1`,
      [current.id, stamp(ctx)],
    );
    await event(client, ctx, null, "anonymized", "owner", { customer_id: current.id });
  }
  return get(client, ctx, current.id);
}
