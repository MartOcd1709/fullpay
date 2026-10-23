import pg from "pg";

// Money is integer paise and must arrive as Number; dates must stay 'YYYY-MM-DD' strings (IST business dates).
pg.types.setTypeParser(20, Number); // INT8
pg.types.setTypeParser(1700, Number); // NUMERIC
pg.types.setTypeParser(1082, (v) => v); // DATE
pg.types.setTypeParser(1114, (v) => v); // TIMESTAMP
pg.types.setTypeParser(1184, (v) => v); // TIMESTAMPTZ

const g = globalThis;
export const pool =
  g.__fullpayPool ??
  (g.__fullpayPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));
if (!g.__fullpayPoolErrorHandler) {
  g.__fullpayPoolErrorHandler = true;
  pool.on("error", (err) => console.error("[pg] idle client error:", err.message));
}

export const query = (text, params) => pool.query(text, params);

export async function withTxn(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
