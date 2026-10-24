import { onPromise, PROMISE_MAX_DAYS } from "../ladder.js";
import { event, stamp, loadInvoice, recomputePause } from "./common.js";
import { badRequest, conflict, notFound } from "./errors.js";

// A promise to pay: at most one open, none after a broken one, 1..14 days ahead (ladder.onPromise). Pauses the ladder.
export async function create(client, ctx, { invoice_id, promised_date, amount_paise = null, actor = "owner" } = {}) {
  if (!["owner", "customer"].includes(actor)) throw badRequest("invalid_actor", "actor must be owner or customer");
  if (amount_paise != null && !(Number.isSafeInteger(amount_paise) && amount_paise > 0)) {
    throw badRequest("invalid_amount", "amount_paise must be a positive whole number of paise");
  }
  const inv = await loadInvoice(client, invoice_id, { lock: true });
  const { rows } = await client.query(
    `SELECT bool_or(status = 'open') AS open, bool_or(status = 'broken') AS broken FROM promises WHERE invoice_id = $1`,
    [inv.id],
  );
  const check = onPromise(
    { ...inv, open_promise: rows[0].open === true, had_broken_promise: rows[0].broken === true },
    promised_date,
    ctx.asOf,
    ctx.cfg.promise_max_days ?? PROMISE_MAX_DAYS,
  );
  if (!check.ok) {
    const status = ["promise_open", "promise_broken_before", "status"].includes(check.error.code) ? 409 : 400;
    throw status === 409 ? conflict(check.error.code, check.error.message) : badRequest(check.error.code, check.error.message);
  }
  if (amount_paise != null && amount_paise > inv.outstanding_paise) throw badRequest("invalid_amount", "The promised amount is more than the outstanding");
  const { rows: created } = await client.query(
    "INSERT INTO promises (invoice_id, promised_date, amount_paise, created_by, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [inv.id, promised_date, amount_paise, actor, stamp(ctx)],
  );
  await recomputePause(client, inv.id);
  await event(client, ctx, inv.id, "promise_made", actor, { promise_id: created[0].id, date: promised_date, amount: amount_paise });
  return created[0];
}

// Called by the tick when the promised date has passed unpaid. The ladder resumes (paused_by recomputed).
export async function markBroken(client, ctx, promise) {
  const id = typeof promise === "object" ? promise?.id : promise;
  const { rows } = await client.query(
    "UPDATE promises SET status = 'broken', resolved_at = $2 WHERE id = $1 AND status = 'open' RETURNING *",
    [id, stamp(ctx)],
  );
  if (!rows.length) throw notFound("open promise");
  await recomputePause(client, rows[0].invoice_id);
  await event(client, ctx, rows[0].invoice_id, "promise_broken", "system", { promise_id: rows[0].id, date: rows[0].promised_date });
  // A missed part of an instalment plan ends the plan; reminders restart from here like any broken promise.
  if (rows[0].plan_id) {
    const { rows: plan } = await client.query("UPDATE payment_plans SET status = 'broken' WHERE id = $1 AND status = 'active' RETURNING id", [rows[0].plan_id]);
    if (plan.length) await event(client, ctx, rows[0].invoice_id, "plan_broken", "system", { plan_id: Number(rows[0].plan_id), date: rows[0].promised_date });
  }
  return rows[0];
}

export async function openFor(client, invoiceId) {
  const { rows } = await client.query("SELECT * FROM promises WHERE invoice_id = $1 AND status = 'open'", [invoiceId]);
  return rows[0] ?? null;
}
