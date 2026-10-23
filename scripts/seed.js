import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, withTxn } from "../lib/db.js";
import { seed, buildBankStatement } from "../db/seed.js";

const here = dirname(fileURLToPath(import.meta.url));
try {
  const facts = await withTxn(async (client) => {
    const f = await seed(client);
    const { csv } = await buildBankStatement(client);
    writeFileSync(join(here, "..", "db", "bank-statement.csv"), csv);
    return f;
  });
  console.log(`seeded as of ${facts.anchor}: ${facts.events} events, chain head ${facts.chain_head}`);
  console.log(`letter hash (INV/26-27/0042): ${facts.letter_hash}`);
  console.log("first tick at the anchor would send:", facts.first_tick_sends);
} catch (err) {
  console.error("seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
