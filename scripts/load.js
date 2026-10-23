// HTTP load + concurrency test against a running FullPay (DEMO_MODE=1) backed by the scale database.
//   SCALE_DATABASE_URL=... node scripts/load.js http://localhost:3100 [seconds=20] [concurrency=20]
// Reads pay tokens / pending payment ids from the scale DB; never run it against the demo database.
import pg from "pg";

const [base = "http://localhost:3100", SECS = 20, CONC = 20] = process.argv.slice(2).map((v, i) => (i ? Number(v) : v));
const url = process.env.SCALE_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL) { console.error("Set SCALE_DATABASE_URL (separate database)."); process.exit(2); }
const db = new pg.Client({ connectionString: url });
await db.connect();

const login = async (as) => {
  const r = await fetch(`${base}/api/auth/demo`, { method: "POST", body: new URLSearchParams({ as }), redirect: "manual" });
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
};
const owner = await login("owner");
const tokens = (await db.query("SELECT pay_token FROM invoices WHERE pay_token IS NOT NULL AND status IN ('sent','part_paid') LIMIT 2000")).rows.map((r) => r.pay_token);

const pct = (a, p) => Math.round(a[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]);
async function soak(label, next) {
  const lat = [];
  let errors = 0, n = 0;
  const end = performance.now() + SECS * 1000;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (performance.now() < end) {
      const [path, init] = next(n++);
      const t = performance.now();
      try {
        const r = await fetch(base + path, init);
        await r.arrayBuffer();
        if (r.status >= 400) errors++;
      } catch { errors++; }
      lat.push(performance.now() - t);
    }
  }));
  lat.sort((a, b) => a - b);
  const out = { requests: lat.length, rps: Math.round(lat.length / SECS), p50_ms: pct(lat, 50), p95_ms: pct(lat, 95), p99_ms: pct(lat, 99), errors };
  console.log(label.padEnd(36), JSON.stringify(out));
  return out;
}

const results = { base, seconds: SECS, concurrency: CONC };
const H = { headers: { cookie: owner } };
results.customer_pay_pages = await soak("customers open pay links", (i) => [`/pay/${tokens[i % tokens.length]}`, {}]);
const screens = ["/dashboard", "/payments", "/invoices", "/analytics", "/followups", "/customers"];
results.owner_screens = await soak("owner screens (mixed)", (i) => [screens[i % screens.length], H]);
results.health = await soak("health check", () => ["/api/health", {}]);

// Concurrency: 20 simultaneous confirms of ONE payment → exactly one wins, the rest get 409, one allocation set.
const one = (await db.query("SELECT p.id FROM payments p WHERE p.status = 'pending' AND EXISTS (SELECT 1 FROM payment_proposals pp WHERE pp.payment_id = p.id) ORDER BY p.id LIMIT 1")).rows[0]?.id;
if (one) {
  const codes = await Promise.all(Array.from({ length: 20 }, () =>
    fetch(`${base}/api/payments/${one}/confirm`, { method: "POST", headers: { cookie: owner, "content-type": "application/json" }, body: "{}" }).then((r) => r.status)));
  const allocs = (await db.query("SELECT count(*)::int AS n FROM payment_allocations WHERE payment_id = $1", [one])).rows[0].n;
  const proposed = (await db.query("SELECT count(*)::int AS n FROM payment_proposals WHERE payment_id = $1", [one])).rows[0].n;
  results.same_payment_race = { ok: codes.filter((c) => c === 200).length, conflict: codes.filter((c) => c === 409).length, other: codes.filter((c) => c !== 200 && c !== 409).length, allocation_rows: allocs, proposed_rows: proposed };
  console.log("20 confirms of one payment".padEnd(36), JSON.stringify(results.same_payment_race));
}

// Throughput: 200 distinct pending payments confirmed by 20 parallel clients; then check no invoice is over-allocated.
const ids = (await db.query("SELECT p.id FROM payments p WHERE p.status = 'pending' AND EXISTS (SELECT 1 FROM payment_proposals pp WHERE pp.payment_id = p.id) ORDER BY p.id LIMIT 200")).rows.map((r) => r.id);
let k = 0;
const t0 = performance.now();
const tally = {};
await Promise.all(Array.from({ length: CONC }, async () => {
  while (k < ids.length) {
    const id = ids[k++];
    const r = await fetch(`${base}/api/payments/${id}/confirm`, { method: "POST", headers: { cookie: owner, "content-type": "application/json" }, body: "{}" });
    tally[r.status] = (tally[r.status] ?? 0) + 1;
  }
}));
const over = (await db.query("SELECT count(*)::int AS n FROM invoice_balances WHERE outstanding_paise < 0")).rows[0].n;
results.parallel_confirms = { payments: ids.length, seconds: +((performance.now() - t0) / 1000).toFixed(1), status_counts: tally, invoices_over_allocated: over };
console.log("200 confirms, 20 at a time".padEnd(36), JSON.stringify(results.parallel_confirms));

console.log(JSON.stringify(results));
await db.end();
