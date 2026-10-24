// Festival quiet days and the settlement drive (DB parts skipped without DATABASE_URL).
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { festivalState } from "../lib/festivals.js";
import { DEFAULT_CONFIG } from "../lib/config.js";

test("drive window opens 15 days before Diwali and closes at Dhanteras; quiet days 6–10 Nov", () => {
  assert.equal(festivalState(DEFAULT_CONFIG, "2026-10-23").drive, null);
  const d = festivalState(DEFAULT_CONFIG, "2026-10-24").drive;
  assert.deepEqual([d.key, d.days_left, d.settle_by], ["diwali", 15, "2026-11-05"]);
  assert.equal(festivalState(DEFAULT_CONFIG, "2026-11-05").drive.days_left, 3);
  assert.equal(festivalState(DEFAULT_CONFIG, "2026-11-06").drive, null);
  assert.deepEqual(festivalState(DEFAULT_CONFIG, "2026-11-06").quiet, { key: "diwali", label: null, from: "2026-11-06", until: "2026-11-10", resumes: "2026-11-11" });
  assert.equal(festivalState(DEFAULT_CONFIG, "2026-11-11").quiet, null);
  const custom = { calendar: { festivals: [], quiet_days: [{ from: "2026-11-24", label: "Gurpurab" }] } };
  assert.equal(festivalState(custom, "2026-11-24").quiet.label, "Gurpurab");
});

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, festival, tickMod;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  festival = await import("../lib/services/festival.js");
  tickMod = await import("../lib/services/tick.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) { await db.withTxn((c) => seedMod.seed(c)); await db.pool.end(); } });
const at = (date, user = { uid: 1, role: "owner" }) => (fn) => ctxMod.run((c, ctx) => fn(c, { ...ctx, asOf: date, ts: `${date}T05:00:00.000Z`, user }));

test("the drive goes once to each ready customer, in their language, never to opted-out or disputed ones", { skip }, async () => {
  const v = await at("2026-10-24")((c, ctx) => festival.driveView(c, ctx));
  assert.equal(v.drive.key, "diwali");
  assert.ok(v.ready >= 5, `ready ${v.ready}`);
  assert.ok(v.customers.some((x) => x.state === "opted_out"), "the seeded opted-out customer is listed but left out");
  const ids = v.customers.filter((x) => x.state === "ready").map((x) => x.id);
  const r = await at("2026-10-24")((c, ctx) => festival.sendDrive(c, ctx, { customer_ids: ids }));
  assert.equal(r.emailed + r.whatsapp, ids.length);
  const rows = (await db.pool.query("SELECT body, lang FROM outbox WHERE rung = 'festival'")).rows;
  assert.equal(rows.length, ids.length);
  assert.ok(rows.every((x) => !/\{\{/.test(x.body)), "every placeholder filled");
  assert.ok(rows.some((x) => x.lang === "hi" && /दीपावली/.test(x.body)) || rows.every((x) => x.lang === "en"));
  assert.ok(rows.filter((x) => x.lang === "en").every((x) => /Diwali/.test(x.body) && /Dhanteras/.test(x.body)));
  const again = await at("2026-10-25")((c, ctx) => festival.driveView(c, ctx));
  assert.equal(again.ready, 0, "nobody gets it twice");
});

test("on a festival quiet day the daily run advances and sends nothing", { skip }, async () => {
  const s = await at("2026-11-07")((c, ctx) => tickMod.tick(c, ctx, { source: "test" }));
  assert.equal(s.advanced, 0);
  assert.equal(s.queued, 0);
  assert.equal(s.quiet.resumes, "2026-11-11");
});
