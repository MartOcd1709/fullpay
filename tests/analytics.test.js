// Receivables KPIs on the seeded book (skipped without DATABASE_URL).
import test, { after } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;

after(async () => { if (!skip) (await import("../lib/db.js")).pool.end(); });

test("analytics: six months of KPIs that reconcile with the ledger", { skip }, async () => {
  const db = await import("../lib/db.js");
  const { seed } = await import("../db/seed.js");
  const { run } = await import("../lib/services/context.js");
  const an = await import("../lib/services/analytics.js");
  await db.withTxn((c) => seed(c));
  const { d, owed, allocated } = await run(async (c, ctx) => ({
    d: await an.overview(c, ctx),
    owed: Number((await c.query("SELECT coalesce(sum(GREATEST(b.outstanding_paise, 0)), 0) AS n FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id WHERE i.status <> 'draft'")).rows[0].n),
    allocated: Number((await c.query("SELECT coalesce(sum(pa.amount_paise), 0) AS n FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed'")).rows[0].n),
  }));
  assert.equal(d.months.length, 6);
  // The month containing today ends today, so its closing receivable is exactly what is owed now.
  assert.equal(d.months.at(-1).month_end, d.as_of);
  assert.equal(d.months.at(-1).receivable_paise, owed);
  for (const m of d.months) {
    assert.ok(m.dso_days == null || m.dso_days >= 0);
    assert.ok(m.cei_pct == null || (m.cei_pct >= 0 && m.cei_pct <= 100), `CEI ${m.cei_pct} in ${m.month}`);
    assert.ok(m.on_time_pct == null || (m.on_time_pct >= 0 && m.on_time_pct <= 100));
  }
  assert.ok(d.recovered.paise > 0 && d.recovered.paise <= allocated);
  assert.ok(d.at_risk.every((c) => c.grade !== "A" && c.total_owed_paise > 0));
});
