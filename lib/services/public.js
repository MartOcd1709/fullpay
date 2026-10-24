// The customer-facing pay page (/pay/[token]). Token-gated; returns only this invoice's data, never other customers'.
import { isISODate } from "../time.js";
import { upiString } from "../upi.js";
import { event, stamp, loadInvoice, INVOICE_SELECT, recomputePause, displayStatus } from "./common.js";
import { appError, badRequest, conflict, notFound } from "./errors.js";
import * as promises from "./promises.js";
import * as plans from "./plans.js";
import { canSplit, suggestParts, PLAN_MAX_DAYS } from "../plans.js";
import { addDays } from "../time.js";

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
  // A pay-early offer still open today: the QR and the button ask for the reduced amount.
  const { rows: offerRows } = await client.query("SELECT * FROM early_offers WHERE invoice_id = $1 AND status = 'open' AND pay_by >= $2::date", [inv.id, ctx.asOf]);
  const o = offerRows[0];
  const offer = o && inv.outstanding_paise > o.discount_paise
    ? { discount_paise: o.discount_paise, pay_by: o.pay_by, pay_amount_paise: inv.outstanding_paise - o.discount_paise }
    : null;
  const plan = await plans.forBill(client, inv);
  // With an agreed plan, the QR asks for the part now due (a pay-early offer, when there is one, still wins).
  const ask = offer ? offer.pay_amount_paise : plan?.next ? plan.next.amount_paise : inv.outstanding_paise;
  const confirmed = await lastConfirmation(client, inv.id);
  return {
    offer,
    plan,
    // What the "Pay in parts" form starts from, and its limits (lib/plans.js has the rules).
    plan_offer: ACTIVE.includes(inv.status) && canSplit(inv.outstanding_paise) && !(plan && ["proposed", "active"].includes(plan.status))
      ? { parts2: suggestParts(inv.outstanding_paise, ctx.asOf, 2), parts3: canSplit(inv.outstanding_paise, 3) ? suggestParts(inv.outstanding_paise, ctx.asOf, 3) : null, last_by: addDays(ctx.asOf, PLAN_MAX_DAYS) }
      : null,
    balance_confirmed: confirmed && confirmed.amount_paise === inv.outstanding_paise ? confirmed : null,
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
    upi: inv.outstanding_paise > 0 && b.vpa ? upiString({ pa: b.vpa, pn: b.name, am_paise: ask, tn: inv.number }) : null,
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
    `INSERT INTO payments (customer_id, source, paid_on, amount_paise, reference, narration, status, match_confidence, match_reason, match_reason_parts, flags, created_at)
     VALUES ($1, 'claim', $2, $3, $4, $5, 'pending', NULL, $6, $9::jsonb, $7, $8) RETURNING id`,
    [inv.customer_id, date, amount_paise, ref, null, `Customer claims payment against ${inv.number}`,
      amount_paise > inv.outstanding_paise ? ["overpaid"] : amount_paise < inv.outstanding_paise ? ["part"] : [], stamp(ctx),
      JSON.stringify([{ k: "claim", v: { inv: inv.number } }])],
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

// "Pay in parts": the customer's offer of 2 or 3 dated parts; it waits for the owner in the Inbox, reminders paused.
export async function plan(client, ctx, token, { parts } = {}) {
  const found = await byTokenRow(client, ctx, token);
  return plans.propose(client, ctx, found.id, { parts });
}

export async function promise(client, ctx, token, { date } = {}) {
  const found = await byTokenRow(client, ctx, token);
  return promises.create(client, ctx, { invoice_id: found.id, promised_date: date, actor: "customer" });
}

// "Yes, this amount is right": the customer confirms what is still due on this bill. Sealed in the record (it shows on
// the timeline and in the evidence pack); confirming the same amount again only says when it was confirmed.
export async function confirmBalance(client, ctx, token) {
  const inv = await byTokenRow(client, ctx, token);
  if (!ACTIVE.includes(inv.status) || inv.outstanding_paise <= 0) throw conflict("not_open", "Nothing is due on this bill");
  const last = await lastConfirmation(client, inv.id);
  if (last && last.amount_paise === inv.outstanding_paise) return { already: true, on: last.on, amount_paise: last.amount_paise };
  await event(client, ctx, inv.id, "balance_confirmed", "customer", { amount_paise: inv.outstanding_paise, number: inv.number, on: ctx.asOf });
  return { already: false, on: ctx.asOf, amount_paise: inv.outstanding_paise };
}

async function lastConfirmation(client, invoiceId) {
  const { rows } = await client.query("SELECT payload FROM escalation_events WHERE invoice_id = $1 AND type = 'balance_confirmed' ORDER BY id DESC LIMIT 1", [invoiceId]);
  if (!rows.length) return null;
  const p = JSON.parse(rows[0].payload);
  return { amount_paise: p.amount_paise, on: p.on };
}
