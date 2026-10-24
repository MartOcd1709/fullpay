// Integration tests for lib/services + db/seed.js against the local database. Skipped without DATABASE_URL.
// They wipe and reseed the database, and leave it freshly seeded at the end.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SKIP = !process.env.DATABASE_URL && "DATABASE_URL not set";
const CSV = new URL("../db/bank-statement.csv", import.meta.url);

let db, seedMod, ctxMod, chain, gst, inv, pay, pub, inbox, views, rungs, customers;
before(async () => {
  if (SKIP) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  chain = await import("../lib/chain.js");
  gst = await import("../lib/gst.js");
  inv = await import("../lib/services/invoices.js");
  pay = await import("../lib/services/payments.js");
  pub = await import("../lib/services/public.js");
  inbox = await import("../lib/services/inbox.js");
  views = await import("../lib/services/views.js");
  rungs = await import("../lib/services/rungs.js");
  customers = await import("../lib/services/customers.js");
});
after(async () => {
  if (SKIP) return;
  await reseed();
  await db.pool.end();
});

const reseed = () => db.withTxn((c) => seedMod.seed(c));
const run = (fn) => ctxMod.run(fn);
const byNumber = async (c, number) => (await c.query("SELECT id, pay_token FROM invoices WHERE number = $1", [number])).rows[0];

test("seed is deterministic: two reseeds give the same pinned letter hash and chain head", { skip: SKIP }, async () => {
  const a = await reseed();
  const b = await reseed();
  assert.equal(a.letter_hash, seedMod.SEED_LETTER_HASH);
  assert.equal(b.letter_hash, seedMod.SEED_LETTER_HASH);
  assert.equal(a.chain_head, b.chain_head);
  assert.equal(a.events, b.events);
  assert.equal(a.first_tick_sends.length, 3);
});

test("chain verifies from genesis and the letter's /verify shows the payee recorded at issue", { skip: SKIP }, async () => {
  const rows = await chain.loadChain(db.query);
  assert.equal(chain.verifyChain(rows).ok, true);
  const v = await chain.verifyEntry(db.query, seedMod.SEED_LETTER_HASH);
  assert.deepEqual([v.found, v.intact, v.event.type, v.event.invoice_number], [true, true, "letter_generated", "INV/26-27/0042"]);
  assert.deepEqual(v.payee, { vpa: "aroraauto@okhdfcbank", bank_last4: "4321" });
});

test("seeded facts: all seven statuses, A/B/C grades, the 0042 letter rung, exactly 3 auto sends on the first tick", { skip: SKIP }, async () => {
  await run(async (c, ctx) => {
    assert.equal(ctx.asOf, seedMod.SEED_ANCHOR);
    const list = await inv.list(c, ctx);
    const statuses = new Set(list.map((i) => i.display_status));
    for (const s of ["draft", "sent", "due_soon", "overdue", "part_paid", "paid", "disputed"]) assert.ok(statuses.has(s), s);
    assert.equal(list.filter((i) => i.status === "disputed").length, 1);
    assert.equal(list.filter((i) => i.status === "draft").length, 1);
    assert.ok(list.some((i) => i.days_overdue > 45) && list.some((i) => i.days_overdue > 30 && i.days_overdue <= 45));
    const grades = new Set((await customers.list(c, ctx)).map((x) => x.grade));
    assert.deepEqual([...grades].sort(), ["A", "B", "C"]);
    const letter = list.find((i) => i.number === "INV/26-27/0042");
    assert.equal(letter.rung, "demand_letter");
    const sends = (await rungs.evaluateAll(c, ctx)).filter((x) => x.ev.eligible);
    assert.equal(sends.length, 3);
    assert.ok(sends.every((x) => x.ev.channel_policy === "auto"));
    const detail = await inv.get(c, ctx, letter.id);
    assert.ok(detail.interest.total_interest_paise > 0, "Udyam small seller: s.16 interest on an overdue invoice");
    assert.ok(detail.timeline.some((e) => e.type === "letter_generated" && e.entry_hash === seedMod.SEED_LETTER_HASH));
    assert.match(detail.upi, /^upi:\/\/pay\?pa=aroraauto@okhdfcbank&/);
  });
});

test("GSTINs of every seeded customer pass the check digit; tampering one character fails", { skip: SKIP }, async () => {
  const { rows } = await db.query("SELECT gstin FROM customers WHERE gstin IS NOT NULL");
  assert.equal(rows.length, 13);
  for (const { gstin } of rows) assert.equal(gst.validateGSTIN(gstin).valid, true, gstin);
  const g = rows[0].gstin;
  const flipped = g.slice(0, 14) + (g[14] === "A" ? "B" : "A");
  assert.equal(gst.validateGSTIN(flipped).valid, false);
});

test("pack A1: Rs 10,000 at 18% is CGST 900 + SGST 900 in Punjab and IGST 1,800 to Haryana", { skip: SKIP }, async () => {
  await run(async (c, ctx) => {
    const item = [{ description: "Propeller shaft", hsn_sac: "8483", qty_milli: 1000, rate_paise: 1_000_000, gst_bps: 1800 }];
    const pb = (await c.query("SELECT id FROM customers WHERE state_code = '03' AND gstin IS NOT NULL ORDER BY id LIMIT 1")).rows[0].id;
    const hr = (await c.query("SELECT id FROM customers WHERE state_code = '06' LIMIT 1")).rows[0].id;
    const a = await inv.createDraft(c, ctx, { customer_id: pb, issue_date: ctx.asOf, items: item });
    const b = await inv.createDraft(c, ctx, { customer_id: hr, issue_date: ctx.asOf, items: item });
    assert.deepEqual([a.taxable_paise, a.cgst_paise, a.sgst_paise, a.igst_paise, a.total_paise], [1_000_000, 90_000, 90_000, 0, 1_180_000]);
    assert.deepEqual([b.taxable_paise, b.cgst_paise, b.sgst_paise, b.igst_paise, b.total_paise], [1_000_000, 0, 0, 180_000, 1_180_000]);
    assert.equal(a.items[0].gst_bps, 1800);
    assert.equal(a.doc_type, "tax_invoice");
    assert.equal(a.number, null);
    await assert.rejects(inv.createDraft(c, ctx, { customer_id: pb, issue_date: ctx.asOf, items: [{ ...item[0], gst_bps: 2800 }] }), { status: 400, code: "invalid_gst_rate" });
  });
});

test("10 concurrent sends get consecutive numbers with no gaps", { skip: SKIP }, async () => {
  const ids = await run(async (c, ctx) => {
    const out = [];
    for (let i = 0; i < 10; i++) {
      const d = await inv.createDraft(c, ctx, { customer_id: 1, issue_date: ctx.asOf, items: [{ description: `Bolt lot ${i}`, hsn_sac: "7318", qty_milli: 1000, rate_paise: 140_000, gst_bps: 1800 }] });
      out.push(d.id);
    }
    return out;
  });
  const before = (await db.query("SELECT max(seq) AS m FROM invoices WHERE fy = '26-27'")).rows[0].m;
  const sent = await Promise.all(ids.map((id) => run((c, ctx) => inv.send(c, ctx, id))));
  const seqs = sent.map((s) => s.seq).sort((x, y) => x - y);
  assert.deepEqual(seqs, Array.from({ length: 10 }, (_, i) => before + 1 + i));
  assert.ok(sent.every((s) => s.number === gst.invoiceNumber("26-27", s.seq) && s.pay_token.length === 32));
  const created = sent[0].timeline.find((e) => e.type === "invoice_created");
  assert.deepEqual(created.payload.payee, { vpa: "aroraauto@okhdfcbank", bank_last4: "4321" });
  await assert.rejects(run((c, ctx) => inv.send(c, ctx, ids[0])), { status: 409 });
});

test("bank statement: six cases flagged, debit + malformed skipped, re-import is all duplicates, nothing paid before confirm", { skip: SKIP }, async () => {
  await reseed();
  const csv = readFileSync(CSV, "utf8");
  const first = await run((c, ctx) => pay.importCsv(c, ctx, csv));
  assert.equal(first.imported.length, 6);
  assert.equal(first.duplicates_skipped, 0);
  assert.deepEqual(first.skipped.map((s) => s.reason), ["before_header", "before_header", "opening_balance", "debit", "bad_amount"]);
  const flags = Object.fromEntries(first.imported.map((p) => [p.amount_paise, p.flags]));
  const byFlag = (f) => first.imported.filter((p) => JSON.stringify(p.flags) === JSON.stringify(f));
  assert.equal(byFlag([]).length, 1, "exact");
  assert.equal(byFlag(["part"]).length, 1);
  assert.equal(byFlag(["multi"]).length, 1);
  assert.equal(byFlag(["tds_2"]).length, 1);
  assert.equal(byFlag(["overpaid"]).length, 1);
  assert.equal(byFlag(["unmatched"]).length, 1, JSON.stringify(flags));
  assert.match(byFlag(["tds_2"])[0].match_reason, /TDS/);
  assert.equal(byFlag(["multi"])[0].proposals.length, 2);
  assert.ok(first.imported.every((p) => p.status === "pending" && p.allocations.length === 0));
  const { rows } = await db.query("SELECT count(*)::int AS n FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE p.source = 'csv'");
  assert.equal(rows[0].n, 0, "import never allocates");

  const second = await run((c, ctx) => pay.importCsv(c, ctx, csv));
  assert.equal(second.imported.length, 0);
  assert.equal(second.duplicates_skipped, 6);

  await run(async (c, ctx) => {
    const exact = byFlag([])[0];
    const invId = exact.proposals[0].invoice_id;
    assert.equal((await inv.get(c, ctx, invId)).status, "sent");
    await pay.confirm(c, ctx, exact.id);
    const after = await inv.get(c, ctx, invId);
    assert.equal(after.status, "paid");
    assert.equal(after.outstanding_paise, 0);
    assert.equal(after.pay_token, null);
    assert.ok(after.timeline.some((e) => e.type === "payment_confirmed"));

    const part = byFlag(["part"])[0];
    await pay.confirm(c, ctx, part.id);
    assert.equal((await inv.get(c, ctx, part.proposals[0].invoice_id)).status, "part_paid");

    const multi = byFlag(["multi"])[0];
    await pay.confirm(c, ctx, multi.id);
    for (const p of multi.proposals) assert.equal((await inv.get(c, ctx, p.invoice_id)).status, "paid");

    const unknown = byFlag(["unmatched"])[0];
    await assert.rejects(pay.confirm(c, ctx, unknown.id), { status: 400, code: "no_allocations" });
    await pay.reject(c, ctx, unknown.id);
    await assert.rejects(pay.confirm(c, ctx, exact.id), { status: 409 });
  });
});

test("pay-token dispute pauses the ladder and lands in the inbox; accepting a credit note records the 0% span", { skip: SKIP }, async () => {
  await reseed();
  const target = await byNumber(db, "INV/26-27/0044"); // due+29, otherwise crosses the letter rung tomorrow
  await run(async (c, ctx) => {
    const view = await pub.byToken(c, ctx, target.pay_token);
    assert.equal(view.invoice.number, "INV/26-27/0044");
    assert.equal(view.business.name, "Arora Auto Components");
    assert.equal(JSON.stringify(view).includes("demo+c"), false, "no customer contact data on the public page");
    await assert.rejects(pub.byToken(c, ctx, "x".repeat(32)), { status: 404 });
    await pub.dispute(c, ctx, target.pay_token, { reason: "Two brake drums were returned damaged." });
    const d = await inv.get(c, ctx, target.id);
    assert.deepEqual([d.status, d.paused_by], ["disputed", "dispute"]);
    const ev = (await rungs.evaluateAll(c, { ...ctx, asOf: "2026-10-25" })).find((x) => x.inv.id === target.id);
    assert.equal(ev, undefined, "a disputed invoice is not on the ladder");
  });
  const before = await run((c, ctx) => inv.get(c, ctx, target.id));
  const items = await run((c, ctx) => inbox.list(c, ctx));
  const item = items.find((x) => x.invoice_id === target.id && x.kind === "dispute");
  assert.ok(item);
  assert.ok(items.some((x) => x.kind === "claim"), "the seeded already-paid claim is in the inbox");

  await run(async (c, ctx) => {
    await inbox.resolve(c, ctx, item.id, { action: "accept_credit_note", amount_paise: 500_000, reason: "Two damaged drums" });
    const d = await inv.get(c, ctx, target.id);
    assert.equal(d.outstanding_paise, before.outstanding_paise - 500_000);
    assert.equal(d.status, "sent");
    assert.equal(d.paused_by, null, "resolving resumes the ladder");
    assert.equal(d.credit_notes[0].number, "CN/26-27/0001");
    const adj = d.timeline.find((e) => e.type === "invoice_adjusted");
    assert.equal(adj.payload.credit_note_no, "CN/26-27/0001");
    assert.equal(adj.payload.new_total, adj.payload.old_total - 500_000);
    assert.deepEqual(d.inbox[0].accepted, true);
    const spans = (await c.query("SELECT opened_on, resolved_on FROM inbox_items WHERE id = $1", [item.id])).rows[0];
    assert.deepEqual(spans, { opened_on: ctx.asOf, resolved_on: ctx.asOf });
    await assert.rejects(inbox.resolve(c, ctx, item.id, { action: "reject", reply: "no" }), { status: 409 });
  });
});

test("dashboard numbers equal sums computed directly in SQL; forecast weeks chain", { skip: SKIP }, async () => {
  await reseed();
  await run(async (c, ctx) => {
    const d = await views.dashboard(c, ctx);
    const sql = (
      await c.query(
        `SELECT COALESCE(SUM(b.outstanding_paise), 0)::bigint AS to_collect,
                COALESCE(SUM(b.outstanding_paise) FILTER (WHERE i.due_date < $1), 0)::bigint AS overdue,
                COALESCE(SUM(b.outstanding_paise) FILTER (WHERE i.due_date >= $1), 0)::bigint AS not_due
         FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
         WHERE i.status NOT IN ('draft','paid') AND b.outstanding_paise > 0`,
        [ctx.asOf],
      )
    ).rows[0];
    assert.equal(d.to_collect_paise, sql.to_collect);
    assert.equal(d.overdue_paise, sql.overdue);
    assert.equal(d.aging.not_due.amount_paise, sql.not_due);
    const agingSum = Object.values(d.aging).reduce((s, b) => s + b.amount_paise, 0);
    assert.equal(agingSum, sql.to_collect);
    assert.equal(d.cash_in_bank_paise, ctx.cfg.forecast.opening_balance_paise);
    assert.equal(d.top_chase.length, 5);

    const f = await views.forecast(c, ctx);
    assert.equal(f.weeks.length, 13);
    assert.equal(f.weeks[0].opening_paise, ctx.cfg.forecast.opening_balance_paise);
    for (let w = 0; w < 12; w++) assert.equal(f.weeks[w].closing_paise, f.weeks[w + 1].opening_paise);
    for (const w of f.weeks) assert.equal(w.closing_paise, w.opening_paise + w.inflow_paise - w.outflow_paise);
    assert.equal(f.totals.inflow_paise + f.totals.after_window_inflow_paise, sql.to_collect, "every rupee owed lands in some week");
    const expenses = (await c.query("SELECT COALESCE(SUM(amount_paise), 0)::bigint AS s FROM expenses WHERE NOT paid AND recurring IS NULL AND due_on >= $1", [ctx.asOf])).rows[0].s;
    const oneOff = f.weeks.flatMap((w) => w.outflows).filter((o) => o.category === "supplier").reduce((s, o) => s + o.amount_paise, 0);
    assert.equal(oneOff, expenses);
    assert.equal(f.first_shortfall_week, 3, "seed design: cash drops below the buffer in week 4 (index 3)");
    assert.ok(f.cover_gap.length > 0);
  });
});

test("remaining paths: claim mark-paid, dispute reject/edit, promises, customers, settings, documents, expired link", { skip: SKIP }, async () => {
  await reseed();
  const settings = await import("../lib/services/settings.js");
  const promises = await import("../lib/services/promises.js");
  await run(async (c, ctx) => {
    // The seeded "already paid" claim: mark paid confirms the pending claim payment and clears the pause.
    const claim = (await inbox.list(c, ctx)).find((x) => x.kind === "claim");
    await inbox.resolve(c, ctx, claim.id, { action: "mark_paid" });
    const paid = await inv.get(c, ctx, claim.invoice_id);
    assert.deepEqual([paid.status, paid.paused_by, paid.outstanding_paise], ["paid", null, 0]);

    // The seeded dispute: reject with a reply restores the stored status and resumes the ladder.
    const disp = (await inbox.list(c, ctx)).find((x) => x.kind === "dispute");
    await assert.rejects(inbox.resolve(c, ctx, disp.id, { action: "reject" }), { code: "reply_required" });
    await inbox.resolve(c, ctx, disp.id, { action: "reject", reply: "The rate matches the quotation dated 2 Sep." });
    const restored = await inv.get(c, ctx, disp.invoice_id);
    assert.deepEqual([restored.status, restored.paused_by], ["sent", null]);
    assert.ok(restored.timeline.some((e) => e.type === "dispute_resolved"));

    // Dispute again, resolve by editing the terms: due date moves, the span is accepted.
    const tok = (await c.query("SELECT pay_token, acceptance_date FROM invoices WHERE id = $1", [disp.invoice_id])).rows[0];
    await pub.dispute(c, ctx, tok.pay_token, { reason: "We agreed 45 days." });
    const again = (await inbox.list(c, ctx)).find((x) => x.invoice_id === disp.invoice_id);
    await inbox.resolve(c, ctx, again.id, { action: "edit", changes: { credit_days: 45 } });
    const edited = await inv.get(c, ctx, disp.invoice_id);
    assert.equal(edited.credit_days, 45);
    assert.ok(edited.due_date > restored.due_date);

    // Promises: one open at a time, at most 14 days out.
    const open = (await inv.list(c, ctx, { status: "overdue" })).find((i) => !i.paused_by && i.status === "sent");
    await assert.rejects(promises.create(c, ctx, { invoice_id: open.id, promised_date: "2026-12-31" }), { code: "date_too_far" });
    await promises.create(c, ctx, { invoice_id: open.id, promised_date: "2026-10-30", amount_paise: 10_000 });
    assert.equal((await inv.get(c, ctx, open.id)).paused_by, "promise");
    await assert.rejects(promises.create(c, ctx, { invoice_id: open.id, promised_date: "2026-10-31" }), { status: 409 });

    // Customers: GSTIN validated, state from GSTIN, credit capped at 45, anonymise keeps the ledger.
    await assert.rejects(customers.create(c, ctx, { name: "Bad GSTIN", gstin: "03AAAAA0000A1Z0" }), { code: "invalid_gstin" });
    const g = `06AABCT1234Q1Z${gst.computeGSTINCheckDigit("06AABCT1234Q1Z")}`;
    const nc = await customers.create(c, ctx, { name: "Test Haryana Buyer", gstin: g, credit_days: 90, email: "t@example.in" });
    assert.deepEqual([nc.state_code, nc.credit_days, nc.grade], ["06", 45, "B"]);
    await assert.rejects(customers.create(c, ctx, { name: "No state" }), { code: "state_required" });
    const c3 = (await customers.list(c, ctx)).find((x) => x.grade === "C");
    const owed = c3.total_owed_paise;
    const anon = await customers.anonymize(c, ctx, c3.id);
    assert.equal(anon.name, `Anonymised customer #${c3.id}`);
    assert.deepEqual([anon.email, anon.phone, anon.address], [null, null, null]);
    assert.equal(anon.total_owed_paise, owed);
    const opted = await customers.setOptOut(c, ctx, nc.id, true);
    assert.equal(opted.opt_out, true);

    // Settings: deep-merged, validated, logged.
    await assert.rejects(settings.save(c, ctx, { ladder: { offsets: { heads_up: 5 } } }), { code: "config_invalid" });
    const s = await settings.save(c, ctx, { forecast: { buffer_paise: 20_000_000 }, ui: { lang: "hi" } });
    assert.deepEqual([s.forecast.buffer_paise, s.ui.lang, s.demo.clock_date, s.demo.t0], [20_000_000, "hi", null, seedMod.SEED_ANCHOR]);
    assert.equal(ctx.asOf, seedMod.SEED_ANCHOR);
    // What the Settings form and the quiet-days box send must pass the API's own check (it once refused both with a 400).
    settings.check({ business: { name: "x" }, ladder: { offsets: {} }, forecast: {}, finance: { borrow_rate_bps: 1400, max_discount_bps: 200 } });
    settings.check({ calendar: { quiet_days: [{ from: "2026-11-20", to: "2026-11-21", label: "Gurpurab" }] } });
    const f = await settings.save(c, ctx, { finance: { borrow_rate_bps: 1800, max_discount_bps: 300 } });
    assert.deepEqual([f.finance.borrow_rate_bps, f.finance.max_discount_bps, f.finance.treds_rate_low_bps], [1800, 300, 700]);
    for (const bad of [{ msmed: { s16_multiplier: 1 } }, { finance: { borrow_rate_bps: 7000 } }, { finance: { treds_rate_low_bps: 1 } }, { finance: { max_discount_bps: 2.5 } },
      { calendar: { festivals: [] } }, {}]) {
      assert.throws(() => settings.check(bad), { status: 400 }, JSON.stringify(bad));
    }

    // Evidence bundle and chase list.
    const letter = await byNumber(c, "INV/26-27/0042");
    const docs = await views.documents(c, ctx, letter.id);
    assert.equal(docs.chain.ok, true);
    assert.equal(docs.invoice.number, "INV/26-27/0042");
    assert.equal(docs.odr_checklist.length, 8);
    const chase = await views.chase(c, ctx);
    assert.ok(chase.every((x, i) => i === 0 || chase[i - 1].score >= x.score));

    // A link past its expiry answers 410.
    await c.query("UPDATE invoices SET pay_token_expires_at = '2026-10-01T23:59:59+05:30' WHERE id = $1", [letter.id]);
    await assert.rejects(pub.byToken(c, ctx, letter.pay_token), { status: 410 });
  });
});
