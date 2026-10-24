// Automatic reminder calls, simulated. No phone call is made: a real one needs a calling provider (Exotel, Twilio), a
// TRAI-registered 160-series number and the customer's consent. The daily run "places" at most one call per customer when a
// bill is 7 days from its due date or 7 days past it; the record keeps exactly what the call says, and Today's follow-ups
// can play it aloud. Never for a paused, disputed, snoozed or opted-out bill, a customer without a phone, or on a quiet day.
import { callScript } from "../callScript.js";
import { event, INVOICE_SELECT, interestEligible } from "./common.js";
import { daysBetween } from "../time.js";

export const DEFAULT_STEPS = [-7, 7]; // days from the due date
const WINDOW = 7; // a day the run missed still calls within a week of the step; never twice for the same step

export async function placeDue(client, ctx) {
  const conf = ctx.cfg.calls ?? {};
  if (conf.enabled === false) return [];
  const steps = [...(conf.offsets ?? DEFAULT_STEPS)].sort((a, b) => a - b);
  const { rows } = await client.query(
    `${INVOICE_SELECT.replace("c.opt_out AS customer_opt_out", "c.opt_out AS customer_opt_out, c.phone AS customer_phone, c.preferred_lang, c.anonymized_at")}
     WHERE i.status IN ('sent','part_paid') AND i.paused_by IS NULL AND (i.snoozed_until IS NULL OR i.snoozed_until < $1)
       AND b.outstanding_paise > 0 AND c.opt_out = false AND c.anonymized_at IS NULL AND c.phone IS NOT NULL
     ORDER BY i.customer_id, i.due_date, i.id`,
    [ctx.asOf],
  );
  if (!rows.length) return [];
  const { rows: made } = await client.query(
    "SELECT invoice_id, payload FROM escalation_events WHERE type = 'call_placed' AND invoice_id = ANY($1::bigint[])",
    [rows.map((r) => r.id)],
  );
  const done = new Set(made.map((m) => `${m.invoice_id}|${JSON.parse(m.payload).step}`));
  const madeToday = new Set(made.filter((m) => JSON.parse(m.payload).on === ctx.asOf).map((m) => String(m.invoice_id)));

  // Per customer: the bills whose latest step falls today (or in the last week, if a run was missed), most serious step first.
  const byCustomer = new Map();
  for (const inv of rows) {
    if (madeToday.has(String(inv.id))) continue;
    const d = daysBetween(inv.due_date, ctx.asOf);
    const step = steps.filter((s) => d >= s && d < s + WINDOW).at(-1);
    if (step === undefined || done.has(`${inv.id}|${step}`)) continue;
    const list = byCustomer.get(inv.customer_id) ?? [];
    list.push({ inv, step });
    byCustomer.set(inv.customer_id, list);
  }

  const b = ctx.cfg.business ?? {};
  const interest = interestEligible(ctx.cfg);
  const calls = [];
  for (const [customerId, list] of byCustomer) {
    const step = Math.max(...list.map((x) => x.step)); // one call per customer a day: the later step is the one to say
    const group = list.filter((x) => x.step === step).map((x) => x.inv);
    const first = group[0];
    const { lang, text } = callScript({
      lang: first.preferred_lang === "hi" ? "hi" : "en",
      kind: step < 0 ? "before" : "after",
      business: { name: b.name, phone: b.phone },
      customer: first.customer_name,
      numbers: group.map((g) => g.number),
      amount_paise: group.reduce((s, g) => s + g.outstanding_paise, 0),
      due_date: group.reduce((d, g) => (g.due_date < d ? g.due_date : d), first.due_date),
      interest,
    });
    const call_id = `${ctx.run_id ?? `call-${ctx.asOf}`}-c${customerId}`;
    const to = `…${String(first.customer_phone).replace(/\D/g, "").slice(-4)}`;
    const days = daysBetween(first.due_date, ctx.asOf); // the real gap today (a missed run can make it differ from the step)
    for (const inv of group) {
      await event(client, ctx, inv.id, "call_placed", "system", { call_id, step, days, on: ctx.asOf, lang, script: text, to, simulated: true });
    }
    calls.push({ call_id, customer_id: Number(customerId), customer_name: first.customer_name, numbers: group.map((g) => g.number), step, days, lang, script: text, to });
  }
  return calls;
}

// Today's calls for Today's follow-ups: one row per call, newest first.
export async function today(client, ctx) {
  const { rows } = await client.query(
    `SELECT e.payload, i.number, c.name AS customer_name FROM escalation_events e
     JOIN invoices i ON i.id = e.invoice_id JOIN customers c ON c.id = i.customer_id
     WHERE e.type = 'call_placed' AND e.payload::jsonb->>'on' = $1 ORDER BY e.id DESC`,
    [ctx.asOf],
  );
  const byCall = new Map();
  for (const r of rows) {
    const p = JSON.parse(r.payload);
    const c = byCall.get(p.call_id) ?? { call_id: p.call_id, customer_name: r.customer_name, numbers: [], step: p.step, days: p.days ?? p.step, lang: p.lang, script: p.script, to: p.to };
    c.numbers.push(r.number);
    byCall.set(p.call_id, c);
  }
  return [...byCall.values()];
}
