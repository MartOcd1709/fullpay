// One search box: customers, bills and payments by name, number or exact amount.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, search;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  ({ search } = await import("../lib/services/search.js"));
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) await db.pool.end(); });
const find = (q) => ctxMod.run((c, ctx) => search(c, ctx, q));

test("finds a customer, their bills and payments by part of the name", { skip }, async () => {
  const r = await find("bhatia");
  assert.ok(r.customers.some((c) => /bhatia/i.test(c.name)));
  assert.ok(r.invoices.length > 0 && r.invoices.every((i) => /bhatia/i.test(i.customer_name)));
  assert.ok(r.invoices.every((i) => !("pay_token" in i)), "no pay links leak into results");
});

test("an amount typed the Indian way finds the bill of exactly that amount", { skip }, async () => {
  const { rows } = await db.pool.query("SELECT number, total_paise FROM invoices WHERE number IS NOT NULL ORDER BY id LIMIT 1");
  const rupees = (Number(rows[0].total_paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const r = await find(`₹${rupees}`);
  assert.ok(r.invoices.some((i) => i.number === rows[0].number), `${rupees} finds ${rows[0].number}`);
});

test("one letter or a LIKE wildcard matches nothing", { skip }, async () => {
  assert.deepEqual(await find("x"), { q: "x", customers: [], invoices: [], payments: [] });
  const r = await find("%%");
  assert.equal(r.customers.length + r.payments.length, 0);
});
