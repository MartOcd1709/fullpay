// The customer confirms the amount due from their link (skipped without DATABASE_URL).
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, run, pub;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ({ run } = await import("../lib/services/context.js"));
  pub = await import("../lib/services/public.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });

test("confirming the amount due is sealed once, shown on the link, and refused for a disputed bill", { skip }, async () => {
  const { rows: [open] } = await db.pool.query(
    "SELECT i.pay_token, b.outstanding_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id WHERE i.status = 'sent' AND i.paused_by IS NULL AND b.outstanding_paise > 0 ORDER BY i.id LIMIT 1");
  const first = await run((c, ctx) => pub.confirmBalance(c, ctx, open.pay_token));
  assert.deepEqual([first.already, first.amount_paise], [false, open.outstanding_paise]);
  const again = await run((c, ctx) => pub.confirmBalance(c, ctx, open.pay_token));
  assert.equal(again.already, true);
  const n = (await db.pool.query("SELECT count(*)::int AS n FROM escalation_events WHERE type = 'balance_confirmed'")).rows[0].n;
  assert.equal(n, 1, "one sealed entry");
  const view = await run((c, ctx) => pub.byToken(c, ctx, open.pay_token));
  assert.equal(view.balance_confirmed.amount_paise, open.outstanding_paise);

  const { rows: [disputed] } = await db.pool.query("SELECT pay_token FROM invoices WHERE status = 'disputed' LIMIT 1");
  if (disputed) await assert.rejects(() => run((c, ctx) => pub.confirmBalance(c, ctx, disputed.pay_token)), /Nothing is due/);
});
