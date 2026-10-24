// Instalment plans end to end: the customer offers parts on the pay link, the owner approves or declines in the Inbox,
// each paid part moves the plan on, the forecast expects each part on its date, and a missed part restarts reminders.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, pub, inbox, payments, views, forecast, T, plans;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  pub = await import("../lib/services/public.js");
  inbox = await import("../lib/services/inbox.js");
  payments = await import("../lib/services/payments.js");
  views = await import("../lib/services/views.js");
  forecast = await import("../lib/forecast.js");
  T = await import("../lib/services/tick.js");
  plans = await import("../lib/plans.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });
const owner = (fn) => ctxMod.run((c, ctx) => fn(c, Object.assign(ctx, { user: { uid: 1, role: "owner" } })));
const q = async (sql, p) => (await db.pool.query(sql, p)).rows;

// Open, unpaused bills of different customers that can be split.
async function bills() {
  return q(`SELECT DISTINCT ON (i.customer_id) i.id, i.number, i.pay_token, b.outstanding_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
            WHERE i.status IN ('sent','part_paid') AND i.paused_by IS NULL AND i.pay_token IS NOT NULL AND b.outstanding_paise > 300000
              AND NOT EXISTS (SELECT 1 FROM promises p WHERE p.invoice_id = i.id AND p.status = 'broken')
            ORDER BY i.customer_id, i.due_date`);
}
const offer = (bill, n = 2) => owner(async (c, ctx) => {
  const parts = plans.suggestParts(Number(bill.outstanding_paise), ctx.asOf, n);
  return { plan: await pub.plan(c, ctx, bill.pay_token, { parts }), parts };
});
const itemOf = async (bill) => (await q("SELECT id FROM inbox_items WHERE invoice_id = $1 AND kind = 'plan' AND status = 'open'", [bill.id]))[0];
const pay = (bill, amount_paise) => owner(async (c, ctx) => {
  const p = await payments.addManual(c, ctx, { invoice_id: bill.id, paid_on: ctx.asOf, amount_paise, reference: "PLAN TEST" });
  return payments.confirm(c, ctx, p.id, [{ invoice_id: bill.id, amount_paise }]);
});
const state = async (bill) => (await q(
  `SELECT i.paused_by, i.status, (SELECT status FROM payment_plans WHERE invoice_id = i.id ORDER BY id DESC LIMIT 1) AS plan,
          (SELECT promised_date FROM promises WHERE invoice_id = i.id AND status = 'open') AS promise
   FROM invoices i WHERE i.id = $1`, [bill.id]))[0];

test("offer → approve → pay part 1 → pay the rest: the plan completes and the bill is paid", { skip }, async () => {
  const [bill] = await bills();
  const { parts } = await offer(bill);
  assert.deepEqual(await state(bill), { paused_by: "plan", status: "sent", plan: "proposed", promise: null }, "reminders pause while the owner decides");
  await assert.rejects(() => offer(bill), (e) => e.status === 409 && e.code === "plan_open");

  const item = await itemOf(bill);
  await owner((c, ctx) => inbox.resolve(c, ctx, item.id, { action: "approve_plan" }));
  assert.deepEqual(await state(bill), { paused_by: "promise", status: "sent", plan: "active", promise: parts[0].date });
  const view = await owner((c, ctx) => pub.byToken(c, ctx, bill.pay_token));
  assert.deepEqual([view.plan.status, view.plan.next.number, view.plan.next.amount_paise], ["active", 1, parts[0].amount_paise]);
  assert.match(view.upi, new RegExp(`am=${(parts[0].amount_paise / 100).toFixed(2)}`), "the QR asks for part 1");
  assert.equal(view.plan_offer, null, "no second plan while one is in place");

  // The forecast expects each part on its own date.
  const fc = await owner(async (c, ctx) => forecast.buildForecast(await views.forecastInputs(c, ctx)));
  const mine = fc.weeks.flatMap((w) => w.inflows).filter((r) => String(r.invoice_id) === String(bill.id));
  assert.deepEqual(mine.map((r) => [r.date, r.amount_paise]), parts.map((p) => [p.date, p.amount_paise]));

  await pay(bill, parts[0].amount_paise);
  assert.deepEqual(await state(bill), { paused_by: "promise", status: "part_paid", plan: "active", promise: parts[1].date }, "the promise moves to part 2");
  await pay(bill, parts[1].amount_paise);
  assert.deepEqual(await state(bill), { paused_by: null, status: "paid", plan: "completed", promise: null });
  const types = (await q("SELECT type FROM escalation_events WHERE invoice_id = $1 ORDER BY id", [bill.id])).map((r) => r.type);
  for (const t of ["plan_proposed", "plan_approved", "promise_made", "promise_kept", "plan_completed"]) assert.ok(types.includes(t), `record has ${t}`);
});

test("declined: reminders resume and the customer sees the reply", { skip }, async () => {
  const [, bill] = await bills();
  await offer(bill, 3);
  const item = await itemOf(bill);
  await owner((c, ctx) => inbox.resolve(c, ctx, item.id, { action: "reject", reply: "Please pay in two parts, by month end" }));
  assert.deepEqual(await state(bill), { paused_by: null, status: "sent", plan: "declined", promise: null });
  const view = await owner((c, ctx) => pub.byToken(c, ctx, bill.pay_token));
  assert.deepEqual([view.plan.status, view.plan.reply], ["declined", "Please pay in two parts, by month end"]);
  assert.ok(view.plan_offer, "a new offer can be made");
});

test("a missed part breaks the plan and reminders restart", { skip }, async () => {
  const [, , bill] = await bills();
  const { parts } = await offer(bill);
  const item = await itemOf(bill);
  await owner((c, ctx) => inbox.resolve(c, ctx, item.id, { action: "approve_plan" }));
  await T.advanceDemo(8); // part 1 was due in 7 days and nothing came
  const s = await state(bill);
  assert.equal(s.plan, "broken");
  assert.equal(s.promise, null);
  assert.notEqual(s.paused_by, "promise");
  const [ev] = await q("SELECT payload FROM escalation_events WHERE invoice_id = $1 AND type = 'plan_broken'", [bill.id]);
  assert.equal(JSON.parse(ev.payload).date, parts[0].date);
});

test("the pay link refuses a plan that breaks the rules", { skip }, async () => {
  const [, , , bill] = await bills();
  await assert.rejects(
    () => owner((c, ctx) => pub.plan(c, ctx, bill.pay_token, { parts: [{ date: ctx.asOf, amount_paise: 100 }] })),
    (e) => e.status === 400 && e.code === "plan_parts",
  );
  await assert.rejects(
    () => owner((c, ctx) => pub.plan(c, ctx, bill.pay_token, { parts: plans.suggestParts(Number(bill.outstanding_paise) - 100, ctx.asOf, 2) })),
    (e) => e.status === 400 && e.code === "plan_sum",
  );
});
