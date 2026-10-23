import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, withTxn } from "../lib/db.js";
import { seed, buildBankStatement } from "../db/seed.js";

// Runs before `next start` on hosts without a pre-deploy step: apply the idempotent schema,
// then load the demo data only when the database has never been seeded.
const here = dirname(fileURLToPath(import.meta.url));
try {
  await pool.query(readFileSync(join(here, "..", "db", "schema.sql"), "utf8"));
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM invoices");
  if (rows[0].n === 0) {
    const facts = await withTxn(async (client) => {
      const f = await seed(client);
      writeFileSync(join(here, "..", "db", "bank-statement.csv"), (await buildBankStatement(client)).csv);
      return f;
    });
    console.log(`bootstrap: seeded demo data (${facts.events} events)`);
  } else {
    console.log(`bootstrap: schema up to date, ${rows[0].n} invoices present`);
  }
} catch (err) {
  console.error("bootstrap failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
