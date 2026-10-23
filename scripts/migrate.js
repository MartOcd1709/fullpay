import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "../lib/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("schema applied");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("migration failed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
