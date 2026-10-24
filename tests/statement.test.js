// Statement of account link: one stable token per customer, every open bill, disputed bills left out of the total.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, statement;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  statement = await import("../lib/services/statement.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });
const run = (fn) => ctxMod.run((c, ctx) => fn(c, Object.assign(ctx, { user: null })));

test("the statement lists open bills and totals only the undisputed ones", { skip }, async () => {
  const { rows } = await db.pool.query(
    `SELECT i.customer_id, count(*)::int AS n, coalesce(sum(b.outstanding_paise) FILTER (WHERE i.status <> 'disputed'), 0)::bigint AS payable
     FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
     WHERE i.status IN ('sent','part_paid','disputed') AND b.outstanding_paise > 0 GROUP BY 1 ORDER BY n DESC LIMIT 1`);
  const cust = rows[0];
  const token = await run((c) => statement.ensureToken(c, cust.customer_id));
  assert.match(token, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(await run((c) => statement.ensureToken(c, cust.customer_id)), token, "the link stays the same once made");

  const view = await run((c, ctx) => statement.byToken(c, ctx, token));
  assert.equal(view.invoices.length, cust.n);
  assert.equal(view.total_paise, Number(cust.payable));
  if (view.total_paise > 0) assert.match(view.upi, new RegExp(`am=${(view.total_paise / 100).toFixed(2)}`));
});

test("a wrong or anonymised customer's link shows nothing", { skip }, async () => {
  await assert.rejects(() => run((c, ctx) => statement.byToken(c, ctx, "not-a-real-token-123")), /not found/i);
  await assert.rejects(() => run((c, ctx) => statement.byToken(c, ctx, "../etc")), /not found/i);
  const token = await run((c) => statement.ensureToken(c, 2));
  await db.pool.query("UPDATE customers SET anonymized_at = now() WHERE id = 2");
  await assert.rejects(() => run((c, ctx) => statement.byToken(c, ctx, token)), /not found/i);
  assert.equal(await run((c) => statement.ensureToken(c, 2)), null);
});
