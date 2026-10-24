// First-run setup steps reflect what is really filled in.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, setup;
before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  setup = await import("../lib/services/setup.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => { if (!skip) await db.pool.end(); });

const stepsWith = (business) => ctxMod.run((c, ctx) => setup.steps(c, { ...ctx, cfg: { ...ctx.cfg, business: { ...ctx.cfg.business, ...business } } }));
const doneMap = (steps) => Object.fromEntries(steps.map((s) => [s.key, s.done]));

test("the seeded business has every in-app step done", { skip }, async () => {
  const d = doneMap(await stepsWith({}));
  assert.deepEqual([d.business, d.upi, d.udyam, d.customer, d.invoice], [true, true, true, true, true]);
  assert.equal(typeof d.bank, "boolean");
});

test("missing UPI ID, Udyam number or GSTIN show as still to do", { skip }, async () => {
  const d = doneMap(await stepsWith({ vpa: "", udyam_number: null, gstin: "" }));
  assert.deepEqual([d.upi, d.udyam, d.business], [false, false, false]);
  assert.equal(doneMap(await stepsWith({ gstin: "", registration: "unregistered" })).business, true, "an unregistered business needs no GSTIN");
});
