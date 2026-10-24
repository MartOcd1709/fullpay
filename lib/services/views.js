import { buildForecast, agingBuckets, chaseList, dashboard as dashboardOf } from "../forecast.js";
import { verifyChain, loadChain } from "../chain.js";
import { INVOICE_SELECT } from "./common.js";
import { remainingParts } from "../plans.js";
import { listWithReliability } from "./customers.js";
import * as invoices from "./invoices.js";
import { notFound } from "./errors.js";

// Everything forecast.js needs, read once. Unpaid invoices carry an open promise's date as promise_date, and an agreed
// instalment plan's parts still to come as plan_parts (one expected payment each).
// Open invoices only: every consumer (forecast, dashboard, ageing, chase, follow-ups) reads unpaid invoices alone.
export async function forecastInputs(client, ctx) {
  const inv = await client.query(
      `${INVOICE_SELECT.replace("SELECT i.*,", `SELECT i.*, (SELECT promised_date FROM promises p WHERE p.invoice_id = i.id AND p.status = 'open') AS promise_date,
              (SELECT json_build_object('parts', pp.parts, 'base', pp.base_settled_paise) FROM payment_plans pp WHERE pp.invoice_id = i.id AND pp.status = 'active') AS plan,`)}
       WHERE i.status IN ('sent','part_paid','disputed') ORDER BY i.due_date, i.id`,
  );
  for (const r of inv.rows) {
    if (r.plan) r.plan_parts = remainingParts(r.plan.parts, r.paid_paise + r.credited_paise - Number(r.plan.base), r.outstanding_paise);
    delete r.plan;
  }
  const customers = await listWithReliability(client, ctx);
  const expenses = await client.query("SELECT * FROM expenses ORDER BY due_on, id");
  const f = ctx.cfg.forecast;
  return {
    today: ctx.asOf,
    opening_cash_paise: f.opening_balance_paise,
    buffer_paise: f.buffer_paise,
    weeks: f.weeks,
    invoices: inv.rows.map(({ pay_token, ...r }) => r),
    customers,
    expenses: expenses.rows,
  };
}

// whatIf: { late_customer_id, late_days, big_order: { week_index, amount_paise }, supplier_delay_days }
export async function forecast(client, ctx, whatIf = {}) {
  return buildForecast({ ...(await forecastInputs(client, ctx)), whatIf: whatIf ?? {} });
}

export async function dashboard(client, ctx) {
  const input = await forecastInputs(client, ctx);
  const d = dashboardOf(input);
  const fc = buildForecast(input);
  return { ...d, first_shortfall_week: fc.first_shortfall_week, buffer_paise: input.buffer_paise };
}

export async function aging(client, ctx) {
  const { invoices: rows, today } = await forecastInputs(client, ctx);
  return agingBuckets(rows, today);
}

export async function chase(client, ctx) {
  const input = await forecastInputs(client, ctx);
  return chaseList(input.invoices, input.customers, buildForecast(input), input.today);
}

// Evidence bundle data: the invoice with its full timeline, messages, payments, inbox, interest, and chain status.
export async function documents(client, ctx, invoiceId) {
  const inv = await invoices.get(client, ctx, invoiceId);
  const customer = await client.query("SELECT id, name, gstin, state_code, address, email, phone, credit_days FROM customers WHERE id = $1", [inv.customer_id]);
  const outbox = await client.query("SELECT * FROM outbox WHERE $1 = ANY(invoice_ids) ORDER BY id", [inv.id]);
  const chainRows = await loadChain((t, p) => client.query(t, p));
  if (!customer.rows.length) throw notFound("customer");
  const lastOwn = inv.timeline.at(-1);
  const upto = lastOwn ? chainRows.findIndex((r) => r.entry_hash === lastOwn.entry_hash) + 1 : 0;
  return {
    business: ctx.cfg.business,
    customer: customer.rows[0],
    invoice: inv,
    outbox: outbox.rows,
    chain: { ...verifyChain(chainRows.slice(0, upto)), verified_through: lastOwn?.entry_hash ?? null },
    odr_checklist: ctx.cfg.odr?.bundle_checklist ?? [],
    as_of: ctx.asOf,
  };
}
