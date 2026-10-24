// Integration tests for the daily run (lib/services/tick.js) and the outbox, against the local database.
// Skipped without DATABASE_URL. They reseed the database and leave it freshly seeded at the end.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL && "DATABASE_URL not set";

let db, T, O, ctxMod, chain, seedMod;
before(async () => {
  if (SKIP) return;
  // A server with email set up (a dummy key: nothing here calls Resend until the key is removed for the flush test).
  process.env.RESEND_API_KEY = "re_test_dummy_not_a_key";
  process.env.MAIL_FROM = "FullPay test <test@example.in>";
  db = await import("../lib/db.js");
  T = await import("../lib/services/tick.js");
  O = await import("../lib/services/outbox.js");
  ctxMod = await import("../lib/services/context.js");
  chain = await import("../lib/chain.js");
  seedMod = await import("../db/seed.js");
  await T.reseed();
});
after(async () => {
  if (SKIP) return;
  await T.reseed();
  await db.pool.end();
});

const run = (fn) => ctxMod.run(fn);
const tick = () => run((c, ctx) => T.tick(c, ctx, { source: "test" }));
const q = async (sql, params) => (await db.pool.query(sql, params)).rows;
const idsOf = async (numbers) => (await q("SELECT id FROM invoices WHERE number = ANY($1)", [numbers])).map((r) => Number(r.id));
const outboxTouching = async (ids) => q("SELECT * FROM outbox WHERE invoice_ids && $1::bigint[]", [ids]);

test("the first tick at the anchor queues exactly the 3 automatic sends, one per customer", { skip: SKIP }, async () => {
  const s = await tick();
  assert.equal(s.as_of, seedMod.SEED_ANCHOR);
  assert.equal(s.queued, 3);
  assert.equal(s.awaiting_owner, 0);
  const rows = await q("SELECT o.*, (SELECT array_agg(number) FROM invoices WHERE id = ANY(o.invoice_ids)) AS numbers FROM outbox o ORDER BY id");
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.status === "queued" && r.channel === "email" && r.run_id === s.run_id));
  assert.deepEqual(rows.map((r) => r.numbers[0]).sort(), ["INV/26-27/0049", "INV/26-27/0055", "INV/26-27/0061"]);
  assert.equal(new Set(rows.map((r) => r.customer_id)).size, 3);
  // Each message carries the pay link and a verify link to its own sealed message_queued event.
  for (const r of rows) {
    assert.match(r.body, /\/pay\/[A-Za-z0-9_-]{20,}/);
    const hash = r.body.match(/\/verify\/([0-9a-f]{64})/)[1];
    const [ev] = await q("SELECT type, payload FROM escalation_events WHERE entry_hash = $1", [hash]);
    assert.equal(ev.type, "message_queued");
    assert.equal(JSON.parse(ev.payload).outbox_id, Number(r.id));
  }
  const [run1] = await q("SELECT payload FROM escalation_events WHERE type = 'tick_run' ORDER BY id DESC LIMIT 1");
  assert.equal(JSON.parse(run1.payload).run_id, s.run_id);
  assert.ok(chain.verifyChain(await chain.loadChain((t, p) => db.pool.query(t, p))).ok);
});

test("a second tick the same day queues nothing (no stage twice)", { skip: SKIP }, async () => {
  const s = await tick();
  assert.equal(s.advanced, 0);
  assert.equal(s.queued + s.awaiting_owner, 0);
  assert.equal((await q("SELECT count(*)::int AS n FROM outbox"))[0].n, 3);
});

test("flush without RESEND_API_KEY marks rows failed with a clear reason and does not throw", { skip: SKIP }, async () => {
  delete process.env.RESEND_API_KEY; // the key went missing after these were queued
  const r = await O.flush();
  assert.equal(r.attempted, 3);
  assert.equal(r.failed, 3);
  const rows = await q("SELECT status, error, attempts FROM outbox");
  assert.ok(rows.every((x) => x.status === "failed" && /RESEND_API_KEY/.test(x.error) && x.attempts === 1));
  assert.ok(chain.verifyChain(await chain.loadChain((t, p) => db.pool.query(t, p))).ok, "failed events keep the chain intact");
  // Retry puts it back in the queue; mark-sent closes it by hand.
  const [first] = await q("SELECT id FROM outbox ORDER BY id LIMIT 1");
  await run((c, ctx) => O.retry(c, ctx, first.id));
  assert.equal((await O.flush({ ids: [first.id] })).failed, 1);
  const sent = await run((c, ctx) => O.markSent(c, ctx, first.id, { channel: "whatsapp" }));
  assert.equal(sent.status, "sent");
  await assert.rejects(run((c, ctx) => O.markSent(c, ctx, first.id)), (e) => e.status === 409);
});

test("concurrent ticks: while one holds the lock, the other gets 409 tick_running", { skip: SKIP }, async () => {
  const holder = await db.pool.connect();
  try {
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock($1)", [T.TICK_LOCK]);
    await assert.rejects(tick(), (e) => e.status === 409 && e.code === "tick_running");
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
  }
  const both = await Promise.allSettled([tick(), tick()]);
  assert.ok(both.some((r) => r.status === "fulfilled"));
  assert.ok(both.every((r) => r.status === "fulfilled" || r.reason.code === "tick_running"));
});

test("T0+1: the broken promise resumes the ladder; disputed, paused and opted-out invoices get nothing", { skip: SKIP }, async () => {
  const s = await T.advanceDemo(1);
  assert.equal(s.as_of, "2026-10-25");
  assert.ok(s.promises_broken >= 1);
  const [p0051] = await q("SELECT p.status FROM promises p JOIN invoices i ON i.id = p.invoice_id WHERE i.number = 'INV/26-27/0051'");
  assert.equal(p0051.status, "broken");
  const [i0051] = await idsOf(["INV/26-27/0051"]);
  assert.equal((await outboxTouching([i0051])).length, 1, "the resumed invoice gets its next message");
  // 0044 (due+29 at the anchor) crosses the letter rung: drafted for the owner, never sent.
  const [letter] = await q("SELECT rung FROM invoices WHERE number = 'INV/26-27/0044'");
  assert.equal(letter.rung, "demand_letter");
  assert.equal((await q("SELECT count(*)::int AS n FROM outbox WHERE rung IN ('demand_letter','odr_guidance')"))[0].n, 0);

  await T.advanceDemo(3);
  // Disputed (0047), paused by an already-paid claim (0053) and by an open promise until 29 Oct (0043).
  assert.equal((await outboxTouching(await idsOf(["INV/26-27/0047", "INV/26-27/0053", "INV/26-27/0043"]))).length, 0);
  // Bajwa Logistics opted out: no automatic or owner-tap message, ever.
  const bajwa = await q("SELECT o.id FROM outbox o JOIN customers c ON c.id = o.customer_id WHERE c.opt_out");
  assert.equal(bajwa.length, 0);
  // At most one message per customer per day.
  const perDay = await q(
    `SELECT customer_id, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS d, count(*)::int AS n FROM outbox
     WHERE rung <> 'invoice_sent' GROUP BY 1, 2 HAVING count(*) > 1`,
  );
  assert.deepEqual(perDay, []);
  // Every invoice advanced at most one rung per run.
  const multi = await q("SELECT run_id, invoice_id FROM escalation_events WHERE type = 'rung_advanced' GROUP BY 1, 2 HAVING count(*) > 1");
  assert.deepEqual(multi, []);
});

test("queueInvoiceEmail queues the invoice email for a sent invoice", { skip: SKIP }, async () => {
  const [inv] = await idsOf(["INV/26-27/0064"]);
  const row = await run((c, ctx) => O.queueInvoiceEmail(c, ctx, inv));
  assert.equal(row.rung, "invoice_sent");
  assert.match(row.subject, /INV\/26-27\/0064/);
});

test("reseed restores the pinned letter hash and an empty outbox", { skip: SKIP }, async () => {
  const facts = await T.reseed();
  assert.equal(facts.letter_hash, seedMod.SEED_LETTER_HASH);
  assert.equal((await q("SELECT count(*)::int AS n FROM outbox"))[0].n, 0);
  assert.equal((await q("SELECT count(*)::int AS n FROM escalation_events WHERE type = 'tick_run'"))[0].n, 0);
  const st = await run((c, ctx) => T.status(c, ctx));
  assert.equal(st.chain.intact, true);
  assert.equal(st.runs.length, 0);
  assert.equal(st.demo.minutes_since_reset, 0);
  assert.equal(JSON.stringify(st).includes("@"), false, "status carries no email addresses");
});

test("no email set up: the automatic steps wait as one-tap WhatsApp messages instead of failing", { skip: SKIP }, async () => {
  delete process.env.RESEND_API_KEY;
  const s = await tick();
  assert.deepEqual([s.queued, s.awaiting_owner], [0, 3]);
  const rows = await q("SELECT o.status, o.channel, c.phone FROM outbox o JOIN customers c ON c.id = o.customer_id");
  assert.ok(rows.length === 3 && rows.every((r) => r.status === "awaiting_owner" && r.channel === (r.phone ? "whatsapp" : "email")));
  assert.equal((await O.flush()).attempted, 0, "nothing is tried, so nothing fails");
});
