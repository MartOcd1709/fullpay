import { addDays, fyOf, isISODate } from "../time.js";
import { event, stamp, loadInvoice, refreshStatus, recomputePause } from "./common.js";
import { badRequest, conflict, notFound } from "./errors.js";
import * as payments from "./payments.js";

const CN_LOCK = 44;

export async function list(client, ctx, { status = "open" } = {}) {
  const { rows } = await client.query(
    `SELECT x.*, i.number AS invoice_number, i.customer_id, c.name AS customer_name, b.outstanding_paise,
            p.amount_paise AS claim_amount_paise, p.paid_on AS claim_paid_on, p.reference AS claim_reference
     FROM inbox_items x JOIN invoices i ON i.id = x.invoice_id JOIN customers c ON c.id = i.customer_id
     JOIN invoice_balances b ON b.invoice_id = i.id LEFT JOIN payments p ON p.id = x.payment_id
     WHERE ($1::text IS NULL OR x.status = $1) ORDER BY x.opened_on, x.id`,
    [status],
  );
  return rows;
}

async function lockItem(client, id) {
  if (!/^\d+$/.test(String(id))) throw notFound("inbox item");
  const { rows } = await client.query("SELECT * FROM inbox_items WHERE id = $1 FOR UPDATE", [id]);
  if (!rows.length) throw notFound("inbox item");
  if (rows[0].status !== "open") throw conflict("already_resolved", "This item is already resolved");
  return rows[0];
}

async function issueCreditNote(client, ctx, inv, amount_paise, reason) {
  await client.query(`SELECT pg_advisory_xact_lock(${CN_LOCK})`);
  const fy = fyOf(ctx.asOf);
  const { rows } = await client.query("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM credit_notes WHERE fy = $1", [fy]);
  const seq = rows[0].seq;
  const number = `CN/${fy}/${String(seq).padStart(4, "0")}`;
  const { rows: cn } = await client.query(
    "INSERT INTO credit_notes (invoice_id, fy, seq, number, issue_date, amount_paise, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [inv.id, fy, seq, number, ctx.asOf, amount_paise, reason, stamp(ctx)],
  );
  const old_total = inv.total_paise - inv.credited_paise;
  await event(client, ctx, inv.id, "invoice_adjusted", "owner", {
    credit_note_no: number,
    amount_paise,
    old_total,
    new_total: old_total - amount_paise,
    reason,
  });
  return cn[0];
}

const EDITABLE = ["credit_days", "acceptance_date", "ship_to", "notes"];

async function editInvoice(client, ctx, inv, changes) {
  if (!changes || typeof changes !== "object") throw badRequest("invalid_changes", "Say what to change");
  const keys = Object.keys(changes).filter((k) => EDITABLE.includes(k));
  if (!keys.length) throw badRequest("invalid_changes", `Only ${EDITABLE.join(", ")} can change on a sent invoice; use a credit note for amounts`);
  const next = { credit_days: inv.credit_days, acceptance_date: inv.acceptance_date, ship_to: inv.ship_to, notes: inv.notes, ...changes };
  if (!Number.isInteger(next.credit_days) || next.credit_days < 0 || next.credit_days > 45) throw badRequest("invalid_credit_days", "credit_days must be 0 to 45");
  if (!isISODate(next.acceptance_date)) throw badRequest("invalid_date", "acceptance_date must be YYYY-MM-DD");
  const due_date = addDays(next.acceptance_date, next.credit_days);
  await client.query("UPDATE invoices SET credit_days = $2, acceptance_date = $3, ship_to = $4, notes = $5, due_date = $6 WHERE id = $1", [
    inv.id,
    next.credit_days,
    next.acceptance_date,
    next.ship_to,
    next.notes,
    due_date,
  ]);
  await event(client, ctx, inv.id, "invoice_edited", "owner", { fields: keys.sort(), due_date });
}

// action: accept_credit_note {amount_paise, reason?} | mark_paid | reject {reply} | edit {changes}
export async function resolve(client, ctx, id, { action, amount_paise, reason, reply, changes } = {}) {
  const item = await lockItem(client, id);
  const inv = await loadInvoice(client, item.invoice_id, { lock: true });
  const replyText = typeof reply === "string" ? reply.trim().slice(0, 1000) || null : null;
  const close = (resolution, accepted) =>
    client.query("UPDATE inbox_items SET status = 'resolved', resolution = $2, accepted = $3, resolved_on = $4, reply = $5 WHERE id = $1", [
      item.id,
      resolution,
      accepted,
      ctx.asOf,
      replyText,
    ]);

  if (item.kind === "claim") {
    if (action === "mark_paid") await payments.confirm(client, ctx, item.payment_id);
    else if (action === "reject") await payments.reject(client, ctx, item.payment_id, { reply: replyText });
    else throw badRequest("invalid_action", "A payment claim can be marked paid or rejected");
    return get(client, ctx, item.id);
  }

  if (action === "accept_credit_note") {
    if (!(Number.isSafeInteger(amount_paise) && amount_paise > 0)) throw badRequest("invalid_amount", "Credit note amount must be a positive whole number of paise");
    if (amount_paise > inv.outstanding_paise) throw badRequest("invalid_amount", "A credit note cannot be more than the outstanding");
    await issueCreditNote(client, ctx, inv, amount_paise, typeof reason === "string" ? reason.trim().slice(0, 300) || item.reason : item.reason);
    await close(action, true);
  } else if (action === "mark_paid") {
    await close(action, true);
    if (inv.outstanding_paise > 0) {
      const pay = await payments.addManual(client, ctx, {
        invoice_id: inv.id,
        paid_on: ctx.asOf,
        amount_paise: inv.outstanding_paise,
        reference: `Inbox #${item.id}`,
        narration: "Marked paid by the owner while resolving a dispute",
      });
      await payments.confirm(client, ctx, pay.id);
    }
  } else if (action === "reject") {
    if (!replyText) throw badRequest("reply_required", "Write a reply to the customer");
    await close(action, false);
  } else if (action === "edit") {
    await editInvoice(client, ctx, inv, changes);
    await close(action, true);
  } else {
    throw badRequest("invalid_action", "action must be accept_credit_note, mark_paid, reject or edit");
  }
  const accepted = action !== "reject";
  await event(client, ctx, inv.id, accepted ? "dispute_accepted" : "dispute_resolved", "owner", {
    inbox_id: item.id,
    action,
    opened_on: item.opened_on,
    reply: replyText,
  });
  await refreshStatus(client, ctx, inv.id);
  await recomputePause(client, inv.id);
  return get(client, ctx, item.id);
}

export async function get(client, ctx, id) {
  const { rows } = await client.query("SELECT * FROM inbox_items WHERE id = $1", [id]);
  if (!rows.length) throw notFound("inbox item");
  return rows[0];
}
