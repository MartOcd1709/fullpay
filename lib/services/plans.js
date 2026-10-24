// Instalment plans: the customer offers on the pay link to pay one bill in 2 or 3 parts; the owner approves or declines it
// in the Inbox (inbox_items kind 'plan'). While the offer waits, reminders pause. Once approved, the part now due is the
// bill's open promise (promises.plan_id): paying it moves the promise to the next part, and a missed part breaks the
// promise, which restarts reminders exactly as a broken promise always has (see promises.markBroken).
import { validatePlan, nextDue } from "../plans.js";
import { event, stamp, loadInvoice, recomputePause } from "./common.js";
import { badRequest, conflict } from "./errors.js";

const ACTIVE = ["sent", "part_paid"];
const settled = (inv) => Number(inv.paid_paise) + Number(inv.credited_paise);
const paidSince = (inv, plan) => settled(inv) - Number(plan.base_settled_paise);

export async function propose(client, ctx, invoiceId, { parts } = {}) {
  const inv = await loadInvoice(client, invoiceId, { lock: true });
  if (!ACTIVE.includes(inv.status)) throw conflict("not_open", "This bill is not open");
  if (inv.paused_by === "claim") throw conflict("plan_blocked", "Your payment claim is still being checked");
  const { rows: live } = await client.query("SELECT 1 FROM payment_plans WHERE invoice_id = $1 AND status IN ('proposed','active')", [inv.id]);
  if (live.length) throw conflict("plan_open", "A plan to pay in parts is already in place for this bill");
  const check = validatePlan(parts, { outstanding_paise: inv.outstanding_paise, today: ctx.asOf });
  if (!check.ok) throw badRequest(check.error.code, check.error.message);
  const { rows: item } = await client.query(
    "INSERT INTO inbox_items (invoice_id, kind, reason, opened_on, created_at) VALUES ($1,'plan',$2,$3,$4) RETURNING id",
    [inv.id, `Pay in ${check.parts.length} parts`, ctx.asOf, stamp(ctx)],
  );
  const { rows: plan } = await client.query(
    "INSERT INTO payment_plans (invoice_id, inbox_item_id, parts, base_settled_paise, created_at) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *",
    [inv.id, item[0].id, JSON.stringify(check.parts), settled(inv), stamp(ctx)],
  );
  await recomputePause(client, inv.id);
  await event(client, ctx, inv.id, "plan_proposed", "customer", { plan_id: Number(plan[0].id), inbox_id: Number(item[0].id), parts: check.parts });
  return plan[0];
}

// The owner's answer, called from inbox.resolve (which closes the Inbox item and records the reply).
export async function decide(client, ctx, item, { approve, reply = null }) {
  const { rows } = await client.query("SELECT * FROM payment_plans WHERE inbox_item_id = $1 AND status = 'proposed' FOR UPDATE", [item.id]);
  const plan = rows[0];
  if (!plan) throw conflict("not_open", "This plan is no longer waiting for an answer");
  await client.query("UPDATE payment_plans SET status = $2, decided_at = $3 WHERE id = $1", [plan.id, approve ? "active" : "declined", stamp(ctx)]);
  if (!approve) {
    await event(client, ctx, plan.invoice_id, "plan_declined", "owner", { plan_id: Number(plan.id), reply });
    return { ...plan, status: "declined" };
  }
  // A single-date promise made earlier gives way to the plan's own dates.
  await client.query("UPDATE promises SET status = 'cancelled', resolved_at = $2 WHERE invoice_id = $1 AND status = 'open'", [plan.invoice_id, stamp(ctx)]);
  await event(client, ctx, plan.invoice_id, "plan_approved", "owner", { plan_id: Number(plan.id), parts: plan.parts });
  await advance(client, ctx, plan.invoice_id);
  return { ...plan, status: "active" };
}

// Moves an active plan along after a payment (or the approval): the part now due is the bill's one open promise, a part the
// money has covered is kept, and once every part is paid the plan is complete.
export async function advance(client, ctx, invoiceId) {
  const { rows } = await client.query("SELECT * FROM payment_plans WHERE invoice_id = $1 AND status = 'active' FOR UPDATE", [invoiceId]);
  const plan = rows[0];
  if (!plan) return null;
  const inv = await loadInvoice(client, invoiceId);
  const next = inv.outstanding_paise > 0 ? nextDue(plan.parts, paidSince(inv, plan)) : null;
  const { rows: open } = await client.query("SELECT * FROM promises WHERE invoice_id = $1 AND status = 'open' FOR UPDATE", [invoiceId]);
  const cur = open[0];
  if (cur && next && String(cur.plan_id) === String(plan.id) && cur.promised_date === next.date) return plan; // still on the same part
  if (cur) {
    await client.query("UPDATE promises SET status = 'kept', resolved_at = $2 WHERE id = $1", [cur.id, stamp(ctx)]);
    await event(client, ctx, invoiceId, "promise_kept", "system", { promise_id: Number(cur.id), plan_id: Number(plan.id) });
  }
  if (!next) {
    await client.query("UPDATE payment_plans SET status = 'completed' WHERE id = $1", [plan.id]);
    await event(client, ctx, invoiceId, "plan_completed", "system", { plan_id: Number(plan.id), parts: plan.parts.length });
  } else {
    const { rows: p } = await client.query(
      "INSERT INTO promises (invoice_id, promised_date, amount_paise, created_by, plan_id, created_at) VALUES ($1,$2,$3,'customer',$4,$5) RETURNING id",
      [invoiceId, next.date, next.amount_paise, plan.id, stamp(ctx)],
    );
    await event(client, ctx, invoiceId, "promise_made", "customer", {
      promise_id: Number(p[0].id), date: next.date, amount: next.amount_paise, plan_id: Number(plan.id), part: next.number, of: next.of,
    });
  }
  await recomputePause(client, invoiceId);
  return plan;
}

// The pay page's view of the latest plan on a bill: where each part stands, or why it was declined.
export async function forBill(client, inv) {
  const { rows } = await client.query(
    `SELECT p.*, ii.reply FROM payment_plans p LEFT JOIN inbox_items ii ON ii.id = p.inbox_item_id
     WHERE p.invoice_id = $1 ORDER BY p.id DESC LIMIT 1`,
    [inv.id],
  );
  const plan = rows[0];
  if (!plan) return null;
  const since = paidSince(inv, plan);
  let upTo = 0;
  const parts = plan.parts.map((p) => ({ ...p, paid: since >= (upTo += p.amount_paise) }));
  return { status: plan.status, parts, next: plan.status === "active" ? nextDue(plan.parts, since) : null, reply: plan.status === "declined" ? plan.reply : null };
}
