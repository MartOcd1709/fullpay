// The built-in 10:00 IST schedule (skipped without DATABASE_URL).
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, sched;
before(async () => {
  if (skip) return;
  delete process.env.RESEND_API_KEY;
  process.env.MAIL_TEST_MODE = "1";
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  sched = await import("../lib/scheduler.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => {
  if (skip) return;
  await db.withTxn((c) => seedMod.seed(c));
  await db.pool.end();
});

const ist = (hh, mm = 0) => Date.UTC(2026, 9, 24, hh, mm) - 330 * 60_000; // that IST wall-clock time, as epoch ms

test("nothing before 10:00 IST; one run after; a second check the same day does nothing", { skip }, async () => {
  assert.deepEqual(await sched.checkOnce(ist(8, 0)), { skipped: "before_10" });
  const first = await sched.checkOnce(ist(10, 5));
  assert.ok(first.summary, JSON.stringify(first));
  assert.equal(first.summary.source, "scheduler");
  assert.deepEqual(await sched.checkOnce(ist(14, 0)), { skipped: "already_ran" });
  const runs = (await db.pool.query("SELECT count(*)::int AS n FROM escalation_events WHERE type = 'tick_run'")).rows[0].n;
  assert.equal(runs, 1);
});
