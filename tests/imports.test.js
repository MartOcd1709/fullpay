// Importing an existing book of unpaid invoices (skipped without DATABASE_URL).
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skip = !process.env.DATABASE_URL;
const csv = readFileSync(new URL("../db/tally-bills-receivable.csv", import.meta.url), "utf8");
let db, seedMod, run, imports, payments, tick;

before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ({ run } = await import("../lib/services/context.js"));
  imports = await import("../lib/services/imports.js");
  payments = await import("../lib/services/payments.js");
  ({ tick } = await import("../lib/services/tick.js"));
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => {
  if (skip) return;
  await db.withTxn((c) => seedMod.seed(c));
  await db.pool.end();
});

test("the Tally sample: preview, import once, re-import is a no-op, then the daily run and the bank matcher pick it up", { skip }, async () => {
  const p = await run((c, ctx) => imports.preview(c, ctx, csv));
  assert.equal(p.summary.rows, 12);
  assert.equal(p.summary.importable, 11);
  assert.equal(p.summary.with_problems, 1);
  assert.deepEqual(p.rows.find((r) => r.value.number === "TI/0420").errors, ["credit_balance"]);
  assert.equal(p.summary.new_customers, 5);
  assert.equal(p.rows.find((r) => r.value.number === "TI/0419").customer.name, "Rana Transport Company", "matched to the existing customer");
  assert.equal(p.summary.outstanding_paise, 81597000);

  const done = await run((c, ctx) => imports.commit(c, ctx, csv));
  assert.equal(done.imported, 11);
  assert.equal(done.new_customers, 5);
  const again = await run((c, ctx) => imports.commit(c, ctx, csv));
  assert.equal(again.imported, 0, "every number is already in FullPay");

  const rows = (await db.pool.query(
    `SELECT i.number, i.status, i.imported, i.due_date, b.outstanding_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
     WHERE i.imported ORDER BY i.number`,
  )).rows;
  assert.equal(rows.length, 11);
  assert.ok(rows.every((r) => r.status === "sent" && r.imported));
  assert.equal(rows.find((r) => r.number === "TI/0318").due_date, "2026-07-27");

  const t = await run((c, ctx) => tick(c, ctx, { source: "manual" }));
  assert.ok(t.evaluated >= 11);
  const rung = (await db.pool.query("SELECT rung FROM invoices WHERE number = 'TI/0318'")).rows[0].rung;
  assert.ok(rung, "the daily run put the 88-days-overdue import on the ladder");

  const bank = "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\n20/10/26,NEFT CR-SANDHU TRACTOR-TI0318,UTR9,20/10/26,0.00,\"84,960.00\",0.00\n";
  const imp = await run((c, ctx) => payments.importCsv(c, ctx, bank));
  const pay = imp.imported[0];
  assert.equal(pay.proposals[0].number, "TI/0318");
  assert.equal(pay.match_confidence, 95);
});
