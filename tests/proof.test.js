// /proof runs the pack's final checks live; on the seeded demo every one must pass (skipped without DATABASE_URL).
import test, { after } from "node:test";
import assert from "node:assert/strict";

const skip = !process.env.DATABASE_URL;
after(async () => { if (!skip) (await import("../lib/db.js")).pool.end(); });

test("proof: every pack check passes on the seeded demo, with the sample statement loaded", { skip }, async () => {
  const db = await import("../lib/db.js");
  const { seed } = await import("../db/seed.js");
  const { run } = await import("../lib/services/context.js");
  const proof = await import("../lib/services/proof.js");
  const { readFileSync } = await import("node:fs");
  const payments = await import("../lib/services/payments.js");
  await db.withTxn((c) => seed(c));
  await run((c, ctx) => payments.importCsv(c, ctx, readFileSync(new URL("../db/bank-statement.csv", import.meta.url), "utf8")));
  const d = await run((c, ctx) => proof.run(c, ctx));
  const failed = d.sections.flatMap((s) => s.rows.filter((r) => !r.pass).map((r) => `${s.key}.${r.key}: expected ${r.expected}, got ${r.actual}`));
  assert.deepEqual(failed, []);
  assert.ok(d.total >= 30);
  await db.withTxn((c) => seed(c));
});
