// Automatic reminder calls (simulated): what the call says, and when the daily run places one.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { callScript } from "../lib/callScript.js";

const business = { name: "Arora Auto Components", phone: "+91 98XXXXXXXX" };
const base = { business, customer: "Mehta & Sons", numbers: ["INV/26-27/0042"], amount_paise: 11_718_600, due_date: "2026-10-31" };
const THREATS = /legal|lawyer|court|notice|police|penalty|default|कानूनी|वकील|अदालत|नोटिस|पुलिस|जुर्माना/i;

test("the call names the bill, amount and due date, and mentions interest only for a micro/small supplier", () => {
  const before = callScript({ ...base, kind: "before", interest: true });
  assert.match(before.text, /INV\/26-27\/0042/);
  assert.match(before.text, /₹1,17,186/);
  assert.match(before.text, /is due on 31 Oct 2026/);
  assert.match(before.text, /MSMED Act, payments made after the due date carry interest/);
  assert.doesNotMatch(callScript({ ...base, kind: "before", interest: false }).text, /interest/i);
  const late = callScript({ ...base, kind: "after", interest: true });
  assert.match(late.text, /was due on 31 Oct 2026 and is still open/);
  assert.match(late.text, /interest applies from 1 Nov 2026/);
  assert.match(callScript({ ...base, kind: "before", business: { name: "X" } }).text, /Thank you\.$/, "no phone: still a polite close");
});

test("Hindi calls are in Hindi, and no call threatens", () => {
  const hi = callScript({ ...base, lang: "hi", kind: "after", interest: true });
  assert.equal(hi.lang, "hi");
  assert.match(hi.text, /[ऀ-ॿ]/);
  for (const lang of ["en", "hi"]) for (const kind of ["before", "after"]) {
    assert.doesNotMatch(callScript({ ...base, lang, kind, interest: true }).text, THREATS, `${lang} ${kind}`);
  }
});

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, calls, T;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  calls = await import("../lib/services/calls.js");
  T = await import("../lib/services/tick.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });
const run = (fn) => ctxMod.run((c, ctx) => fn(c, ctx));
const q = async (sql, p) => (await db.pool.query(sql, p)).rows;

test("one call per step: 7 days before the due date, never twice, never to an opted-out customer", { skip }, async () => {
  const asOf = await run(async (c, ctx) => ctx.asOf);
  const open = await q(
    `SELECT DISTINCT ON (i.customer_id) i.id, i.customer_id FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id JOIN customers c ON c.id = i.customer_id
     WHERE i.status IN ('sent','part_paid') AND i.paused_by IS NULL AND b.outstanding_paise > 0 AND c.opt_out = false AND c.phone IS NOT NULL
     ORDER BY i.customer_id, i.id LIMIT 2`);
  // Clear the board, then make one bill due in exactly 7 days and another 7 days late for a customer who opted out.
  await q("UPDATE invoices SET due_date = $1::date + 200 WHERE status IN ('sent','part_paid')", [asOf]);
  await q("UPDATE invoices SET due_date = $1::date + 7 WHERE id = $2", [asOf, open[0].id]);
  await q("UPDATE invoices SET due_date = $1::date - 7 WHERE id = $2", [asOf, open[1].id]);
  await q("UPDATE customers SET opt_out = true WHERE id = $1", [open[1].customer_id]);

  const first = await run((c, ctx) => calls.placeDue(c, ctx));
  assert.equal(first.length, 1);
  assert.equal(first[0].step, -7);
  assert.match(first[0].script, /due on|भुगतान तारीख/);
  assert.match(first[0].script, /MSMED/, "the seeded business is a small enterprise, so the interest fact is said");
  assert.match(first[0].to, /^…\d{4}$/, "only the last 4 digits are recorded");
  assert.equal((await run((c, ctx) => calls.placeDue(c, ctx))).length, 0, "the same step is never called twice");
  const [ev] = await q("SELECT payload FROM escalation_events WHERE type = 'call_placed' AND invoice_id = $1", [open[0].id]);
  assert.equal(JSON.parse(ev.payload).simulated, true);
  assert.equal((await run((c, ctx) => calls.today(c, ctx))).length, 1);
});

test("the daily run places calls and counts them; turning calls off stops them", { skip }, async () => {
  await db.withTxn((c) => seedMod.seed(c));
  const s = await run((c, ctx) => T.tick(c, ctx, { source: "test" }));
  assert.equal(typeof s.calls, "number");
  const placed = (await q("SELECT count(DISTINCT payload::jsonb->>'call_id')::int AS n FROM escalation_events WHERE type = 'call_placed'"))[0].n;
  assert.equal(s.calls, placed);
  assert.deepEqual(await run((c, ctx) => calls.placeDue(c, { ...ctx, cfg: { ...ctx.cfg, calls: { enabled: false } } })), []);
});
