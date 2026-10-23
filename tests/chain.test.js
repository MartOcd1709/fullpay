import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENESIS, canonicalize, hashEntry, entryHash, appendEvent, verifyChain, loadChain, verifyEntry } from "../lib/chain.js";
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

  test("lone surrogates are escaped (stay distinct from U+FFFD) and U+2028 stays raw, as JCS", () => {
    assert.equal(canonicalize({ "\ud800": "\udc00", "\u2028": "\u2029" }), '{"\u2028":"\u2029","\\ud800":"\\udc00"}');
    assert.notEqual(hashEntry(GENESIS, canonicalize("\ud800")), hashEntry(GENESIS, canonicalize("\ufffd")));
    assert.equal(canonicalize(JSON.parse('{"__proto__":[1],"constructor":{}}')), '{"__proto__":[1],"constructor":{}}');
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
    const row = { id: 7, prev_hash: prev, type: "seeded", actor: "system", ts: "2026-10-23T04:32:00.000Z", payload: "{}" };
    const r = verifyChain([{ ...row, entry_hash: entryHash(row) }]);
    assert.deepEqual(r, { ok: false, count: 0, head: GENESIS, reason: "chain_break", breakAtId: 7 });
  });

  test("id gaps are not a failure", () => {
    const meta = { type: "seeded", actor: "system", ts: "2026-10-23T04:32:00.000Z" };
    const r1 = { id: 1, prev_hash: GENESIS, payload: "{}", ...meta };
    const h1 = entryHash(r1);
    const r2 = { id: 9, prev_hash: h1, payload: '{"a":1}', ...meta };
    const h2 = entryHash(r2);
    const rows = [{ ...r1, entry_hash: h1 }, { ...r2, entry_hash: h2 }];
    assert.deepEqual(verifyChain(rows), { ok: true, count: 2, head: h2, reason: null, breakAtId: null });
  });

  test("editing sealed metadata (ts, type, invoice) is detected, not just the payload", () => {
    const r1 = { id: 1, prev_hash: GENESIS, payload: "{}", type: "letter_generated", actor: "owner", invoice_id: 42, ts: "2026-10-23T04:32:00.000Z" };
    const row = { ...r1, entry_hash: entryHash(r1) };
    for (const edit of [{ ts: "2026-09-01T04:32:00.000Z" }, { type: "reminder_sent" }, { invoice_id: 41 }, { actor: "tick" }]) {
      assert.equal(verifyChain([{ ...row, ...edit }]).reason, "hash_mismatch");
    }
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

describe("chain (postgres)", { skip: !process.env.DATABASE_URL && "DATABASE_URL unset" }, () => {
  let first, second, third, customerId, invoiceId, base;

  before(async () => {
    const rows = await loadChain(query);
    base = { count: rows.length, head: verifyChain(rows).head, maxId: rows.at(-1)?.id ?? 0 };
  });
  after(async () => {
    await unguarded((c) => c.query("DELETE FROM escalation_events WHERE id > $1", [base.maxId]));
    if (invoiceId) await query("DELETE FROM invoices WHERE id = $1", [invoiceId]);
    if (customerId) await query("DELETE FROM customers WHERE id = $1", [customerId]);
  });

  test("three appends in separate transactions form an intact chain", async () => {
    first = await append({ type: "seeded", payload: {} });
    second = await append({ type: "config_changed", payload: { keys: ["business.name"] } });
    third = await append({ type: "config_changed", payload: { keys: ["interest.bank_rate_bps"] }, run_id: "run-1" });
    assert.equal(first.prev_hash, base.head);
    assert.equal(first.entry_hash, entryHash({ prev_hash: base.head, type: "seeded", actor: "system", ts: TS, payload: "{}" }));
    assert.equal(first.ts, TS);
    assert.equal(second.prev_hash, first.entry_hash);
    assert.equal(second.entry_hash, entryHash({ prev_hash: first.entry_hash, type: "config_changed", actor: "system", ts: TS, payload: '{"keys":["business.name"]}' }));
    assert.equal(third.prev_hash, second.entry_hash);
    assert.deepEqual(verifyChain(await loadChain(query)), {
      ok: true,
      count: base.count + 3,
      head: third.entry_hash,
      reason: null,
      breakAtId: null,
    });
  });

  test("rows are append-only at the database", async () => {
    await assert.rejects(query("UPDATE escalation_events SET payload = '{}' WHERE id = $1", [first.id]), /append-only/);
    await assert.rejects(query("DELETE FROM escalation_events WHERE id = $1", [first.id]), /append-only/);
    await assert.rejects(query("TRUNCATE escalation_events"), /append-only/);
    assert.equal((await loadChain(query)).length, base.count + 3);
  });

  test("a tampered payload is reported as hash_mismatch at that row", async () => {
    const rows = (await loadChain(query)).map((row) => ({ ...row }));
    rows[base.count + 1].payload = '{"keys":["business.gstin"]}';
    assert.deepEqual(verifyChain(rows), {
      ok: false,
      count: base.count + 1,
      head: first.entry_hash,
      reason: "hash_mismatch",
      breakAtId: second.id,
    });
  });

  test("a re-linked tampered row breaks the chain at the next row", async () => {
    const rows = (await loadChain(query)).map((row) => ({ ...row }));
    const row = rows[base.count + 1];
    row.payload = '{"keys":["business.gstin"]}';
    row.entry_hash = entryHash(row);
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
    const rows = await loadChain(query);
    assert.equal(new Set(rows.map((row) => row.prev_hash)).size, rows.length);
    const r = verifyChain(rows);
    assert.equal(r.ok, true);
    assert.equal(r.count, before + 12);
  });

  test("appendEvent rejects bad input before touching the chain", async () => {
    const input = { type: "x", actor: "system", payload: {}, ts: TS };
    await assert.rejects(appendEvent(pool, input), TypeError);
    await assert.rejects(appendEvent(query, input), TypeError);
    const idle = await pool.connect();
    try {
      await assert.rejects(appendEvent(idle, input), TypeError);
    } finally {
      idle.release();
    }
    await assert.rejects(withTxn((c) => appendEvent(c, { ...input, type: undefined })), /type is required/);
    await assert.rejects(withTxn((c) => appendEvent(c, { ...input, ts: undefined })), /ts is required/);
    await assert.rejects(withTxn((c) => appendEvent(c, { ...input, payload: undefined })), /payload is required/);
    await assert.rejects(withTxn((c) => appendEvent(c, { ...input, payload: { amount_paise: 10.5 } })), TypeError);
    const r = verifyChain(await loadChain(query));
    assert.equal(r.ok, true);
    assert.equal(r.count, base.count + 15);
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
      payload: { payee_vpa: "arora@upi", bank_last4: "4321", total_paise: 1180000 },
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
      event: { type: "seeded", invoice_number: null, ts: TS, hash: first.entry_hash },
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

  test("a unique_violation from a lock-bypassing writer is retried once on the new head", async () => {
    let rogue;
    const appended = await withTxn((client) => {
      const spy = Object.create(client);
      spy.query = async (text, params) => {
        const res = await client.query(text, params);
        if (!rogue && /ORDER BY id DESC/.test(text)) {
          const prev = res.rows[0].entry_hash;
          rogue = entryHash({ prev_hash: prev, type: "seeded", actor: "system", ts: TS, payload: '{"rogue":1}' });
          await query(
            `INSERT INTO escalation_events (type, actor, payload, ts, prev_hash, entry_hash)
             VALUES ('seeded', 'system', '{"rogue":1}', $1, $2, $3)`,
            [TS, prev, rogue],
          );
        }
        return res;
      };
      return appendEvent(spy, { type: "seeded", actor: "system", payload: {}, ts: TS });
    });
    assert.equal(appended.prev_hash, rogue);
    assert.equal(verifyChain(await loadChain(query)).ok, true);
  });
});

after(() => pool.end());
