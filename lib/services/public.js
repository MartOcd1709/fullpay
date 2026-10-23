// The customer-facing pay page (/pay/[token]). Token-gated; returns only this invoice's data, never other customers'.
import { isISODate } from "../time.js";
import { upiString } from "../upi.js";
import { event, stamp, loadInvoice, INVOICE_SELECT, recomputePause, displayStatus } from "./common.js";
import { appError, badRequest, conflict, notFound } from "./errors.js";
import * as promises from "./promises.js";

async function byTokenRow(client, ctx, token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw notFound("link");
  const { rows } = await client.query(
    `${INVOICE_SELECT} WHERE i.pay_token = $1 AND i.status <> 'draft'`,
    [token],
  );
  if (!rows.length) throw notFound("link");
  const inv = rows[0];
  if (inv.token_expires_on && inv.token_expires_on < ctx.asOf) throw appError(410, "link_expired", "This link has expired");
  return inv;
}

export async function byToken(client, ctx, token) {
  const inv = await byTokenRow(client, ctx, token);
  const items = await client.query(
      "SELECT position, description, hsn_sac, qty_milli, unit, rate_paise, discount_paise, gst_bps, taxable_paise, cgst_paise, sgst_paise, igst_paise FROM invoice_items WHERE invoice_id = $1 ORDER BY position",
      [inv.id],
    );
  const open = await client.query(
      `SELECT (SELECT kind FROM inbox_items WHERE invoice_id = $1 AND kind = 'dispute' AND status = 'open') AS dispute,
              (SELECT kind FROM inbox_items WHERE invoice_id = $1 AND kind = 'claim' AND status = 'open') AS claim,
              (SELECT promised_date FROM promises WHERE invoice_id = $1 AND status = 'open') AS promise`,
      [inv.id],
    );
  const b = ctx.cfg.business;
  return {
    business: {
      name: b.name,
      address: b.address,
      gstin: b.registration === "unregistered" ? null : b.gstin,
      contact: { email: b.email, phone: b.phone },
      vpa: b.vpa,
      bank: b.bank ? { name: b.bank.name, account_last4: b.bank.account_last4, ifsc: b.bank.ifsc, account_name: b.bank.account_name } : null,
    },
    invoice: {
      number: inv.number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      doc_type: inv.doc_type,
      buyer_name: inv.customer_name,
      items: items.rows,
      taxable_paise: inv.taxable_paise,
      cgst_paise: inv.cgst_paise,
      sgst_paise: inv.sgst_paise,
      igst_paise: inv.igst_paise,
      round_off_paise: inv.round_off_paise,
      total_paise: inv.total_paise,
      outstanding_paise: Math.max(0, inv.outstanding_paise),
      display_status: displayStatus(inv, ctx.asOf),
    },
    upi: inv.outstanding_paise > 0 && b.vpa ? upiString({ pa: b.vpa, pn: b.name, am_paise: inv.outstanding_paise, tn: inv.number }) : null,
    open: { dispute: Boolean(open.rows[0].dispute), claim: Boolean(open.rows[0].claim), promise_date: open.rows[0].promise },
  };
}

const ACTIVE = ["sent", "part_paid"];
const clip = (s, max) => (typeof s === "string" ? s.trim().slice(0, max) : "");

// "I've already paid": a pending payment (never auto-confirmed) + an inbox item; pauses the ladder.
export async function claimPaid(client, ctx, token, { reference, date, amount_paise } = {}) {
  const found = await byTokenRow(client, ctx, token);
  const inv = await loadInvoice(client, found.id, { lock: true });
  if (!ACTIVE.includes(inv.status)) throw conflict("not_open", "This invoice is not open for payment claims");
  if (!isISODate(date) || date > ctx.asOf) throw badRequest("invalid_date", "Payment date must be on or before today");
  if (!(Number.isSafeInteger(amount_paise) && amount_paise > 0)) throw badRequest("invalid_amount", "Enter the amount you paid");
  const ref = clip(reference, 100);
  if (!ref) throw badRequest("reference_required", "Enter the payment reference (UTR / cheque number)");
  const { rows: open } = await client.query("SELECT 1 FROM inbox_items WHERE invoice_id = $1 AND kind = 'claim' AND status = 'open'", [inv.id]);
  if (open.length) throw conflict("claim_open", "A payment claim is already waiting for the seller to check");
  const { rows } = await client.query(
    `INSERT INTO payments (customer_id, source, paid_on, amount_paise, reference, narration, status, match_confidence, match_reason, flags, created_at)
     VALUES ($1, 'claim', $2, $3, $4, $5, 'pending', NULL, $6, $7, $8) RETURNING id`,
    [inv.customer_id, date, amount_paise, ref, `Customer says paid: ${ref}`, `Customer claims payment against ${inv.number}`,
      amount_paise > inv.outstanding_paise ? ["overpaid"] : amount_paise < inv.outstanding_paise ? ["part"] : [], stamp(ctx)],
  );
  const paymentId = rows[0].id;
  await client.query("INSERT INTO payment_proposals (payment_id, invoice_id, amount_paise) VALUES ($1,$2,$3)", [
    paymentId,
    inv.id,
    Math.min(amount_paise, inv.outstanding_paise),
  ]);
  const { rows: item } = await client.query(
    "INSERT INTO inbox_items (invoice_id, kind, payment_id, reason, opened_on, created_at) VALUES ($1,'claim',$2,$3,$4,$5) RETURNING id",
    [inv.id, paymentId, `Paid ${ref} on ${date}`, ctx.asOf, stamp(ctx)],
  );
  await recomputePause(client, inv.id);
  await event(client, ctx, inv.id, "claim_submitted", "customer", { inbox_id: item[0].id, payment_id: paymentId, ref, date, amount: amount_paise });
  return { inbox_id: item[0].id, payment_id: paymentId };
}

// "Something's wrong": status 'disputed', ladder paused. Interest keeps accruing unless the owner accepts.
export async function dispute(client, ctx, token, { reason } = {}) {
  const found = await byTokenRow(client, ctx, token);
  const inv = await loadInvoice(client, found.id, { lock: true });
  if (!ACTIVE.includes(inv.status)) throw conflict("not_open", inv.status === "disputed" ? "A dispute is already open" : "This invoice is not open");
  const why = clip(reason, 1000);
  if (!why) throw badRequest("reason_required", "Tell the seller what is wrong");
  const { rows } = await client.query(
    "INSERT INTO inbox_items (invoice_id, kind, reason, opened_on, created_at) VALUES ($1,'dispute',$2,$3,$4) RETURNING id",
    [inv.id, why, ctx.asOf, stamp(ctx)],
  );
  await client.query("UPDATE invoices SET status = 'disputed' WHERE id = $1", [inv.id]);
  await recomputePause(client, inv.id);
  await event(client, ctx, inv.id, "dispute_opened", "customer", { inbox_id: rows[0].id, reason: why, prev_status: inv.status });
  return { inbox_id: rows[0].id };
}

export async function promise(client, ctx, token, { date } = {}) {
  const found = await byTokenRow(client, ctx, token);
  return promises.create(client, ctx, { invoice_id: found.id, promised_date: date, actor: "customer" });
}
