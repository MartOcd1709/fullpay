import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENESIS, canonicalize, hashEntry, appendEvent, verifyChain, loadChain, verifyEntry } from "../lib/chain.js";
import { pool, query, withTxn } from "../lib/db.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/jcs/${name}.json`, import.meta.url), "utf8");

describe("canonicalize", () => {
  for (const name of ["weird", "french"]) {
    test(`matches the JCS "${name}" vector byte for byte`, () => {
      assert.equal(canonicalize(JSON.parse(fixture(`${name}-input`))), fixture(`${name}-output`));
    });
  }

  test("sorts keys by UTF-16 code units, not numerically or by insertion order", () => {
    assert.equal(
      canonicalize({ 10: "a", 9: "b", 1: "c", b: null, a: true }),
      '{"1":"c","10":"a","9":"b","a":true,"b":null}',
    );
  });

  test("is deterministic across insertion order, nested", () => {
    const a = canonicalize({ z: [1, { y: "x", x: [] }], a: { c: 1, b: 2 } });
    const b = canonicalize({ a: { b: 2, c: 1 }, z: [1, { x: [], y: "x" }] });
    assert.equal(a, b);
    assert.equal(a, '{"a":{"b":2,"c":1},"z":[1,{"x":[],"y":"x"}]}');
  });

  test("omits undefined-valued keys like JSON.stringify", () => {
    assert.equal(canonicalize({ a: 1, b: undefined }), '{"a":1}');
  });

  test("escapes strings exactly as JSON.stringify", () => {
    const s = 'a"b\\c\n\t\u0001\u001f€😂\u007f\u0080</script>';
    assert.equal(canonicalize(s), JSON.stringify(s));
  });

  test("safe integers (and -0) serialise as plain decimals", () => {
    assert.equal(canonicalize([0, -0, 118000, -5, Number.MAX_SAFE_INTEGER]), "[0,0,118000,-5,9007199254740991]");
    assert.throws(() => canonicalize(Number.MAX_SAFE_INTEGER + 1), TypeError);
  });

  const rejected = [
    ["float", 1.5],
    ["float inside an object", { amount_paise: 10.01 }],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["Date", new Date()],
    ["undefined", undefined],
    ["undefined inside an array", [undefined]],
    ["array hole", [1, , 3]],
    ["BigInt", 10n],
    ["function", () => 1],
    ["class instance", new (class Money {})()],
    ["Map", new Map()],
    ["symbol", Symbol("s")],
  ];
  for (const [label, value] of rejected) {
    test(`${label} throws`, () => assert.throws(() => canonicalize(value), TypeError));
  }
});

describe("hashEntry / verifyChain (pure)", () => {
  test("hashEntry(GENESIS, '{}') has the pinned value", () => {
    assert.equal(GENESIS, "0".repeat(64));
    assert.equal(hashEntry(GENESIS, "{}"), "5649d09ed68c17156095d175eef152856c5b1a81c117c409c1e00f096aa6838e");
  });

  test("empty chain is intact with head GENESIS", () => {
    assert.deepEqual(verifyChain([]), { ok: true, count: 0, head: GENESIS, reason: null, breakAtId: null });
  });

  test("first row must link to GENESIS", () => {
    const prev = "a".repeat(64);
    const r = verifyChain([{ id: 7, prev_hash: prev, payload: "{}", entry_hash: hashEntry(prev, "{}") }]);
    assert.deepEqual(r, { ok: false, count: 0, head: GENESIS, reason: "chain_break", breakAtId: 7 });
  });

  test("id gaps are not a failure", () => {
    const h1 = hashEntry(GENESIS, "{}");
    const h2 = hashEntry(h1, '{"a":1}');
    const rows = [
      { id: 1, prev_hash: GENESIS, payload: "{}", entry_hash: h1 },
      { id: 9, prev_hash: h1, payload: '{"a":1}', entry_hash: h2 },
    ];
    assert.deepEqual(verifyChain(rows), { ok: true, count: 2, head: h2, reason: null, breakAtId: null });
  });
});

const TS = "2026-10-23T04:32:00.000Z";
const append = (event) => withTxn((client) => appendEvent(client, { actor: "system", ts: TS, ...event }));
const unguarded = (fn) =>
  withTxn(async (client) => {
    await client.query("ALTER TABLE escalation_events DISABLE TRIGGER USER");
    await fn(client);
    await client.query("ALTER TABLE escalation_events ENABLE TRIGGER USER");
  });
const resetEvents = () => unguarded((client) => client.query("DELETE FROM escalation_events"));

describe("chain (postgres)", { skip: !process.env.DATABASE_URL && "DATABASE_URL unset" }, () => {
  let first, second, third, customerId, invoiceId;

  before(resetEvents);
  after(async () => {
    await resetEvents();
    if (invoiceId) await query("DELETE FROM invoices WHERE id = $1", [invoiceId]);
    if (customerId) await query("DELETE FROM customers WHERE id = $1", [customerId]);
  });

  test("three appends in separate transactions form an intact chain", async () => {
    first = await append({ type: "seeded", payload: {} });
    second = await append({ type: "config_changed", payload: { keys: ["business.name"] } });
    third = await append({ type: "config_changed", payload: { keys: ["interest.bank_rate_bps"] }, run_id: "run-1" });
    assert.equal(first.prev_hash, GENESIS);
    assert.equal(first.entry_hash, hashEntry(GENESIS, "{}"));
    assert.equal(first.ts, TS);
    assert.equal(second.prev_hash, first.entry_hash);
    assert.equal(second.entry_hash, hashEntry(first.entry_hash, '{"keys":["business.name"]}'));
    assert.equal(third.prev_hash, second.entry_hash);
    assert.deepEqual(verifyChain(await loadChain(query)), {
      ok: true,
      count: 3,
      head: third.entry_hash,
      reason: null,
      breakAtId: null,
    });
  });

  test("rows are append-only at the database", async () => {
    await assert.rejects(query("UPDATE escalation_events SET payload = '{}' WHERE id = $1", [first.id]), /append-only/);
    await assert.rejects(query("DELETE FROM escalation_events WHERE id = $1", [first.id]), /append-only/);
    await assert.rejects(query("TRUNCATE escalation_events"), /append-only/);
    assert.equal((await loadChain(query)).length, 3);
  });

  test("a tampered payload is reported as hash_mismatch at that row", async () => {
    const rows = (await loadChain(query)).map((row) => ({ ...row }));
    rows[1].payload = '{"keys":["business.gstin"]}';
    assert.deepEqual(verifyChain(rows), {
      ok: false,
      count: 1,
      head: first.entry_hash,
      reason: "hash_mismatch",
      breakAtId: second.id,
    });
  });

  test("a re-linked tampered row breaks the chain at the next row", async () => {
    const rows = (await loadChain(query)).map((row) => ({ ...row }));
    rows[1].payload = '{"keys":["business.gstin"]}';
    rows[1].entry_hash = hashEntry(rows[1].prev_hash, rows[1].payload);
    const r = verifyChain(rows);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "chain_break");
    assert.equal(r.breakAtId, third.id);
  });

  test("12 concurrent appends are serialised by the advisory lock", async () => {
    const before = (await loadChain(query)).length;
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => append({ type: "rung_skipped", payload: { rung: "heads_up", i } })),
    );
    assert.equal(new Set(results.map((r) => r.entry_hash)).size, 12);
    const r = verifyChain(await loadChain(query));
    assert.equal(r.ok, true);
    assert.equal(r.count, before + 12);
  });

  test("appendEvent rejects bad input before touching the chain", async () => {
    const base = { type: "x", actor: "system", payload: {}, ts: TS };
    await assert.rejects(appendEvent(pool, base), TypeError);
    await assert.rejects(appendEvent(query, base), TypeError);
    const idle = await pool.connect();
    try {
      await assert.rejects(appendEvent(idle, base), TypeError);
    } finally {
      idle.release();
    }
    await assert.rejects(withTxn((c) => appendEvent(c, { ...base, type: undefined })), /type is required/);
    await assert.rejects(withTxn((c) => appendEvent(c, { ...base, ts: undefined })), /ts is required/);
    await assert.rejects(withTxn((c) => appendEvent(c, { ...base, payload: undefined })), /payload is required/);
    await assert.rejects(withTxn((c) => appendEvent(c, { ...base, payload: { amount_paise: 10.5 } })), TypeError);
    const r = verifyChain(await loadChain(query));
    assert.equal(r.ok, true);
    assert.equal(r.count, 15);
  });

  test("verifyEntry returns found/intact, invoice number and payee for a real hash", async () => {
    customerId = (await query("INSERT INTO customers (name, state_code) VALUES ('Chain Test Buyer', '06') RETURNING id"))
      .rows[0].id;
    invoiceId = (
      await query(
        `INSERT INTO invoices (customer_id, fy, seq, number, issue_date, due_date, place_of_supply, doc_type, status)
         VALUES ($1, '26-27', 9042, 'INV/26-27/9042', '2026-09-01', '2026-10-01', '06', 'tax_invoice', 'sent') RETURNING id`,
        [customerId],
      )
    ).rows[0].id;
    await append({
      invoice_id: invoiceId,
      type: "invoice_created",
      actor: "owner",
      payload: { payee: { vpa: "arora@upi", bank_last4: "4321" }, total_paise: 1180000 },
    });
    const letter = await append({
      invoice_id: invoiceId,
      type: "letter_generated",
      actor: "owner",
      payload: { interest_paise: 12345, include_interest: false },
    });
    assert.deepEqual(await verifyEntry(query, letter.entry_hash), {
      found: true,
      intact: true,
      event: {
        type: "letter_generated",
        invoice_id: invoiceId,
        invoice_number: "INV/26-27/9042",
        ts: TS,
        hash: letter.entry_hash,
      },
      payee: { vpa: "arora@upi", bank_last4: "4321" },
    });
  });

  test("verifyEntry works through a transaction client and without an invoice", async () => {
    const v = await withTxn((client) => verifyEntry(client, first.entry_hash));
    assert.deepEqual(v, {
      found: true,
      intact: true,
      event: { type: "seeded", invoice_id: null, invoice_number: null, ts: TS, hash: first.entry_hash },
      payee: null,
    });
  });

  test("verifyEntry reports an unknown hash as not found", async () => {
    assert.deepEqual(await verifyEntry(query, "f".repeat(64)), { found: false, intact: false, event: null, payee: null });
  });

  test("a row edited behind the trigger makes later entries not intact", async () => {
    const original = second;
    await unguarded((c) => c.query("UPDATE escalation_events SET payload = '{\"keys\":[]}' WHERE id = $1", [original.id]));
    try {
      assert.equal((await verifyEntry(query, first.entry_hash)).intact, true);
      assert.equal((await verifyEntry(query, third.entry_hash)).intact, false);
      const r = verifyChain(await loadChain(query));
      assert.equal(r.reason, "hash_mismatch");
      assert.equal(r.breakAtId, original.id);
    } finally {
      await unguarded((c) =>
        c.query("UPDATE escalation_events SET payload = $2 WHERE id = $1", [original.id, '{"keys":["business.name"]}']),
      );
    }
    assert.equal(verifyChain(await loadChain(query)).ok, true);
  });
});

after(() => pool.end());
