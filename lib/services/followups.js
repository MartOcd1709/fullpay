// Collections screens: today's follow-ups (outbox rows + the +15 call card), snooze, call outcomes, TDS as a non-cash
// allocation, and the chase / forecast views shaped for the UI. Every function is (client, ctx, ...args).
import { addDays, daysBetween } from "../time.js";
import { RUNGS } from "../ladder.js";
import { buildForecast, chaseList, expectedInflowDate } from "../forecast.js";
import { suggestOffer } from "../earlyPay.js";
import { event, stamp, loadInvoice, INVOICE_SELECT, recomputePause, displayStatus } from "./common.js";
import { badRequest, conflict, notFound } from "./errors.js";
import * as payments from "./payments.js";
import * as promises from "./promises.js";
import { forecastInputs } from "./views.js";
import * as outbox from "./outbox.js";

const SNOOZE_DAYS = [1, 2, 3, 7];
const isClosed = (inv) => inv.status === "paid" || inv.status === "draft" || inv.outstanding_paise <= 0;

// invoice id -> forecast week index (0-based) of its expected inflow; >= weeks means after the window.
function expectedWeeks(input) {
  const byId = new Map(input.customers.map((c) => [String(c.id), c]));
  const out = {};
  for (const inv of input.invoices) {
    if (isClosed(inv)) continue;
    const date = expectedInflowDate(inv, byId.get(String(inv.customer_id)), input.today);
    out[inv.id] = Math.floor(daysBetween(input.today, date) / 7);
  }
  return out;
}

const shapeInvoice = (inv, asOf) => ({
  id: inv.id,
  number: inv.number,
  customer_id: inv.customer_id,
  due_date: inv.due_date,
  total_paise: inv.total_paise,
  outstanding_paise: inv.outstanding_paise,
  days_overdue: daysBetween(inv.due_date, asOf),
  status: inv.status,
  display_status: displayStatus(inv, asOf),
  paused_by: inv.paused_by,
  snoozed_until: inv.snoozed_until,
  rung: inv.rung,
  pay_token: inv.pay_token ?? null,
});

// The first future date on which any open, unpaused invoice reaches its next rung (for the empty state).
function nextReminderDate(invoices, ctx) {
  const offsets = ctx.cfg.ladder?.offsets ?? {};
  let best = null;
  for (const inv of invoices) {
    if (!["sent", "part_paid"].includes(inv.status) || inv.paused_by || inv.outstanding_paise <= 0) continue;
    const next = RUNGS[RUNGS.indexOf(inv.rung) + 1];
    if (!next || !Number.isInteger(offsets[next])) continue;
    let date = addDays(inv.due_date, offsets[next]);
    if (inv.snoozed_until && inv.snoozed_until >= date) date = addDays(inv.snoozed_until, 1);
    if (date > ctx.asOf && (!best || date < best)) best = date;
  }
  return best;
}

export async function listToday(client, ctx) {
  const { rows: outboxRows } = await client.query(
    `SELECT o.id, o.customer_id, o.invoice_ids, o.rung, o.channel, o.recipient, o.subject, o.body, o.lang, o.status,
            o.attempts, o.error, o.provider_id,
            to_char(o.sent_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS sent_on,
            to_char(o.sent_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS sent_time,
            c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.preferred_lang
     FROM outbox o JOIN customers c ON c.id = o.customer_id
     WHERE o.status IN ('awaiting_owner','queued','failed')
        OR (o.status = 'sent' AND (o.sent_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date)
     ORDER BY o.id`,
    [ctx.asOf],
  );
  const sms = new Map((await outbox.list(client, ctx, { status: ["awaiting_owner", "failed"] })).map((r) => [String(r.id), r.sms]));
  const input = await forecastInputs(client, ctx);
  const weeks = expectedWeeks(input);
  const custHabit = new Map(input.customers.map((c) => [String(c.id), c]));
  const { rows: invRows } = await client.query(`${INVOICE_SELECT} WHERE i.status <> 'draft'`);
  const invById = new Map(invRows.map((r) => [String(r.id), r]));

  const ready = [];
  const failed = [];
  const held = [];
  const done = [];
  for (const o of outboxRows) {
    const invoices = o.invoice_ids.map((id) => invById.get(String(id))).filter(Boolean).map((inv) => shapeInvoice(inv, ctx.asOf));
    const cust = custHabit.get(String(o.customer_id));
    const row = { ...o, sms: sms.get(String(o.id)) ?? null, invoices, amount_paise: invoices.reduce((a, i) => a + Math.max(0, i.outstanding_paise), 0),
      habit: cust?.pay_pattern ? { pay_pattern: cust.pay_pattern, best_reminder: cust.best_reminder } : null };
    const receipt = o.rung === "payment_received"; // a receipt is about money already in: never skipped as settled, never held by a pause
    if (o.status === "sent") done.push(row);
    else if (!receipt && invoices.length && invoices.every((i) => i.outstanding_paise <= 0 || i.status === "paid")) continue; // settled since it was queued
    else if (o.status === "failed") failed.push(row);
    else if (receipt) ready.push(row);
    else {
      const pause = invoices.find((i) => i.paused_by || i.status === "disputed" || (i.snoozed_until && i.snoozed_until >= ctx.asOf));
      if (pause) held.push({ ...row, hold: pause.paused_by ?? (pause.status === "disputed" ? "dispute" : "snooze"), hold_until: pause.snoozed_until });
      else ready.push(row);
    }
  }

  // The +15 rung asks the owner to call: open, unpaused, not snoozed invoices sitting at overdue_firm.
  const { rows: callRows } = await client.query(
    `${INVOICE_SELECT.replace("c.opt_out AS customer_opt_out", "c.opt_out AS customer_opt_out, c.phone AS customer_phone, c.preferred_lang")}
     WHERE i.rung = 'overdue_firm' AND i.status IN ('sent','part_paid') AND i.paused_by IS NULL
       AND (i.snoozed_until IS NULL OR i.snoozed_until < $1) AND b.outstanding_paise > 0
     ORDER BY i.due_date, i.id`,
    [ctx.asOf],
  );
  const calls = callRows.map((inv) => {
    const cust = custHabit.get(String(inv.customer_id));
    return { ...shapeInvoice(inv, ctx.asOf), customer_name: inv.customer_name, customer_phone: inv.customer_phone, preferred_lang: inv.preferred_lang,
      habit: cust?.pay_pattern ? { pay_pattern: cust.pay_pattern, best_reminder: cust.best_reminder } : null };
  });

  return {
    as_of: ctx.asOf,
    weeks_n: input.weeks,
    expected_week: weeks,
    business: { name: ctx.cfg.business?.name, owner_name: ctx.cfg.business?.owner_name, phone: ctx.cfg.business?.phone },
    promise_max_days: ctx.cfg.promise_max_days ?? 14,
    ready,
    failed,
    held,
    done,
    calls,
    next_due: nextReminderDate(invRows, ctx),
  };
}

async function lockOutbox(client, id) {
  if (!/^\d+$/.test(String(id))) throw notFound("message");
  const { rows } = await client.query("SELECT * FROM outbox WHERE id = $1 FOR UPDATE", [id]);
  if (!rows.length) throw notFound("message");
  return rows[0];
}

async function snoozeInvoice(client, ctx, invoiceId, days, via) {
  const inv = await loadInvoice(client, invoiceId, { lock: true });
  if (!["sent", "part_paid"].includes(inv.status)) throw conflict("not_open", `${inv.number ?? "This invoice"} is not open`);
  const until = addDays(ctx.asOf, days);
  await client.query("UPDATE invoices SET snoozed_until = $2 WHERE id = $1", [inv.id, until]);
  await event(client, ctx, inv.id, "snoozed", "owner", { until, days, via });
  return until;
}

export async function snooze(client, ctx, outboxId, { days } = {}) {
  if (!SNOOZE_DAYS.includes(days)) throw badRequest("invalid_days", `days must be one of ${SNOOZE_DAYS.join(", ")}`);
  const o = await lockOutbox(client, outboxId);
  if (o.status === "sent") throw conflict("already_sent", "This message is already sent");
  let until = null;
  for (const invId of o.invoice_ids) until = await snoozeInvoice(client, ctx, invId, days, { outbox_id: o.id });
  return { id: o.id, snoozed_until: until };
}

// Owner-recorded promise for one or more invoices (a multi-invoice reminder promises all of them).
export async function promiseMany(client, ctx, { invoice_ids, promised_date, amount_paise = null } = {}) {
  if (!Array.isArray(invoice_ids) || !invoice_ids.length || invoice_ids.length > 20) throw badRequest("validation", "invoice_ids must list 1 to 20 invoices");
  if (amount_paise != null && invoice_ids.length > 1) throw badRequest("validation", "An amount can be given only for a single invoice");
  const out = [];
  for (const id of invoice_ids) out.push(await promises.create(client, ctx, { invoice_id: id, promised_date, amount_paise, actor: "owner" }));
  return out;
}

// Outcome of the +15 call. Each outcome is a call_logged event followed by the event of what it changed.
export async function callOutcome(client, ctx, invoiceId, { outcome, promised_date, amount_paise = null, reason, note } = {}) {
  const inv = await loadInvoice(client, invoiceId, { lock: true });
  if (!["sent", "part_paid"].includes(inv.status)) throw conflict("not_open", `${inv.number ?? "This invoice"} is not open`);
  const memo = typeof note === "string" ? note.trim().slice(0, 300) || null : null;
  if (outcome === "promise") {
    const p = await promises.create(client, ctx, { invoice_id: inv.id, promised_date, amount_paise, actor: "owner" });
    await event(client, ctx, inv.id, "call_logged", "owner", { outcome, promise_id: p.id, date: promised_date, note: memo });
    return { outcome, promise: p };
  }
  if (outcome === "dispute") {
    const why = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";
    if (!why) throw badRequest("reason_required", "Write down what the customer says is wrong");
    const { rows } = await client.query(
      "INSERT INTO inbox_items (invoice_id, kind, reason, opened_on, created_at) VALUES ($1,'dispute',$2,$3,$4) RETURNING id",
      [inv.id, why, ctx.asOf, stamp(ctx)],
    );
    await client.query("UPDATE invoices SET status = 'disputed' WHERE id = $1", [inv.id]);
    await recomputePause(client, inv.id);
    await event(client, ctx, inv.id, "call_logged", "owner", { outcome, inbox_id: rows[0].id, note: memo });
    await event(client, ctx, inv.id, "dispute_opened", "owner", { inbox_id: rows[0].id, reason: why, prev_status: inv.status, via: "call" });
    return { outcome, inbox_id: rows[0].id };
  }
  if (outcome === "snooze") {
    await event(client, ctx, inv.id, "call_logged", "owner", { outcome, days: 2, note: memo });
    const until = await snoozeInvoice(client, ctx, inv.id, 2, { call: true });
    return { outcome, snoozed_until: until };
  }
  throw badRequest("invalid_outcome", "outcome must be promise, dispute or snooze");
}

export const tdsReference = (paymentId) => `TDS for payment #${paymentId}`;

// K7: a confirmed payment flagged tds_N leaves exactly N% of taxable unpaid; record that as tax deducted (not cash),
// as a confirmed allocation with its own reason, so the ladder stops chasing tax the customer already deposited.
export async function recordTds(client, ctx, paymentId) {
  const pay = await payments.get(client, ctx, paymentId);
  if (pay.status !== "confirmed") throw conflict("not_confirmed", "Confirm the payment first");
  const flag = (pay.flags ?? []).find((f) => /^tds_\d+$/.test(f));
  if (!flag) throw badRequest("not_tds", "This payment is not flagged as possibly TDS-short");
  if (pay.allocations.length !== 1) throw badRequest("not_single", "TDS can be recorded only for a payment against one invoice");
  const ref = tdsReference(pay.id);
  const dup = await client.query("SELECT 1 FROM payments WHERE reference = $1 AND status <> 'rejected'", [ref]);
  if (dup.rows.length) throw conflict("tds_recorded", "TDS is already recorded for this payment");
  const inv = await loadInvoice(client, pay.allocations[0].invoice_id);
  if (inv.outstanding_paise <= 0) throw conflict("nothing_owed", `${inv.number} is already settled`);
  const pct = Number(flag.slice(4));
  const amount = Math.min(inv.outstanding_paise, Math.round((inv.taxable_paise * pct) / 100));
  const tds = await payments.addManual(client, ctx, {
    invoice_id: inv.id,
    paid_on: pay.paid_on,
    amount_paise: amount,
    reference: ref,
    narration: `Income-tax deducted at source (${pct}%) by the customer - not cash. TDS certificate to be collected.`,
  });
  await payments.confirm(client, ctx, tds.id, null, { receipt: false }); // TDS is not money received: no receipt
  await event(client, ctx, inv.id, "tds_recorded", "owner", { payment_id: pay.id, tds_payment_id: tds.id, amount_paise: amount, pct, certificate: "awaited" });
  return payments.get(client, ctx, tds.id);
}

// Ranked chase list with the parts the UI needs to write the reason in either language.
export async function chaseView(client, ctx) {
  const input = await forecastInputs(client, ctx);
  const fc = buildForecast(input);
  const byId = new Map(input.customers.map((c) => [String(c.id), c]));
  const gap = new Set(fc.cover_gap.map((g) => String(g.invoice_id)));
  const { rows: phones } = await client.query("SELECT id, phone FROM customers");
  const phoneOf = new Map(phones.map((r) => [String(r.id), r.phone]));
  return {
    as_of: ctx.asOf,
    first_shortfall_week: fc.first_shortfall_week,
    rows: chaseList(input.invoices, input.customers, fc, input.today).map((r) => {
      const cust = byId.get(String(r.customer_id));
      return {
        id: r.id,
        number: r.number,
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        customer_phone: phoneOf.get(String(r.customer_id)) ?? null,
        outstanding_paise: r.outstanding_paise,
        due_date: r.due_date,
        days_overdue: r.days_overdue,
        status: r.status,
        paused_by: r.paused_by,
        score: r.score,
        reason: r.reason,
        grade: cust?.grade ?? null,
        avg_late_days: Math.round(cust?.avg_late_days ?? 0),
        in_gap: gap.has(String(r.id)),
      };
    }),
  };
}

// whatIf: { late_customer_id, late_days, big_order: { week_index, amount_paise }, supplier_delay_days }
export async function forecastView(client, ctx, whatIf = {}) {
  const input = await forecastInputs(client, ctx);
  const base = buildForecast(input);
  const fc = buildForecast({ ...input, whatIf });
  const invById = new Map(input.invoices.map((i) => [String(i.id), i]));
  const custById = new Map(input.customers.map((c) => [String(c.id), c]));
  const owing = new Map();
  for (const i of input.invoices) if (!isClosed(i)) owing.set(String(i.customer_id), (owing.get(String(i.customer_id)) ?? 0) + i.outstanding_paise);
  const enrich = (r) => {
    const inv = r.invoice_id != null ? invById.get(String(r.invoice_id)) : null;
    return { ...r, customer_name: custById.get(String(r.customer_id))?.name ?? null, promise_date: inv?.promise_date ?? null, days_overdue: inv ? daysBetween(inv.due_date, ctx.asOf) : null };
  };
  return {
    ...fc,
    weeks: fc.weeks.map((w) => ({ ...w, inflows: w.inflows.map(enrich) })),
    // Each invoice that would close the gap, with the pay-early offer that is still cheaper than borrowing (and any open one).
    cover_gap: await (async () => {
      const ids = fc.cover_gap.map((g) => Number(g.invoice_id)).filter(Boolean);
      const { rows: open } = ids.length ? await client.query("SELECT * FROM early_offers WHERE status = 'open' AND invoice_id = ANY($1::bigint[])", [ids]) : { rows: [] };
      const openBy = new Map(open.map((o) => [Number(o.invoice_id), o]));
      return fc.cover_gap.map((g) => {
        const r = enrich(g);
        const inv = invById.get(String(g.invoice_id));
        const o = openBy.get(Number(g.invoice_id)) ?? null;
        const suggestion = inv && !o && !["dispute", "claim", "plan"].includes(inv.paused_by) && !inv.plan_parts?.length ? suggestOffer({
          outstanding_paise: inv.outstanding_paise, today: ctx.asOf, expected_date: expectedInflowDate(inv, custById.get(String(inv.customer_id)), ctx.asOf),
          rate_bps: ctx.cfg.finance?.borrow_rate_bps ?? 1400, opts: { max_discount_bps: ctx.cfg.finance?.max_discount_bps ?? 200 },
        }) : null;
        return { ...r, open_offer: o && { id: Number(o.id), discount_paise: o.discount_paise, pay_by: o.pay_by }, offer_suggestion: suggestion };
      });
    })(),
    base_first_shortfall_week: base.first_shortfall_week,
    base_lowest: base.lowest,
    customers: [...owing.entries()]
      .map(([id, paise]) => ({ id: Number(id), name: custById.get(id)?.name ?? "", owed_paise: paise }))
      .sort((a, b) => b.owed_paise - a.owed_paise),
    has_expenses: input.expenses.length > 0,
    opening_cash_paise: input.opening_cash_paise,
  };
}

// Inbox items with the invoice facts the cards need (acceptance date for the s.2(b) note, contacts for the reply).
export async function inboxView(client, ctx) {
  const { rows } = await client.query(
    `SELECT x.*, i.number AS invoice_number, i.customer_id, i.issue_date, i.delivery_date, i.acceptance_date, i.credit_days,
            i.due_date, i.total_paise, i.status AS invoice_status, b.outstanding_paise, b.credited_paise,
            c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.preferred_lang,
            p.amount_paise AS claim_amount_paise, p.paid_on AS claim_paid_on, p.reference AS claim_reference,
            (SELECT string_agg(cn.number, ', ' ORDER BY cn.id) FROM credit_notes cn WHERE cn.invoice_id = i.id) AS credit_notes,
            (SELECT pp.parts FROM payment_plans pp WHERE pp.inbox_item_id = x.id) AS plan_parts
     FROM inbox_items x JOIN invoices i ON i.id = x.invoice_id JOIN customers c ON c.id = i.customer_id
     JOIN invoice_balances b ON b.invoice_id = i.id LEFT JOIN payments p ON p.id = x.payment_id
     ORDER BY x.status = 'open' DESC, CASE WHEN x.status = 'open' THEN x.opened_on END, x.resolved_on DESC NULLS LAST, x.id DESC
     LIMIT 60`,
  );
  return {
    as_of: ctx.asOf,
    open: rows.filter((r) => r.status === "open").map((r) => ({
      ...r,
      days_overdue: daysBetween(r.due_date, ctx.asOf),
      // MSMED s.2(b): an objection in writing within 15 days of delivery postpones acceptance.
      objection_days: daysBetween(r.delivery_date ?? r.issue_date, r.opened_on),
    })),
    resolved: rows.filter((r) => r.status === "resolved"),
  };
}

// Query string -> whatIf. late=<customer id>&order=<rupees>&order_week=<1..13>&supplier=<days>. Bad values are ignored.
export function parseWhatIf(q = {}, weeks = 13) {
  const get = (k) => (typeof q.get === "function" ? q.get(k) : q[k]);
  const int = (k, lo, hi) => {
    const n = Number(get(k));
    return Number.isSafeInteger(n) && n >= lo && n <= hi ? n : null;
  };
  const w = {};
  const late = int("late", 1, Number.MAX_SAFE_INTEGER);
  if (late) {
    w.late_customer_id = late;
    w.late_days = int("late_days", 1, 120) ?? 30;
  }
  const order = int("order", 1, 100_000_000); // rupees
  if (order) w.big_order = { week_index: (int("order_week", 1, weeks) ?? 1) - 1, amount_paise: order * 100 };
  const supplier = int("supplier", 1, 120);
  if (supplier) w.supplier_delay_days = supplier;
  return w;
}

const tdsPct = (flags) => {
  const f = (flags ?? []).find((x) => /^tds_\d+$/.test(x));
  return f ? Number(f.slice(4)) : null;
};

// Payments screen: pending (to confirm), recent confirmed/rejected, open invoices for allocation, and TDS state (K7).
export async function paymentsView(client, ctx) {
  const { exactMatches } = await import("./approvals.js"); // approvals imports this module: load on use, no cycle at startup
  // Pending in full (it is the work queue); history capped in SQL so the screen stays fast with years of payments.
  // ponytail: the first 60 pending cards only; the rest are counted and cleared in bulk (confirm exact matches). Add paging if needed.
  const [pending, confirmed, rejected, confirmed_total] = [
    await payments.list(client, ctx, { status: "pending", limit: 60 }),
    await payments.list(client, ctx, { status: "confirmed", limit: 30 }),
    await payments.list(client, ctx, { status: "rejected", limit: 10 }),
    await payments.count(client, { status: "confirmed" }),
  ];
  const { rows: open } = await client.query(
    `${INVOICE_SELECT} WHERE i.status IN ('sent','part_paid','disputed') AND b.outstanding_paise > 0 ORDER BY c.name, i.due_date, i.id`,
  );
  const targets = [...pending, ...confirmed].map((p) => (p.status === "confirmed" ? p.allocations : p.proposals)[0]?.invoice_id).filter((id) => id != null);
  const { rows: inv } = await client.query(
    "SELECT i.id, i.number, i.taxable_paise, b.outstanding_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id WHERE i.id = ANY($1::bigint[])",
    [targets],
  );
  const invById = new Map(inv.map((r) => [String(r.id), r]));
  const { rows: tdsRefs } = await client.query("SELECT reference FROM payments WHERE reference LIKE 'TDS for payment #%' AND status <> 'rejected'");
  const recorded = new Set(tdsRefs.map((r) => r.reference));
  const tdsLabels = ctx.cfg.tds?.labels ?? {};
  const withTds = (p) => {
    const pct = tdsPct(p.flags);
    const target = (p.status === "confirmed" ? p.allocations : p.proposals)[0];
    const i = target ? invById.get(String(target.invoice_id)) : null;
    if (!pct || !i) return { ...p, tds: null, is_tds_entry: p.reference?.startsWith("TDS for payment #") ?? false };
    const amount = Math.round((i.taxable_paise * pct) / 100);
    const state = recorded.has(tdsReference(p.id)) ? "recorded" : p.status !== "confirmed" ? "pending" : i.outstanding_paise > 0 ? "can_record" : "settled";
    return { ...p, tds: { pct, amount_paise: Math.min(amount, Math.max(i.outstanding_paise, 0)) || amount, state, label: tdsLabels[pct * 100] ?? null, number: i.number }, is_tds_entry: false };
  };
  return {
    as_of: ctx.asOf,
    pending: pending.map(withTds),
    confirmed: confirmed.map(withTds),
    rejected,
    confirmed_total,
    pending_total: await payments.count(client, { status: "pending" }),
    exact: await exactMatches(client, {}),
    open_invoices: open.map((r) => ({ id: r.id, number: r.number, customer_id: r.customer_id, customer_name: r.customer_name, outstanding_paise: r.outstanding_paise, due_date: r.due_date })),
  };
}
