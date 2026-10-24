// Payment receipts: confirming a payment queues a thank-you receipt the customer can keep, and the owner can note in the bill book.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, payments, outbox, followups;
before(async () => {
  if (skip) return;
  process.env.RESEND_API_KEY = "re_test_dummy_not_a_key"; // email set up; nothing here flushes, so Resend is never called
  process.env.MAIL_FROM = "FullPay test <test@example.in>";
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  payments = await import("../lib/services/payments.js");
  outbox = await import("../lib/services/outbox.js");
  followups = await import("../lib/services/followups.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });
const owner = (fn) => ctxMod.run((c, ctx) => fn(c, Object.assign(ctx, { user: { uid: 1, role: "owner" } }), ctx));

// Open invoices of different customers, largest balance first.
async function openInvoices() {
  const { rows } = await db.pool.query(
    `SELECT DISTINCT ON (i.customer_id) i.id, i.number, i.customer_id, b.outstanding_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
     JOIN customers c ON c.id = i.customer_id WHERE i.status IN ('sent','part_paid') AND i.paused_by IS NULL AND b.outstanding_paise > 100000 AND c.anonymized_at IS NULL
     ORDER BY i.customer_id, b.outstanding_paise DESC`);
  return rows;
}
const pay = (inv, amount_paise, reference = "NEFT RCPT-TEST") => owner(async (c, ctx, raw) => {
  const p = await payments.addManual(c, ctx, { invoice_id: inv.id, paid_on: ctx.asOf, amount_paise, reference });
  await payments.confirm(c, ctx, p.id);
  const row = (await c.query("SELECT * FROM outbox WHERE rung = 'payment_received' AND run_id = $1", [`receipt-${p.id}`])).rows[0];
  return { p, row, queued: raw.mail_queued ?? [] };
});

test("full payment, customer with email: an automatic email receipt, sent as soon as the request commits", { skip }, async () => {
  const [inv] = await openInvoices();
  await db.pool.query("UPDATE customers SET email = 'buyer@example.in', opt_out = false WHERE id = $1", [inv.customer_id]);
  const { p, row, queued } = await pay(inv, Number(inv.outstanding_paise));
  assert.deepEqual([row.channel, row.status, row.recipient], ["email", "queued", "buyer@example.in"]);
  assert.deepEqual(queued, [row.id], "the route wrapper is told to send it after commit");
  assert.ok(row.subject.includes(outbox.receiptNo(p.id)) && row.body.includes(outbox.receiptNo(p.id)));
  assert.ok(row.body.includes(inv.number) && row.body.includes("NEFT RCPT-TEST"));
  assert.match(row.body, /fully paid|पूरा चुकता/);
});

test("part payment, no email: a one-tap WhatsApp receipt with the balance left, shown in Today's follow-ups", { skip }, async () => {
  const [, inv] = await openInvoices();
  await db.pool.query("UPDATE customers SET email = NULL, phone = '9876543210', preferred_lang = 'en' WHERE id = $1", [inv.customer_id]);
  const { row, queued } = await pay(inv, 50000);
  assert.deepEqual([row.channel, row.status, queued.length], ["whatsapp", "awaiting_owner", 0]);
  assert.match(row.body, /Balance still due: ₹/);
  const today = await owner((c, ctx) => followups.listToday(c, ctx));
  assert.ok(today.ready.some((r) => r.id === row.id), "the receipt card is ready to send");
  // Sending it from the owner's phone is recorded as a receipt, not a reminder.
  await owner((c, ctx) => outbox.markSent(c, ctx, row.id, { channel: "whatsapp" }));
  const { rows: ev } = await db.pool.query("SELECT type FROM escalation_events WHERE invoice_id = $1 ORDER BY id DESC LIMIT 1", [inv.id]);
  assert.equal(ev[0].type, "receipt_sent");
});

test("a customer who stopped automatic messages gets no automatic email; the receipt waits for the owner", { skip }, async () => {
  const [, , inv] = await openInvoices();
  await db.pool.query("UPDATE customers SET email = 'quiet@example.in', opt_out = true WHERE id = $1", [inv.customer_id]);
  const { row, queued } = await pay(inv, Number(inv.outstanding_paise));
  assert.equal(row.status, "awaiting_owner");
  assert.equal(queued.length, 0);
  const today = await owner((c, ctx) => followups.listToday(c, ctx));
  assert.ok(today.ready.some((r) => r.id === row.id), "a receipt for a fully paid bill is still shown");
});

test("no email set up: the receipt for a customer with an address waits as a one-tap WhatsApp message", { skip }, async () => {
  const [, , , , inv] = await openInvoices();
  await db.pool.query("UPDATE customers SET email = 'buyer2@example.in', phone = '9876500000', opt_out = false WHERE id = $1", [inv.customer_id]);
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const { row, queued } = await pay(inv, Number(inv.outstanding_paise));
    assert.deepEqual([row.status, row.channel, queued.length], ["awaiting_owner", "whatsapp", 0]);
  } finally {
    process.env.RESEND_API_KEY = key;
  }
});

test("old money and TDS get no receipt", { skip }, async () => {
  const [, , , inv] = await openInvoices();
  const n = await owner(async (c, ctx) => {
    const p = await payments.addManual(c, ctx, { invoice_id: inv.id, paid_on: ctx.asOf, amount_paise: 10000, reference: "history" });
    await payments.confirm(c, ctx, p.id, null, { receipt: false });
    return (await c.query("SELECT count(*)::int AS n FROM outbox WHERE run_id = $1", [`receipt-${p.id}`])).rows[0].n;
  });
  assert.equal(n, 0);
});
