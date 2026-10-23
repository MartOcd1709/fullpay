// Scale test: build a large book in a SEPARATE database through the real service layer, then time the hot paths.
//   SCALE_DATABASE_URL=postgres://fullpay@localhost:5434/fullpay_scale node scripts/scale.js [customers] [invoices] [bankLines]
// Refuses to run against DATABASE_URL. Writes docs/scale-results.json. Mail is forced into test mode.
import { readFileSync, writeFileSync } from "node:fs";

const url = process.env.SCALE_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL) {
  console.error("Set SCALE_DATABASE_URL to a separate, disposable database (never the demo one).");
  process.exit(2);
}
process.env.DATABASE_URL = url;
for (const k of ["RESEND_API_KEY", "MAIL_FROM", "MAIL_REPLY_TO"]) delete process.env[k];
process.env.MAIL_TEST_MODE = "1";

const [NC = 1000, NI = 20000, NB = 5000] = process.argv.slice(2).map(Number);
const { pool, withTxn } = await import("../lib/db.js");
const { seed, SEED_ANCHOR: ANCHOR } = await import("../db/seed.js");
const { getContext } = await import("../lib/services/context.js");
const customers = await import("../lib/services/customers.js");
const invoices = await import("../lib/services/invoices.js");
const payments = await import("../lib/services/payments.js");
const approvals = await import("../lib/services/approvals.js");
const users = await import("../lib/services/users.js");
const views = await import("../lib/services/views.js");
const followups = await import("../lib/services/followups.js");
const analytics = await import("../lib/services/analytics.js");
const { tick } = await import("../lib/services/tick.js");
const { addDays } = await import("../lib/time.js");

// Deterministic PRNG so every run builds the same book.
let s = 0x5eed;
const rnd = () => ((s = (s + 0x6d2b79f5) | 0), (((s ^ (s >>> 15)) * (s | 1)) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const ITEMS = [
  ["8708", "Brake drum assembly", "NOS", 1850, 1800], ["8483", "Drive shaft coupling", "NOS", 2400, 1800],
  ["7318", "Hex bolt M12 (box of 100)", "BOX", 950, 1800], ["9988", "Machining job work", "HRS", 1200, 500],
  ["4016", "Rubber bush kit", "SET", 640, 1800], ["7326", "Fabricated bracket", "NOS", 380, 1800],
];
const STATES = ["03", "06", "07", "08", "09", "24", "27", "29", "33"];
const results = { built_at: new Date().toISOString(), node: process.version, sizes: {}, timings_ms: {} };
const ms = (t) => Math.round(performance.now() - t);

async function time(label, fn, runs = 1) {
  const all = [];
  let out;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    out = await fn();
    all.push(performance.now() - t);
  }
  all.sort((a, b) => a - b);
  results.timings_ms[label] = runs === 1 ? Math.round(all[0]) : { median: Math.round(all[Math.floor(runs / 2)]), max: Math.round(all.at(-1)), runs };
  console.log(label.padEnd(44), JSON.stringify(results.timings_ms[label]));
  return out;
}
const ctxAt = async (c, date, user = { uid: 1, role: "owner" }) => ({ ...(await getContext(c)), asOf: date, ts: `${date}T05:30:00.000Z`, user });

// 1. Schema + the normal demo seed (config, demo team, 14 named customers).
await withTxn((c) => c.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")));
// An existing book (> 1,000 invoices) is reused: the run then measures a later day on a live book, not the first one.
const existing = Number((await pool.query("SELECT count(*) AS n FROM invoices")).rows[0].n);
const BUILD = existing < 1000;
results.mode = BUILD ? "fresh book" : "existing book (later day)";
if (BUILD) await time("seed: demo book (65 invoices, day-by-day)", () => withTxn((c) => seed(c)));

// 2. Customers: 60% prompt, 30% slow, 10% chronic.
const book = !BUILD ? [] : await time(`build: ${NC} customers`, () => withTxn(async (c) => {
  const ctx = await ctxAt(c, "2026-04-01");
  const out = [];
  for (let i = 1; i <= NC; i++) {
    const r = rnd();
    const row = await customers.create(c, ctx, {
      name: `Scale Buyer ${String(i).padStart(4, "0")} Pvt Ltd`, gstin: null, state_code: pick(STATES),
      email: `buyer${i}@scale.example`, phone: `+91 98${String(10000000 + i).slice(-8)}`, credit_days: pick([15, 30, 30, 45]),
    });
    out.push({ id: row.id, credit: row.credit_days ?? 15, kind: r < 0.6 ? "prompt" : r < 0.9 ? "slow" : "chronic" });
  }
  return out;
}));

// 3. Invoices through createDraft + send, issue dates over the 200 days before the anchor, committed in batches of 500.
const issued = [];
if (BUILD) await time(`build: ${NI} invoices (draft + send)`, async () => {
  for (let b = 0; b < NI; b += 500) {
    await withTxn(async (c) => {
      for (let i = b; i < Math.min(NI, b + 500); i++) {
        const cu = pick(book);
        const issue = addDays(ANCHOR, -int(1, 200));
        const ctx = await ctxAt(c, issue);
        const items = Array.from({ length: int(1, 3) }, () => {
          const [hsn_sac, description, unit, rate, gst_bps] = pick(ITEMS);
          return { hsn_sac, description, unit, gst_bps, rate_paise: rate * 100, qty_milli: int(1, 40) * 1000 };
        });
        const d = await invoices.createDraft(c, ctx, { customer_id: cu.id, issue_date: issue, items });
        const sent = await invoices.send(c, ctx, d.id);
        issued.push({ id: sent.id, number: sent.number, due: sent.due_date, total: sent.total_paise, cu });
      }
    });
  }
});

// 4. Payments by behaviour, only those dated before the anchor; ~5% part payments.
let paidCount = 0;
if (BUILD) await time("build: payments (manual + confirm)", async () => {
  for (let b = 0; b < issued.length; b += 500) {
    await withTxn(async (c) => {
      for (const inv of issued.slice(b, b + 500)) {
        const k = inv.cu.kind;
        if ((k === "slow" && rnd() < 0.15) || (k === "chronic" && rnd() < 0.5)) continue;
        const late = k === "prompt" ? int(-5, 5) : k === "slow" ? int(10, 60) : int(40, 90);
        const on = addDays(inv.due, late);
        if (on >= ANCHOR) continue;
        const ctx = await ctxAt(c, on);
        const part = rnd() < 0.05;
        const p = await payments.addManual(c, ctx, { invoice_id: inv.id, paid_on: on, amount_paise: part ? Math.round(inv.total / 2) : inv.total, reference: `NEFT S${inv.id}` });
        await payments.confirm(c, ctx, p.id);
        paidCount++;
      }
    });
  }
});

const counts = async () => (await pool.query(
  `SELECT (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM invoices) AS invoices,
          (SELECT count(*) FROM invoices WHERE status IN ('sent','part_paid')) AS open_invoices,
          (SELECT count(*) FROM payments) AS payments, (SELECT count(*) FROM escalation_events) AS chain_events,
          (SELECT count(*) FROM outbox) AS outbox, pg_size_pretty(pg_database_size(current_database())) AS db_size`,
)).rows[0];
results.sizes.after_build = await counts();
console.log("book:", results.sizes.after_build);

// 5. The daily run over the whole book (first run = worst case: every overdue invoice is evaluated at once).
results.tick = await time("tick: daily run over the whole book", () => withTxn(async (c) => {
  const r = await tick(c, await ctxAt(c, BUILD ? ANCHOR : addDays(ANCHOR, 1)), { source: "manual" });
  return { evaluated: r.evaluated, advanced: r.advanced, queued: r.queued, letters: r.letters, skipped: r.skipped };
}));
console.log("tick:", results.tick);

// 6. Bank statement import: NB credits — 70% quote an open invoice number, 20% only the buyer's name, 10% noise.
const open = (await pool.query(
  `SELECT i.id, i.number, b.outstanding_paise, c.name FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
   JOIN customers c ON c.id = i.customer_id WHERE i.status IN ('sent','part_paid') AND b.outstanding_paise > 0`,
)).rows;
const fmt = (p) => (p / 100).toFixed(2);
const dd = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
// Each statement walks a shuffled copy of the open invoices, so a credit settles a distinct invoice until the list wraps.
function statement(n, salt) {
  const lines = ["Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance"];
  const deck = open.map((v) => [rnd(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    const inv = deck[i % deck.length];
    const day = dd(addDays(ANCHOR, -int(1, 20)));
    const ref = `UTR${salt}${String(i).padStart(7, "0")}`;
    const nar = r < 0.7 ? `NEFT CR-${inv.name.toUpperCase()}-${inv.number}` : r < 0.9 ? `IMPS-${inv.name.toUpperCase()}` : `UPI-RANDOM PAYER ${i}`;
    lines.push(`${day},"${nar}",${ref},${day},0.00,${fmt(r < 0.9 ? inv.outstanding_paise : int(100, 50000) * 100)},0.00`);
  }
  return lines.join("\n");
}
const files = {};
const run = BUILD ? "" : String(Date.now() % 1e6);
for (const [n, salt] of [[NB, `A${run}`], [Math.min(15000, NB * 3), `B${run}`]]) {
  const csv = (files[salt] = statement(n, salt));
  const r = await time(`import: bank CSV ${n} lines (${(csv.length / 1e6).toFixed(1)} MB)`, () => withTxn(async (c) => payments.importCsv(c, await ctxAt(c, ANCHOR), csv)));
  results[`import_${n}`] = { imported: r.imported.length, skipped: r.skipped.length, duplicates: r.duplicates_skipped };
  console.log("  ->", results[`import_${n}`]);
}
const dup = await time(`import: same ${NB}-line file again (idempotent)`, () => withTxn(async (c) => payments.importCsv(c, await ctxAt(c, ANCHOR), files[`A${run}`])));
results.reimport = { imported: dup.imported.length, duplicates: dup.duplicates_skipped };
console.log("  ->", results.reimport);

// 7. Screens: each read 5 times, median reported.
const read = (label, fn) => time(`read: ${label}`, () => withTxn(async (c) => fn(c, await ctxAt(c, ANCHOR))), 5);
await read("dashboard", (c, x) => views.dashboard(c, x));
await read("invoices list (all)", (c, x) => invoices.list(c, x, {}));
await read("customers with reliability", (c, x) => customers.listWithReliability(c, x));
await read("follow-ups today", (c, x) => followups.listToday(c, x));
await read("payments screen", (c, x) => followups.paymentsView(c, x));
await read("chase-first", (c, x) => followups.chaseView(c, x));
await read("forecast", (c, x) => followups.forecastView(c, x));
await read("analytics", (c, x) => analytics.overview(c, x));
const common = await import("../lib/services/common.js");
await read("dashboard interest total (all overdue)", async (c, x) => {
  const { rows } = await c.query(`${common.INVOICE_SELECT} WHERE i.status IN ('sent','part_paid','disputed') AND b.outstanding_paise > 0 AND i.due_date < $1`, [x.asOf]);
  const inputs = await common.interestInputsMany(c, rows.map((r) => r.id));
  let total = 0;
  for (const inv of rows) total += common.interestFor(x.cfg, inv, inputs.get(Number(inv.id)), x.asOf)?.total_interest_paise ?? 0;
  return total;
});
await read("invoice detail (one)", (c, x) => invoices.get(c, x, issued[0]?.id ?? 1));
results.exact_before = (await withTxn((c) => approvals.exactMatches(c, {})));
results.confirm_exact = await time("payments: owner confirms all exact matches", () => withTxn(async (c) => approvals.confirmExact(c, await ctxAt(c, ANCHOR), {})));
console.log("exact:", results.exact_before, results.confirm_exact);

// 8. Maker-checker at volume: the accountant queues 500 confirmations, the owner bulk-approves them in one go.
const team = await withTxn((c) => users.list(c));
const acct = team.find((u) => u.role === "accountant");
const pend = (await pool.query("SELECT id FROM payments WHERE status = 'pending' ORDER BY id LIMIT 500")).rows.map((r) => Number(r.id));
await time(`approvals: accountant queues ${pend.length}`, () => withTxn(async (c) => {
  const ctx = await ctxAt(c, ANCHOR, { uid: Number(acct.id), role: "accountant" });
  for (const id of pend) await approvals.guard(c, ctx, { kind: "payment_confirm", target_id: id, payload: {}, summary: `Confirm payment ${id}` });
}));
const ids = (await pool.query("SELECT id FROM approvals WHERE status = 'pending' ORDER BY id")).rows.map((r) => Number(r.id));
results.bulk = await time(`approvals: owner bulk-approves ${ids.length}`, () => withTxn(async (c) => {
  const r = await approvals.decideMany(c, await ctxAt(c, ANCHOR), ids, { approve: true });
  return { approved: r.approved, failed: r.failed };
}));
console.log("bulk:", results.bulk);

results.sizes.final = await counts();
console.log("final:", results.sizes.final);
writeFileSync(new URL("../docs/scale-results.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
await pool.end();
