import { createHash } from "node:crypto";
import pg from "pg";

export const GENESIS = "0".repeat(64);

const TS_ISO = `to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ts`;

// RFC 8785 (JCS) output on the null/boolean/safe-integer/string/array/plain-object domain; floats, BigInt, Date etc. throw instead of serialising.
export function canonicalize(value) {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return String(value);
    case "number":
      if (Number.isSafeInteger(value)) return String(value);
      break;
    case "string":
      return JSON.stringify(value);
    case "object":
      if (Array.isArray(value)) return canonicalizeArray(value);
      if (isPlainObject(value)) return canonicalizeObject(value);
      break;
  }
  throw new TypeError(`canonicalize: unsupported value (${kindOf(value)}); money must be integer paise`);
}

function canonicalizeArray(items) {
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i++) out[i] = canonicalize(items[i]);
  return `[${out.join(",")}]`;
}

function canonicalizeObject(obj) {
  const parts = [];
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) parts.push(`${JSON.stringify(key)}:${canonicalize(obj[key])}`);
  }
  return `{${parts.join(",")}}`;
}

function isPlainObject(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function kindOf(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "number") return `number ${value}`;
  if (typeof value === "object") return value.constructor?.name ?? "object";
  return typeof value;
}

export function hashEntry(prevHash, payloadText) {
  return createHash("sha256").update(`${prevHash}\n${payloadText}`).digest("hex");
}

export async function appendEvent(client, { invoice_id = null, type, actor, payload, run_id = null, ts }) {
  assertTxnClient(client);
  if (typeof type !== "string" || type === "") throw new TypeError("appendEvent: type is required");
  if (typeof actor !== "string" || actor === "") throw new TypeError("appendEvent: actor is required");
  if (payload === undefined) throw new TypeError("appendEvent: payload is required (use {} for none)");
  if (!ts) throw new TypeError("appendEvent: ts is required");
  const payloadText = canonicalize(payload);
  await client.query("SELECT pg_advisory_xact_lock(42)");
  const head = await client.query("SELECT entry_hash FROM escalation_events ORDER BY id DESC LIMIT 1");
  const prev_hash = head.rows[0]?.entry_hash ?? GENESIS;
  const entry_hash = hashEntry(prev_hash, payloadText);
  const { rows } = await client.query(
    `INSERT INTO escalation_events (invoice_id, type, actor, payload, run_id, ts, prev_hash, entry_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, prev_hash, entry_hash, ${TS_ISO}`,
    [invoice_id, type, actor, payloadText, run_id, ts, prev_hash, entry_hash],
  );
  return rows[0];
}

function assertTxnClient(client) {
  const autocommit = client?._txStatus === "I"; // pg Client ReadyForQuery status: I idle, T in transaction, E failed
  if (client instanceof pg.Pool || typeof client?.query !== "function" || autocommit) {
    throw new TypeError("appendEvent: client must be a pg client inside a transaction (use withTxn)");
  }
}

export function verifyChain(rows) {
  let head = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.prev_hash !== head) return { ok: false, count: i, head, reason: "chain_break", breakAtId: row.id };
    if (hashEntry(row.prev_hash, row.payload) !== row.entry_hash) {
      return { ok: false, count: i, head, reason: "hash_mismatch", breakAtId: row.id };
    }
    head = row.entry_hash;
  }
  return { ok: true, count: rows.length, head, reason: null, breakAtId: null };
}

const runner = (queryable) =>
  typeof queryable === "function" ? queryable : (text, params) => queryable.query(text, params);

export async function loadChain(query) {
  const { rows } = await runner(query)(
    `SELECT id, invoice_id, type, actor, payload, run_id, prev_hash, entry_hash, ${TS_ISO}
     FROM escalation_events ORDER BY id`,
  );
  return rows;
}

export async function verifyEntry(queryable, entry_hash) {
  const run = runner(queryable);
  const rows = await loadChain(run); // ponytail: whole-chain walk per verify; fine at demo scale, bound it by id past ~1e5 rows
  const at = rows.findIndex((row) => row.entry_hash === entry_hash);
  if (at < 0) return { found: false, intact: false, event: null, payee: null };
  const row = rows[at];
  return {
    found: true,
    intact: verifyChain(rows.slice(0, at + 1)).ok,
    event: {
      type: row.type,
      invoice_id: row.invoice_id,
      invoice_number: await invoiceNumber(run, row.invoice_id),
      ts: row.ts,
      hash: row.entry_hash,
    },
    payee: payeeOf(rows, row.invoice_id),
  };
}

async function invoiceNumber(run, invoiceId) {
  if (invoiceId === null) return null;
  const { rows } = await run("SELECT number FROM invoices WHERE id = $1", [invoiceId]);
  return rows[0]?.number ?? null;
}

function payeeOf(rows, invoiceId) {
  if (invoiceId === null) return null;
  const created = rows.find((row) => row.invoice_id === invoiceId && row.type === "invoice_created");
  const payee = created ? parsePayload(created.payload)?.payee : null;
  if (!payee || typeof payee !== "object") return null;
  const { vpa = null, bank_last4 = null } = payee;
  return vpa === null && bank_last4 === null ? null : { vpa, bank_last4 };
}

function parsePayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
