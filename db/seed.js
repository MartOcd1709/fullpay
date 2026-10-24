// Deterministic demo seed for Arora Auto Components (Ludhiana, PB). No randomness, no wall clock:
// every date and event timestamp derives from the anchor, so every reseed yields the same chain hashes.
// seed(client) expects to run inside the caller's transaction (scripts/seed.js and /api/reseed use withTxn).
import { createHash } from "node:crypto";
import { computeGSTINCheckDigit } from "../lib/gst.js";
import { verifyChain, loadChain } from "../lib/chain.js";
import { addDays, daysBetween, initTime, today } from "../lib/time.js";
import { DEFAULT_CONFIG, mergeConfig } from "../lib/config.js";
import * as customers from "../lib/services/customers.js";
import * as invoices from "../lib/services/invoices.js";
import * as payments from "../lib/services/payments.js";
import * as pub from "../lib/services/public.js";
import { evaluateAll, applyAdvance } from "../lib/services/rungs.js";
import { ensureDemoTeam } from "../lib/services/users.js";

export const SEED_ANCHOR = "2026-10-24";
// entry_hash of INV/26-27/0042's letter_generated event. Any change to seeded data or to an engine that feeds a payload moves it.
export const SEED_LETTER_HASH = "49bf667d23b5510509538231f1a7160ca62e482dc3c6f2318f4fa45cb475fca0";
export const LETTER_INVOICE = "INV/26-27/0042";
const HISTORY_START = "2026-04-01";

const TABLES = [
  "outbox", "payment_proposals", "payment_allocations", "payments", "promises", "credit_notes", "inbox_items",
  "escalation_events", "invoice_items", "invoices", "expenses", "customers", "config",
];

const gstin = (state, pan) => `${state}${pan}1Z${computeGSTINCheckDigit(`${state}${pan}1Z`)}`;

// segment -> catalogue lines [hsn, description, unit, rate_rupees, gst_bps]
const CATALOGUE = {
  tractor: [["4011", "Tractor rear tyre 13.6-28", "NOS", 18500, 1800], ["8483", "Propeller shaft assembly", "NOS", 6200, 1800], ["8708", "Clutch plate 280 mm", "NOS", 1850, 1800], ["8421", "Oil filter element", "NOS", 320, 1800]],
  fleet: [["8708", "Brake drum assembly", "NOS", 2450, 1800], ["8507", "Battery 12V 88Ah", "NOS", 7800, 1800], ["8511", "Ignition coil", "NOS", 960, 1800], ["4016", "Rubber bush kit", "SET", 540, 1800]],
  engineering: [["8483", "Ball bearing 6205-2RS", "NOS", 185, 1800], ["7318", "Hex bolt M12 x 50 (box of 100)", "BOX", 1400, 1800], ["9026", "Oil pressure gauge", "NOS", 1250, 1800], ["4016", "Rubber bush kit", "SET", 540, 1800]],
  spares: [["8708", "Brake drum assembly", "NOS", 2450, 1800], ["8708", "Clutch plate 280 mm", "NOS", 1850, 1800], ["8511", "Ignition coil", "NOS", 960, 1800], ["8421", "Oil filter element", "NOS", 320, 1800]],
  cycles: [["8714", "Bicycle chain wheel set", "SET", 420, 500], ["8714", "Bicycle hub (pair)", "PAR", 380, 500], ["8507", "Battery 12V 35Ah", "NOS", 3900, 1800]],
  garage: [["8421", "Oil filter element", "NOS", 320, 1800], ["8511", "Ignition coil", "NOS", 960, 1800], ["7318", "Hex bolt M12 x 50 (box of 100)", "BOX", 1400, 1800]],
};

// 14 made-up customers. Archetypes: A prompt (c1 c2 c6 c11 c14), C chronic late (c3 c4), disputer (c5), TDS 2% (c6),
// Haryana / IGST (c7), unregistered (c8), NULL credit terms => statutory 15 days (c9), opted out of reminders (c12).
export const CUSTOMERS = [
  { key: "c1", name: "Bhatia Tractors Pvt Ltd", pan: "AABCB4821K", state: "03", credit: 30, seg: "tractor", address: "G.T. Road, Dhandari Kalan, Ludhiana 141014", archetype: "prompt payer (A); bank-statement exact payment" },
  { key: "c2", name: "Sandhu Engineering Works", pan: "AAKFS6123M", state: "03", credit: 30, seg: "engineering", address: "Phase 7, Focal Point, Ludhiana 141010", archetype: "prompt payer (A); one payment for two invoices" },
  { key: "c3", name: "Garewal Motors", pan: "AAJFG2290Q", state: "03", credit: 30, seg: "spares", address: "Bus Stand Road, Jagraon 142026", archetype: "chronic late (C); owns INV/26-27/0042 (demand letter)" },
  { key: "c4", lang: "hi", name: "Rana Transport Company", pan: "AAHFR7715D", state: "03", credit: 30, seg: "fleet", address: "Transport Nagar, Ludhiana 141003", archetype: "chronic late (C); broke a promise; ODR rung" },
  { key: "c5", name: "Malhotra Auto Spares", pan: "AAPFM3348H", state: "03", credit: 30, seg: "spares", address: "Gill Road, Ludhiana 141006", archetype: "disputer (B); the one disputed invoice" },
  { key: "c6", name: "Kohli Fleet Services Pvt Ltd", pan: "AACCK9031R", state: "03", credit: 30, seg: "fleet", address: "Ferozepur Road, Ludhiana 141012", archetype: "TDS deductor, pays total minus 2% of taxable (A)" },
  { key: "c7", lang: "hi", name: "Yadav Agro Implements", pan: "AAGFY5562L", state: "06", credit: 45, seg: "tractor", address: "Industrial Area, Karnal, Haryana 132001", archetype: "Haryana buyer, IGST (B)" },
  { key: "c8", lang: "hi", name: "Gill Repair Garage", pan: null, state: "03", credit: 15, seg: "garage", address: "Main Bazaar, Khanna 141401", archetype: "unregistered buyer, no GSTIN (B)" },
  { key: "c9", name: "Dhillon Cycles", pan: "AAQFD1184C", state: "03", credit: null, seg: "cycles", address: "Cycle Market, Miller Ganj, Ludhiana 141003", archetype: "no written credit terms => 15 days statutory (B); 5% GST items" },
  { key: "c10", name: "Mehta Commercial Vehicles", pan: "AAECM4470P", state: "03", credit: 30, seg: "fleet", address: "Chandigarh Road, Ludhiana 141010", archetype: "mostly on time (B); part payment; due+29 crosses the letter rung on T0+1" },
  { key: "c11", name: "Chawla Rubber Udyog", pan: "AALFC8806G", state: "03", credit: 30, seg: "engineering", address: "Industrial Area-B, Ludhiana 141003", archetype: "prompt payer (A)" },
  { key: "c12", name: "Bajwa Logistics", pan: "AAMFB2651T", state: "03", credit: 30, seg: "fleet", address: "Dhandari Khurd, Ludhiana 141014", archetype: "opted out of reminders (B)" },
  { key: "c13", name: "Saini Body Builders", pan: "AANFS7393E", state: "03", credit: 30, seg: "engineering", address: "Sahnewal Road, Ludhiana 141120", archetype: "mixed (B); bank-statement overpayment" },
  { key: "c14", lang: "hi", name: "Kang Agro Industries", pan: "AACCK1958B", state: "03", credit: 30, seg: "tractor", address: "Samrala Road, Ludhiana 141008", archetype: "prompt payer (A)" },
];

// Invoice plan. rel = days relative to the due date. pay: [[rel, rupees | 'full']]; tds: rel (pays total - 2% of taxable,
// then books the TDS certificate the same day); promise: [madeRel, promisedRel]; dispute: [rel, reason]; claim: [rel, ref].
const P = (key, cust, issue, rs, plan = {}) => ({ key, cust, issue, rs, ...plan });
const PLAN = [
  P("H1", "c1", "2026-04-03", 95000, { pay: [[-2, "full"]] }),
  P("H2", "c3", "2026-04-06", 62000, { pay: [[45, "full"]] }),
  P("H3", "c2", "2026-04-09", 48000, { pay: [[-1, "full"]] }),
  P("H4", "c4", "2026-04-13", 88000, { pay: [[40, "full"]] }),
  P("H5", "c6", "2026-04-16", 76000, { tds: -1 }),
  P("H6", "c5", "2026-04-20", 41000, { pay: [[-1, "full"]] }),
  P("H7", "c10", "2026-04-23", 67000, { pay: [[0, "full"]] }),
  P("H8", "c7", "2026-04-27", 120000, { pay: [[0, "full"]] }),
  P("H9", "c11", "2026-05-02", 39000, { pay: [[-2, "full"]] }),
  P("H10", "c14", "2026-05-06", 84000, { pay: [[0, "full"]] }),
  P("H11", "c9", "2026-05-09", 26000, { pay: [[0, "full"]] }),
  P("H12", "c13", "2026-05-13", 45000, { pay: [[0, "full"]] }),
  P("H13", "c12", "2026-05-16", 58000, { pay: [[0, "full"]] }),
  P("H14", "c8", "2026-05-20", 14000, { pay: [[0, "full"]] }),
  P("H15", "c1", "2026-05-25", 110000, { pay: [[-2, "full"]] }),
  P("H16", "c3", "2026-05-29", 71000, { pay: [[47, "full"]] }),
  P("H17", "c4", "2026-06-02", 93000, { pay: [[39, "full"]] }),
  P("H18", "c2", "2026-06-08", 52000, { pay: [[-1, "full"]] }),
  P("H19", "c6", "2026-06-12", 81000, { tds: -1 }),
  P("H20", "c10", "2026-06-17", 64000, { pay: [[0, "full"]] }),
  // ---- the four months before the anchor ----
  P("W1", "c4", "2026-06-24", 140000, { pay: [[48, 50000]] }),
  P("W2", "c11", "2026-06-24", 44000, { pay: [[-1, "full"]] }),
  P("W3", "c5", "2026-06-26", 52000, { pay: [[11, "full"]] }),
  P("W4", "c1", "2026-06-30", 105000, { pay: [[-2, "full"]] }),
  P("W5", "c9", "2026-07-02", 23000, { pay: [[4, "full"]] }),
  P("W6", "c14", "2026-07-04", 91000, { pay: [[0, "full"]] }),
  P("W7", "c13", "2026-07-07", 47000, { pay: [[13, "full"]] }),
  P("W8", "c3", "2026-07-10", 78000),
  P("W9", "c7", "2026-07-13", 135000, { pay: [[0, "full"]] }),
  P("W10", "c2", "2026-07-15", 57000, { pay: [[-1, "full"]] }),
  P("W11", "c6", "2026-07-18", 86000, { tds: -1 }),
  P("W12", "c10", "2026-07-21", 69000, { pay: [[0, "full"]] }),
  P("W13", "c8", "2026-07-23", 16000, { pay: [[9, "full"]] }),
  P("W14", "c12", "2026-07-25", 61000, { pay: [[0, "full"]] }),
  P("W15", "c4", "2026-07-28", 97000, { promise: [34, 41] }),
  P("W16", "c11", "2026-07-30", 42000, { pay: [[-1, "full"]] }),
  P("W17", "c5", "2026-08-01", 49000, { pay: [[0, "full"]] }),
  P("W18", "c1", "2026-08-03", 99000, { pay: [[-1, "full"]] }),
  P("W19", "c9", "2026-08-05", 24000, { pay: [[0, "full"]] }),
  P("W20", "c14", "2026-08-07", 88000, { pay: [[0, "full"]] }),
  P("W21", "c13", "2026-08-10", 46000, { pay: [[0, "full"]] }),
  P("W22", "c3", "2026-08-20", 100000), // => INV/26-27/0042, demand letter on due+30
  P("W23", "c7", "2026-08-22", 128000, { promise: [16, 23] }),
  P("W24", "c10", "2026-08-26", 72000), // due+29 at the anchor: crosses the letter rung on T0+1
  P("W25", "c2", "2026-08-28", 55000, { pay: [[-1, "full"]] }),
  P("W26", "c6", "2026-08-31", 83000, { tds: -1 }),
  P("W28", "c5", "2026-09-04", 54000, { dispute: [4, "The brake drums are billed at a higher rate than our purchase order. Please correct the rate before we pay."] }),
  P("W29", "c12", "2026-09-07", 63000),
  P("Wa", "c7", "2026-09-12", 118000), // heads-up falls on the anchor
  P("W32", "c9", "2026-09-14", 27000, { pay: [[6, 10000]] }),
  P("W33", "c4", "2026-09-16", 90000, { promise: [4, 8] }), // promise for the anchor day: breaks on T0+1
  P("W34", "c13", "2026-09-18", 48000), // bank statement: overpayment
  P("W35", "c3", "2026-09-21", 74000, { claim: [2, "CHQ 004512"] }),
  P("W36", "c10", "2026-09-23", 70000), // bank statement: part payment
  P("Wb", "c14", "2026-09-27", 86000), // heads-up falls on the anchor
  P("W38", "c11", "2026-09-28", 43000),
  P("W39", "c2", "2026-09-30", 56000), // bank statement: one payment for two invoices (with W43)
  P("W40", "c6", "2026-10-01", 84000), // bank statement: TDS 2% short
  P("W42", "c1", "2026-10-05", 102000), // bank statement: exact
  P("W43", "c2", "2026-10-06", 51000),
  P("W45", "c9", "2026-10-09", 25000), // due on the anchor
  P("W48", "c4", "2026-10-15", 95000),
  P("W49", "c3", "2026-10-16", 76000),
  P("W51", "c8", "2026-10-19", 15000),
];
const DRAFT = P("D1", "c2", "2026-10-23", 53000);

// Anchor-relative expenses. Monthly ones repeat from their first due date (forecast expands them).
const EXPENSES = [
  ["salaries", "Salaries (8 staff + 3 helpers)", 260000, "2026-04-01", "monthly"],
  ["rent", "Factory shed rent, Focal Point", 45000, "2026-04-05", "monthly"],
  ["electricity", "PSPCL electricity", 42000, "2026-04-12", "monthly"],
  ["gst", "GST payment (GSTR-3B)", 160000, "2026-04-20", "monthly"],
  ["supplier", "Punjab Steel Traders: HR coil", 480000, "2026-10-29", null],
  ["supplier", "Ludhiana Castings: brake drum castings", 650000, "2026-11-03", null],
  ["supplier", "Sri Ganesh Rubber: rubber compound", 570000, "2026-11-17", null],
  ["supplier", "Punjab Steel Traders: September bill", 410000, "2026-09-28", null, true],
];

const pad = (n, w = 2) => String(n).padStart(w, "0");
const token = (key) => createHash("sha256").update(`fullpay-seed-token:${key}`).digest("base64url").slice(0, 32);

// Event clock for one day: 10:00 IST (04:30Z) for the tick, 12:00 IST (06:30Z) onward for people, one second apart.
function clock(date, startMinutesUtc) {
  let n = 0;
  return () => {
    const s = startMinutesUtc * 60 + n++;
    return `${date}T${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}.000Z`;
  };
}
const ctxFor = (cfg, date, minutes = 390) => ({ cfg, asOf: date, ts: clock(date, minutes), run_id: null });

function itemsFor(seg, rs, k) {
  const L = CATALOGUE[seg];
  const lines = [L[k % L.length], L[(k + 1) % L.length]];
  return lines.map(([hsn_sac, description, unit, rate, gst_bps], i) => ({
    description,
    hsn_sac,
    unit,
    gst_bps,
    rate_paise: rate * 100,
    qty_milli: Math.max(1, Math.round((rs * (i === 0 ? 0.65 : 0.35)) / rate)) * 1000,
  }));
}

export async function seed(client, { anchor = SEED_ANCHOR } = {}) {
  if (anchor !== SEED_ANCHOR) throw new RangeError(`the seed plan is pinned to ${SEED_ANCHOR}`);
  await client.query("ALTER TABLE escalation_events DISABLE TRIGGER USER");
  await client.query(`TRUNCATE ${TABLES.join(", ")}, approvals, activity RESTART IDENTITY CASCADE`);
  await client.query("ALTER TABLE escalation_events ENABLE TRIGGER USER");

  // The seeded world is pinned to the anchor, but the app clock then moves with the real calendar from the reseed day,
  // so each day's scheduled run finds new rungs to fire; the nightly reseed resets it. The pinned letter hash is unaffected.
  initTime();
  const overrides = { demo: { clock_date: null, offset_days: daysBetween(today(), anchor), t0: anchor } };
  await client.query("INSERT INTO config (id, data, updated_at) VALUES (1, $1::jsonb, $2)", [JSON.stringify(overrides), `${anchor}T04:00:00.000Z`]);
  const cfg = mergeConfig(DEFAULT_CONFIG, overrides);

  const cust = {};
  const c0 = ctxFor(cfg, HISTORY_START, 180);
  for (const c of CUSTOMERS) {
    const n = Number(c.key.slice(1));
    const row = await customers.create(client, c0, {
      name: c.name,
      gstin: c.pan ? gstin(c.state, c.pan) : null,
      state_code: c.state,
      address: c.address,
      email: `demo+c${pad(n)}@example.in`,
      phone: `+91 90000 000${pad(n)}`,
      credit_days: c.credit,
      preferred_lang: c.lang ?? "en", // four customers read their reminders in Hindi
    });
    cust[c.key] = row;
  }
  for (const [category, description, rupees, due_on, recurring, paid] of EXPENSES) {
    await client.query("INSERT INTO expenses (category, description, amount_paise, due_on, recurring, paid) VALUES ($1,$2,$3,$4,$5,$6)", [
      category, description, rupees * 100, due_on, recurring, paid === true,
    ]);
  }

  // Build the day-by-day action list from the plan.
  const actions = new Map(); // date -> [fn]
  const at = (date, fn) => actions.set(date, [...(actions.get(date) ?? []), fn]);
  const ids = {};
  const dueOf = (p) => addDays(p.issue, Math.min(cust[p.cust].credit_days ?? 15, 45));
  PLAN.forEach((p, k) => {
    const c = CUSTOMERS.find((x) => x.key === p.cust);
    at(p.issue, async (ctx) => {
      const draft = await invoices.createDraft(client, ctx, { customer_id: cust[p.cust].id, issue_date: p.issue, items: itemsFor(c.seg, p.rs, k) });
      const sent = await invoices.send(client, ctx, draft.id, { token: token(p.key) });
      ids[p.key] = sent.id;
    });
    const due = dueOf(p);
    for (const [rel, amount] of p.pay ?? []) {
      at(addDays(due, rel), async (ctx) => {
        const inv = await invoices.get(client, ctx, ids[p.key]);
        const amount_paise = amount === "full" ? inv.outstanding_paise : amount * 100;
        const pay = await payments.addManual(client, ctx, { invoice_id: inv.id, paid_on: ctx.asOf, amount_paise, reference: `NEFT ${p.key}`, narration: `NEFT CR ${c.name.toUpperCase()} ${inv.number}` });
        await payments.confirm(client, ctx, pay.id);
      });
    }
    if (p.tds != null) {
      at(addDays(due, p.tds), async (ctx) => {
        const inv = await invoices.get(client, ctx, ids[p.key]);
        const tds = Math.round((inv.taxable_paise * 200) / 10000);
        for (const [amount_paise, reference] of [[inv.outstanding_paise - tds, `NEFT ${p.key}`], [tds, `TDS certificate ${p.key}`]]) {
          const pay = await payments.addManual(client, ctx, { invoice_id: inv.id, paid_on: ctx.asOf, amount_paise, reference });
          await payments.confirm(client, ctx, pay.id);
        }
      });
    }
    if (p.promise) at(addDays(due, p.promise[0]), (ctx) => pub.promise(client, ctx, token(p.key), { date: addDays(due, p.promise[1]) }));
    if (p.dispute) at(addDays(due, p.dispute[0]), (ctx) => pub.dispute(client, ctx, token(p.key), { reason: p.dispute[1] }));
    if (p.claim) {
      at(addDays(due, p.claim[0]), async (ctx) => {
        const inv = await invoices.get(client, ctx, ids[p.key]);
        await pub.claimPaid(client, ctx, token(p.key), { reference: p.claim[1], date: addDays(ctx.asOf, -1), amount_paise: inv.outstanding_paise });
      });
    }
  });
  at("2026-07-01", (ctx) => customers.setOptOut(client, ctx, cust.c12.id, true));
  at(addDays(anchor, -1), async (ctx) => {
    const d = await invoices.createDraft(client, ctx, { customer_id: cust[DRAFT.cust].id, issue_date: DRAFT.issue, items: itemsFor("engineering", DRAFT.rs, 3) });
    ids[DRAFT.key] = d.id;
  });

  // Simulate every day up to the anchor: the 10:00 IST tick advances rungs (no outbox at seed), then people act.
  for (let d = HISTORY_START; d < anchor; d = addDays(d, 1)) {
    const tick = { ...ctxFor(cfg, d, 270), run_id: `seed-${d}` };
    for (const { inv, ev } of await evaluateAll(client, tick)) await applyAdvance(client, tick, inv, ev, "system");
    const ctx = ctxFor(cfg, d);
    for (const fn of actions.get(d) ?? []) await fn(ctx);
  }

  return assertSeed(client, cfg, anchor, ids);
}

async function assertSeed(client, cfg, anchor, ids) {
  const fail = (msg) => {
    throw new Error(`seed assertion failed: ${msg}`);
  };
  const chain = verifyChain(await loadChain((t, p) => client.query(t, p)));
  if (!chain.ok) fail(`chain broken at ${chain.breakAtId}`);
  const { rows: letters } = await client.query(
    `SELECT e.entry_hash FROM escalation_events e JOIN invoices i ON i.id = e.invoice_id WHERE i.number = $1 AND e.type = 'letter_generated'`,
    [LETTER_INVOICE],
  );
  if (letters.length !== 1) fail(`${LETTER_INVOICE} should have exactly one letter_generated event, has ${letters.length}`);
  const letter_hash = letters[0].entry_hash;
  if (SEED_LETTER_HASH && letter_hash !== SEED_LETTER_HASH) fail(`letter hash ${letter_hash} != pinned ${SEED_LETTER_HASH}`);
  const { rows: rung } = await client.query("SELECT rung FROM invoices WHERE number = $1", [LETTER_INVOICE]);
  if (rung[0]?.rung !== "demand_letter") fail(`${LETTER_INVOICE} rung is ${rung[0]?.rung}`);
  const { rows: ob } = await client.query("SELECT count(*)::int AS n FROM outbox");
  if (ob[0].n !== 0) fail("outbox should be empty after seed");

  // Dry run of the first tick at the anchor: exactly three automatic sends, all for different customers.
  const firstTick = (await evaluateAll(client, { cfg, asOf: anchor, ts: `${anchor}T04:30:00.000Z` })).filter((x) => x.ev.eligible);
  const sends = firstTick.map(({ inv, ev }) => ({ number: inv.number, customer: inv.customer_name, rung: ev.target_rung, policy: ev.channel_policy }));
  if (sends.length !== 3 || !sends.every((s) => s.policy === "auto") || new Set(sends.map((s) => s.customer)).size !== 3) {
    fail(`first tick at ${anchor} should queue exactly 3 auto sends, got ${JSON.stringify(sends)}`);
  }
  const { rows: due29 } = await client.query("SELECT number, due_date, rung FROM invoices WHERE id = $1", [ids.W24]);
  if (daysBetween(due29[0].due_date, anchor) !== 29) fail("the due+29 invoice moved");
  await ensureDemoTeam(client);
  return { anchor, letter_hash, chain_head: chain.head, events: chain.count, first_tick_sends: sends, ids };
}

// HDFC-like statement whose credits hit the pack's six cases against the seeded invoices, plus a debit and a malformed row.
export async function buildBankStatement(client) {
  const q = async (key) => {
    const { rows } = await client.query(
      "SELECT i.number, i.total_paise, i.taxable_paise, b.outstanding_paise FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id WHERE i.pay_token = $1",
      [token(key)],
    );
    return rows[0];
  };
  const [exact, part, m1, m2, tds, over] = [await q("W42"), await q("W36"), await q("W39"), await q("W43"), await q("W40"), await q("W34")];
  const inr = (p) => `"${new Intl.NumberFormat("en-IN").format(Math.trunc(p / 100))}.${pad(p % 100)}"`;
  const tdsShort = Math.round((tds.taxable_paise * 200) / 10000);
  const credits = [
    ["15/10/26", "UPI/510912345678/Payment/ravi.kumar@ybl", "0000510912345678", 1500000, "unknown deposit"],
    ["19/10/26", `IMPS-P2A-628812345678-SAINI BODY BUILDERS-${over.number}`, "628812345678", over.outstanding_paise + 500000, "overpayment"],
    ["20/10/26", `NEFT CR-HDFC0001234-SANDHU ENGINEERING WORKS-${m1.number} ${m2.number}`, "HDFC126282345678", m1.outstanding_paise + m2.outstanding_paise, "one payment, two invoices"],
    ["21/10/26", `UPI/612345678901/${part.number.replace(/\//g, " ")} part/mehta.cv@okicici`, "0000612345678901", 5000000, "part payment"],
    ["22/10/26", `NEFT CR-PUNB0123456-BHATIA TRACTORS PVT LTD-${exact.number}`, "PUNB126290012345", exact.outstanding_paise, "exact"],
    ["23/10/26", `NEFT CR-ICIC0004567-KOHLI FLEET SERVICES PVT LTD-${tds.number}`, "ICIC126285678901", tds.outstanding_paise - tdsShort, "short by 2% of taxable (TDS)"],
  ];
  const debit = ["05/10/26", "NEFT DR-UTIB0000123-PUNJAB STEEL TRADERS-SEPT BILL", "N278261234567890", 41000000];
  // Back-solve the opening so the statement closes at the configured cash in bank (forecast.opening_balance_paise).
  let balance = DEFAULT_CONFIG.forecast.opening_balance_paise - credits.reduce((s, c) => s + c[3], 0) + debit[3];
  const lines = [
    "Account No :XXXXXXXXXXXX4321 ARORA AUTO COMPONENTS",
    "Statement From : 01/10/2026 To : 23/10/2026,,,,,,",
    "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
    `01/10/26,Opening Balance,,01/10/26,0.00,0.00,${inr(balance)}`,
  ];
  balance -= debit[3];
  lines.push(`${debit[0]},${debit[1]},${debit[2]},${debit[0]},${inr(debit[3])},,${inr(balance)}`);
  for (const [date, narration, ref, amount] of credits) {
    balance += amount;
    lines.push(`${date},${narration},${ref},${date},,${inr(amount)},${inr(balance)}`);
  }
  lines.push(`23/10/26,NEFT CR-PUNB0005678-KAPOOR TRADERS-ADVANCE,PUNB126290099999,23/10/26,,"25,OOO.00",${inr(balance)}`);
  return { csv: `${lines.join("\n")}\n`, cases: credits.map(([date, , , amount, label]) => ({ date, amount_paise: amount, label })) };
}
