import { appendEvent } from "../chain.js";
import { computeInterest } from "../interest.js";
import { addDays, daysBetween } from "../time.js";
import { notFound } from "./errors.js";

export const stamp = (ctx) => (typeof ctx.ts === "function" ? ctx.ts() : ctx.ts);

export const event = (client, ctx, invoice_id, type, actor, payload = {}) =>
  appendEvent(client, { invoice_id, type, actor, payload, run_id: ctx.run_id ?? null, ts: stamp(ctx) });

export const INVOICE_SELECT = `
  SELECT i.*, b.paid_paise, b.credited_paise, b.outstanding_paise, b.last_paid_on, b.last_settled_on,
         to_char(i.pay_token_expires_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS token_expires_on,
         c.name AS customer_name, c.opt_out AS customer_opt_out
  FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id JOIN customers c ON c.id = i.customer_id`;

export async function loadInvoice(client, id, { lock = false } = {}) {
  if (!/^\d+$/.test(String(id))) throw notFound("invoice");
  if (lock) await client.query("SELECT 1 FROM invoices WHERE id = $1 FOR UPDATE", [id]);
  const { rows } = await client.query(`${INVOICE_SELECT} WHERE i.id = $1`, [id]);
  if (!rows.length) throw notFound("invoice");
  return rows[0];
}

export const isOpenStatus = (status) => status === "sent" || status === "part_paid" || status === "disputed";

// Stored status follows the money: open dispute > paid > part paid > sent. Drafts never change here.
export async function refreshStatus(client, ctx, id) {
  const inv = await loadInvoice(client, id);
  if (inv.status === "draft") return inv;
  const { rows } = await client.query("SELECT 1 FROM inbox_items WHERE invoice_id = $1 AND kind = 'dispute' AND status = 'open'", [id]);
  const status = rows.length ? "disputed" : inv.outstanding_paise <= 0 ? "paid" : inv.paid_paise > 0 ? "part_paid" : "sent";
  if (status !== inv.status) {
    const paid = status === "paid";
    await client.query(
      `UPDATE invoices SET status = $2, pay_token = CASE WHEN $3 THEN NULL ELSE pay_token END,
              pay_token_expires_at = CASE WHEN $3 THEN NULL ELSE pay_token_expires_at END WHERE id = $1`,
      [id, status, paid],
    );
    if (paid) await closePromiseKept(client, ctx, id);
  }
  return { ...inv, status };
}

async function closePromiseKept(client, ctx, id) {
  const { rows } = await client.query(
    "UPDATE promises SET status = 'kept', resolved_at = $2 WHERE invoice_id = $1 AND status = 'open' RETURNING id",
    [id, stamp(ctx)],
  );
  for (const p of rows) await event(client, ctx, id, "promise_kept", "system", { promise_id: p.id });
}

// paused_by is derived: open dispute > open claim > open promise > nothing. Clearing it resumes the ladder.
export async function recomputePause(client, id) {
  const { rows } = await client.query(
    `SELECT CASE
       WHEN EXISTS (SELECT 1 FROM inbox_items WHERE invoice_id = $1 AND kind = 'dispute' AND status = 'open') THEN 'dispute'
       WHEN EXISTS (SELECT 1 FROM inbox_items WHERE invoice_id = $1 AND kind = 'claim' AND status = 'open') THEN 'claim'
       WHEN EXISTS (SELECT 1 FROM promises WHERE invoice_id = $1 AND status = 'open') THEN 'promise'
     END AS paused_by`,
    [id],
  );
  await client.query("UPDATE invoices SET paused_by = $2 WHERE id = $1", [id, rows[0].paused_by]);
  return rows[0].paused_by;
}

export const interestEligible = (cfg) =>
  cfg.business?.udyam === true && (cfg.msmed?.eligible ?? ["micro", "small"]).includes(cfg.business?.udyam_class);

export async function interestInputs(client, id) {
  // Sequential on purpose: one pg client must not run overlapping queries.
  const alloc = await client.query(
      `SELECT pa.allocated_on AS date, pa.amount_paise FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed' WHERE pa.invoice_id = $1 ORDER BY pa.allocated_on, pa.id`,
      [id],
    );
  const spans = await client.query(
      "SELECT opened_on AS from, resolved_on AS to FROM inbox_items WHERE invoice_id = $1 AND kind = 'dispute' AND accepted ORDER BY opened_on",
      [id],
    );
  return { allocations: alloc.rows, dispute_spans: spans.rows };
}

// MSMED s.16 interest, only for a Udyam micro/small seller and an open invoice past its due date. Credit notes reduce principal.
export function interestFor(cfg, inv, { allocations, dispute_spans }, asOf) {
  if (!interestEligible(cfg) || inv.status === "draft" || inv.outstanding_paise <= 0 || !(asOf > inv.due_date)) return null;
  return computeInterest({
    principal_paise: Math.max(0, inv.total_paise - inv.credited_paise),
    due_date: inv.due_date,
    as_of: asOf,
    series: cfg.rbi_bank_rate.series,
    multiplier: cfg.msmed.s16_multiplier,
    allocations,
    dispute_spans,
    appropriation: cfg.msmed.appropriation,
    day_count: cfg.msmed.day_count,
  });
}

export function displayStatus(inv, asOf) {
  if (["draft", "paid", "disputed", "part_paid"].includes(inv.status)) return inv.status;
  const days = daysBetween(inv.due_date, asOf);
  return days > 0 ? "overdue" : days >= -3 ? "due_soon" : "sent";
}

export const isDueSoon = (inv, asOf) => isOpenStatus(inv.status) && inv.due_date >= asOf && inv.due_date <= addDays(asOf, 3);
export const isOverdue = (inv, asOf) => isOpenStatus(inv.status) && inv.due_date < asOf;

export const tokenExpiry = (date) => `${date}T23:59:59+05:30`;
