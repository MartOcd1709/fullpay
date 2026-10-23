// Maker-checker rules against the local database (skipped without DATABASE_URL).
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const skip = !process.env.DATABASE_URL;
let db, seedMod, ctxMod, pay, approvals, users;

before(async () => {
  if (skip) return;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  pay = await import("../lib/services/payments.js");
  approvals = await import("../lib/services/approvals.js");
  users = await import("../lib/services/users.js");
  await db.withTxn((c) => seedMod.seed(c));
});

after(async () => {
  if (skip) return;
  await db.withTxn((c) => seedMod.seed(c));
  await db.pool.end();
});

const as = (role, uid) => (fn) => ctxMod.run((c, ctx) => fn(c, Object.assign(ctx, { user: { uid, role } })));

test("an accountant's confirmation waits for the owner, then the owner's approval executes it once", { skip }, async () => {
  const team = await db.withTxn((c) => users.list(c));
  const owner = Number(team.find((u) => u.role === "owner").id);
  const accountant = Number(team.find((u) => u.role === "accountant").id);
  const csv = readFileSync(new URL("../db/bank-statement.csv", import.meta.url), "utf8");
  const imported = await as("owner", owner)((c, ctx) => pay.importCsv(c, ctx, csv));
  const target = imported.imported.find((p) => (p.proposals ?? []).length > 0) ?? imported.imported[0];

  const queued = await as("accountant", accountant)((c, ctx) => approvals.guard(c, ctx, { kind: "payment_confirm", target_id: Number(target.id), payload: {}, summary: "test", amount_paise: target.amount_paise }));
  assert.equal(queued.approval_pending, true);
  const still = await db.withTxn((c) => c.query("SELECT status FROM payments WHERE id = $1", [target.id]));
  assert.equal(still.rows[0].status, "pending", "nothing is confirmed before approval");

  await assert.rejects(
    as("accountant", accountant)((c, ctx) => approvals.guard(c, ctx, { kind: "payment_confirm", target_id: Number(target.id), payload: {}, summary: "again" })),
    { code: "approval_pending" },
    "a double click cannot queue the same action twice",
  );
  await assert.rejects(as("accountant", accountant)((c, ctx) => approvals.decide(c, ctx, Number(queued.approval.id), { approve: true })), { code: "forbidden" });

  const done = await as("owner", owner)((c, ctx) => approvals.decide(c, ctx, Number(queued.approval.id), { approve: true }));
  assert.equal(done.approval.status, "approved");
  const now = await db.withTxn((c) => c.query("SELECT status FROM payments WHERE id = $1", [target.id]));
  assert.equal(now.rows[0].status, "confirmed");
  await assert.rejects(as("owner", owner)((c, ctx) => approvals.decide(c, ctx, Number(queued.approval.id), { approve: true })), { code: "already_decided" });

  const sealed = await db.withTxn((c) => c.query("SELECT payload FROM escalation_events WHERE type = 'approval_decided' ORDER BY id DESC LIMIT 1"));
  const p = JSON.parse(sealed.rows[0].payload);
  assert.deepEqual([p.prepared_by, p.decided_by, p.status], [accountant, owner, "approved"], "the record names who prepared and who approved");
});

test("an owner acts directly; a failed action is recorded as failed, not half-applied", { skip }, async () => {
  const team = await db.withTxn((c) => users.list(c));
  const owner = Number(team.find((u) => u.role === "owner").id);
  const accountant = Number(team.find((u) => u.role === "accountant").id);
  const direct = await as("owner", owner)((c, ctx) => approvals.guard(c, ctx, { kind: "settings_save", payload: { forecast: { buffer_paise: 15000000 } }, summary: "x" }));
  assert.equal(direct.approval_pending, undefined);
  const bad = await as("accountant", accountant)((c, ctx) => approvals.guard(c, ctx, { kind: "payment_confirm", target_id: 999999, payload: {}, summary: "missing" }));
  const res = await as("owner", owner)((c, ctx) => approvals.decide(c, ctx, Number(bad.approval.id), { approve: true }));
  assert.equal(res.approval.status, "failed");
  assert.ok(res.approval.error);
});

test("team rules: at least one owner stays; emails are unique; passwords are hashed", { skip }, async () => {
  const team = await db.withTxn((c) => users.list(c));
  const owner = team.find((u) => u.role === "owner");
  await assert.rejects(db.withTxn((c) => users.update(c, {}, Number(owner.id), { role: "viewer" })), { code: "last_owner" });
  await assert.rejects(db.withTxn((c) => users.create(c, {}, { name: "X", email: owner.email, role: "viewer" })), { code: "email_taken" });
  const h = users.hashPassword("correct horse battery");
  assert.ok(users.checkHash("correct horse battery", h));
  assert.ok(!users.checkHash("wrong password!", h));
});
