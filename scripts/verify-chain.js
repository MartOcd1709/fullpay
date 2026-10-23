// Re-hash the whole record (every escalation event) and report whether it is unaltered. Usage: node scripts/verify-chain.js
// Uses DATABASE_URL, or SCALE_DATABASE_URL when set.
if (process.env.SCALE_DATABASE_URL) process.env.DATABASE_URL = process.env.SCALE_DATABASE_URL;
const { pool } = await import("../lib/db.js");
const { loadChain, verifyChain } = await import("../lib/chain.js");
const t = performance.now();
const rows = await loadChain(pool);
const loaded = performance.now();
const v = verifyChain(rows);
console.log(JSON.stringify({ ...v, load_ms: Math.round(loaded - t), verify_ms: Math.round(performance.now() - loaded) }));
await pool.end();
process.exitCode = v.ok ? 0 : 1;
