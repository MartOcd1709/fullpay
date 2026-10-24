// Pay-early offers end to end: offer → customer pays the reduced amount in time → matched as agreed → credit note → paid.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, offers, payments, pub, approvals, users;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  offers = await import("../lib/services/offers.js");
  payments = await import("../lib/services/payments.js");
  pub = await import("../lib/services/public.js");
  approvals = await import("../lib/services/approvals.js");
  users = await import("../lib/services/users.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });
const as = (user) => (fn) => ctxMod.run((c, ctx) => fn(c, Object.assign(ctx, { user })));

test("an offer paid in time: matched as agreed, a credit note settles the rest, GST untouched", { skip }, async () => {
  // A late payer's open invoice with a suggestion.
  const { rows } = await db.pool.query(
    `SELECT i.id, i.pay_token, b.outstanding_paise, i.cgst_paise, i.sgst_paise, i.igst_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
     WHERE i.status = 'sent' AND i.paused_by IS NULL AND b.outstanding_paise > 5000000 ORDER BY b.outstanding_paise DESC`);
  let target = null, sug = null;
  for (const r of rows) {
    const s = await as({ uid: 1, role: "owner" })((c, ctx) => offers.suggest(c, ctx, r.id));
    if (s.suggestion) { target = r; sug = s.suggestion; break; }
  }
  assert.ok(target, "some open invoice merits an offer");
  await as({ uid: 1, role: "owner" })((c, ctx) => offers.make(c, ctx, target.id, { discount_paise: sug.discount_paise, pay_by: sug.pay_by }));
  await assert.rejects(() => as({ uid: 1, role: "owner" })((c, ctx) => offers.make(c, ctx, target.id, { discount_paise: sug.discount_paise, pay_by: sug.pay_by })), /open offer/);

  const page = await as(null)((c, ctx) => pub.byToken(c, ctx, target.pay_token));
  assert.equal(page.offer.pay_amount_paise, target.outstanding_paise - sug.discount_paise);
  assert.match(page.upi, new RegExp(`am=${((target.outstanding_paise - sug.discount_paise) / 100).toFixed(2)}`));

  // The customer pays the reduced amount on time; the matcher reads it as the agreed offer.
  const pay = await as({ uid: 1, role: "owner" })((c, ctx) => payments.addManual(c, ctx, { paid_on: ctx.asOf, amount_paise: page.offer.pay_amount_paise, reference: "UPI-EARLY-1", narration: `UPI/${page.invoice.number}` }));
  assert.deepEqual(pay.flags, ["early_discount"]);
  assert.match(pay.match_reason, /pay-early discount you offered/);
  await as({ uid: 1, role: "owner" })((c, ctx) => payments.confirm(c, ctx, pay.id));
  const after = (await db.pool.query(
    `SELECT i.status, b.outstanding_paise, i.cgst_paise, i.sgst_paise, i.igst_paise, (SELECT count(*)::int FROM credit_notes WHERE invoice_id = i.id) AS cns,
            (SELECT status FROM early_offers WHERE invoice_id = i.id ORDER BY id DESC LIMIT 1) AS offer
     FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id WHERE i.id = $1`, [target.id])).rows[0];
  assert.deepEqual([after.status, after.outstanding_paise, after.cns, after.offer], ["paid", 0, 1, "taken"]);
  assert.deepEqual([after.cgst_paise, after.sgst_paise, after.igst_paise], [target.cgst_paise, target.sgst_paise, target.igst_paise], "GST already charged is unchanged");
});

test("an accountant's offer waits for the owner", { skip }, async () => {
  const team = await db.withTxn((c) => users.list(c));
  const acct = Number(team.find((u) => u.role === "accountant").id);
  const r = await as({ uid: acct, role: "accountant" })((c, ctx) => approvals.guard(c, ctx, { kind: "offer_make", target_id: 1, payload: { discount_paise: 10000, pay_by: "2026-10-27" }, summary: "offer" }));
  assert.equal(r.approval_pending, true);
});

test("no offer on a bill the customer disputes or says is already paid", { skip }, async () => {
  await db.withTxn((c) => seedMod.seed(c));
  const { rows } = await db.pool.query("SELECT id FROM invoices WHERE paused_by IN ('claim','dispute') ORDER BY id");
  assert.ok(rows.length >= 1, "the seed has a claimed or disputed invoice");
  for (const r of rows) {
    const s = await as({ uid: 1, role: "owner" })((c, ctx) => offers.suggest(c, ctx, r.id));
    assert.equal(s.suggestion, null);
    await assert.rejects(() => as({ uid: 1, role: "owner" })((c, ctx) => offers.make(c, ctx, r.id, { discount_paise: 10000, pay_by: ctx.asOf })), /not open for an offer/);
  }
});
