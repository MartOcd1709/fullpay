import { createHash } from "node:crypto";
import Papa from "papaparse";
import Fuse from "fuse.js";
import { rupeesToPaise } from "./money.js";

const TOL = 100;
const FUZZY_THRESHOLD = 0.35;
const FUSE_OPTS = { includeScore: true, threshold: FUZZY_THRESHOLD, ignoreLocation: true, ignoreFieldNorm: true };
const TDS_REASON = "Possibly TDS deducted: ask the customer for the TDS certificate";
// Income-tax Act 2025 s.393(1): 1% / 2% (Sl. 6(i), was 194C) and 10% (Sl. 6(iii), was 194J), on the taxable value.
const TDS_RATES = [
  [100, "tds_1"],
  [200, "tds_2"],
  [1000, "tds_10"],
];

const HEADERS = {
  date: ["date", "txndate", "transactiondate", "valuedt", "valuedate"],
  narration: ["narration", "description", "transactionremarks", "particulars"],
  reference: ["chqrefno", "chqrefnumber", "refno", "reference", "chequeno"],
  debit: ["withdrawalamt", "debit", "debitamount", "withdrawal"],
  credit: ["depositamt", "credit", "creditamount", "deposit"],
  balance: ["closingbalance", "balance"],
};

const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pad2 = (n) => String(n).padStart(2, "0");
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const near = (a, b) => Math.abs(a - b) <= TOL;

function headerMap(cells) {
  const map = {};
  cells.forEach((cell, i) => {
    const key = squash(cell);
    for (const [field, names] of Object.entries(HEADERS)) {
      if (map[field] === undefined && names.includes(key)) map[field] = i;
    }
  });
  const ok = map.date !== undefined && map.narration !== undefined && (map.credit !== undefined || map.debit !== undefined);
  return ok ? map : null;
}

function daysInMonth(y, m) {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function parseDate(raw) {
  const s = String(raw ?? "").trim();
  let y, m, d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(s);
  if (iso) [y, m, d] = iso.slice(1).map(Number);
  else if (dmy) {
    [d, m, y] = dmy.slice(1).map(Number);
    if (dmy[3].length === 2) y += 2000;
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parsePaise(raw, wrongSide) {
  if (raw === undefined) return NaN;
  const [, body, side = ""] = /^(.*?)(cr|dr)?\.?$/i.exec(String(raw).replace(/\s+/g, ""));
  if (side.toLowerCase() === wrongSide) return NaN;
  if (/^-*$/.test(body)) return 0;
  try {
    return rupeesToPaise(body);
  } catch {
    return NaN;
  }
}

function parseRow(cells, map, line) {
  const date = parseDate(cells[map.date]);
  if (!date) return { line, reason: "bad_date" };
  const debit = map.debit === undefined ? 0 : parsePaise(cells[map.debit], "cr");
  const credit = map.credit === undefined ? 0 : parsePaise(cells[map.credit], "dr");
  if (!Number.isInteger(debit) || !Number.isInteger(credit)) return { line, reason: "bad_amount" };
  if (debit === 0 && credit === 0) return { line, reason: "opening_balance" };
  if (debit !== 0 && credit !== 0) return { line, reason: "debit_and_credit" };
  const balance = cells[map.balance] ? parsePaise(cells[map.balance], "dr") : NaN;
  return {
    line,
    date,
    narration: cells[map.narration] ?? "",
    reference: cells[map.reference] || null,
    debit_paise: debit,
    credit_paise: credit,
    balance_paise: Number.isInteger(balance) ? balance : null,
  };
}

export function parseBankCsv(text) {
  const { data } = Papa.parse(String(text ?? "").replace(/^﻿/, ""), { skipEmptyLines: false });
  const rows = [];
  const skipped = [];
  let map = null;
  // ponytail: line = record index + 1; a quoted field containing a newline would shift it.
  data.forEach((raw, i) => {
    const line = i + 1;
    const cells = raw.map((c) => String(c ?? "").trim());
    if (cells.every((c) => c === "")) return;
    if (!map) {
      map = headerMap(cells);
      if (!map) skipped.push({ line, reason: "before_header" });
      return;
    }
    const row = parseRow(cells, map, line);
    (row.reason ? skipped : rows).push(row);
  });
  const seen = new Map();
  for (const row of rows) {
    const n = seen.get(dedupeKey(row)) ?? 0;
    seen.set(dedupeKey(row), n + 1);
    if (n) row.occurrence = n;
  }
  if (!map) {
    throw Object.assign(new Error("No header row found (expected columns like Date, Narration, Deposit Amt.)"), { code: "no_header" });
  }
  return { rows, skipped };
}

const STRIP_WORDS = /\b(messrs|pvt|private|ltd|limited|llp|opc|and|co|company)\b/g;

export function normalizeName(s) {
  const once = (t) =>
    t
      .replace(/\bm\/s\b/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(STRIP_WORDS, " ")
      .replace(/\s+/g, " ")
      .trim();
  return once(once(String(s ?? "").toLowerCase()));
}

const SEP = "[\\s/.\\-:#]*";
const FULL_RE = new RegExp(`(INV(?:OICE)?\\.?)?${SEP}(?:NO\\.?${SEP})?(\\d{2})(-?)(\\d{2})${SEP}(\\d{1,5})(?!\\d)`, "gi");
const BARE_RE = new RegExp(`INV(?:OICE)?\\.?${SEP}(?:NO\\.?${SEP})?(\\d{1,5})(?!-?\\d)`, "gi");
const LOOSE_RE = /\b(\d{4})\b/g;
const DATE_RE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g;

export function extractInvoiceRefs(narration, fys = []) {
  const text = String(narration ?? "");
  const found = [];
  const blank = (m) => " ".repeat(m.length);
  let rest = text.replace(FULL_RE, (m, inv, a, hyphen, b, seq, offset) => {
    if (!inv && !hyphen) return m;
    const fy = `${a}-${b}`;
    if (fys.includes(fy)) found.push({ offset, fy, seq: Number(seq) });
    return blank(m);
  });
  if (fys.length) {
    rest = rest.replace(BARE_RE, (m, seq, offset) => {
      found.push({ offset, fy: fys[0], seq: Number(seq) });
      return blank(m);
    });
    if (!found.length) {
      for (const m of rest.replace(DATE_RE, blank).matchAll(LOOSE_RE)) found.push({ offset: m.index, fy: fys[0], seq: Number(m[1]) });
    }
  }
  const seen = new Set();
  return found
    .sort((x, y) => x.offset - y.offset)
    .filter(({ fy, seq }) => !seen.has(`${fy}/${seq}`) && seen.add(`${fy}/${seq}`))
    .map(({ fy, seq }) => ({ fy, seq }));
}

const dedupeKey = (row) => `${row.date}|${row.credit_paise}|${row.reference || ""}`;

export function dedupeHash(row) {
  return createHash("sha256").update(row.occurrence ? `${dedupeKey(row)}|${row.occurrence}` : dedupeKey(row)).digest("hex");
}

function fyOf(date) {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${pad2(start % 100)}-${pad2((start + 1) % 100)}`;
}

const isOpen = (inv) => inv.outstanding_paise > 0 && inv.status !== "draft" && inv.status !== "paid";
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const oldestFirst = (a, b) => cmp(a.due_date ?? "", b.due_date ?? "") || cmp(a.seq ?? 0, b.seq ?? 0) || cmp(a.id, b.id);
const label = (inv) => inv.number ?? `#${inv.id}`;
const result = (credit, customer_id, matches, confidence, reason, flags) => ({ credit, customer_id, matches, confidence, reason, flags });

function fuzzyScore(pattern, text) {
  const [hit] = new Fuse([text], FUSE_OPTS).search(pattern);
  return hit ? hit.score : 1;
}

function findCustomer(narration, fuse, maxWords) {
  const tokens = normalizeName(narration).split(" ").filter(Boolean);
  let best = null;
  for (let n = 1; n <= maxWords; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n).join(" ");
      for (const hit of fuse.search(gram)) {
        const score = Math.max(hit.score, fuzzyScore(hit.item.norm, gram));
        if (score <= FUZZY_THRESHOLD && (!best || score < best.score)) best = { customer: hit.item, score };
      }
    }
  }
  return best ? best.customer : null;
}

function allocate(amount, invoices) {
  const matches = [];
  let left = amount;
  for (const inv of invoices) {
    if (left <= 0) break;
    const take = Math.min(inv.outstanding_paise, left);
    if (take <= 0) continue;
    matches.push({ invoice_id: inv.id, amount_paise: take });
    left -= take;
  }
  return { matches, remainder: left };
}

function tdsFlag(shortfall, taxable) {
  if (shortfall <= TOL) return null;
  const hit = TDS_RATES.find(([bps]) => near(shortfall, Math.round((taxable * bps) / 10000)));
  return hit ? hit[1] : null;
}

function flagsFor(matches, remainder, amount, invs) {
  if (!matches.length) return ["unmatched"];
  const flags = matches.length > 1 ? ["multi"] : [];
  const shortfall = sum(invs.map((i) => i.outstanding_paise)) - amount;
  if (remainder > TOL) flags.push("overpaid");
  else if (shortfall > TOL) flags.push(tdsFlag(shortfall, sum(invs.map((i) => i.taxable_paise ?? 0))) ?? "part");
  return flags;
}

const isTds = (f) => f.startsWith("tds_");

function matchByRef(credit, allNamed, open, payer) {
  const amount = credit.credit_paise;
  const customerId = payer && allNamed.some((i) => i.customer_id === payer.id) ? payer.id : allNamed[0].customer_id;
  const named = allNamed.filter((i) => i.customer_id === customerId);
  const others = allNamed.filter((i) => i.customer_id !== customerId).map(label);
  if (payer && payer.id !== customerId) others.push(`the payer name ${payer.name}`);
  const namedOpen = named.filter(isOpen);
  const rest = open.filter((i) => i.customer_id === customerId && !namedOpen.includes(i));
  const ordered = [...namedOpen, ...rest];
  const { matches, remainder } = allocate(amount, ordered);
  const invs = ordered.slice(0, matches.length);
  const flags = flagsFor(matches, remainder, amount, invs);
  const head = `Narration names ${named.map(label).join(", ")}${namedOpen.length ? "" : " (already paid)"}`;
  let reason;
  if (!matches.length) reason = `${head}; the customer has no open invoices`;
  else if (flags.some(isTds)) reason = TDS_REASON;
  else if (flags.includes("overpaid")) reason = `${head}; amount is more than the outstanding, so this is an overpayment`;
  else if (flags.includes("part")) reason = `${head}; amount is less than the outstanding, so this is a part payment`;
  else if (matches.length > namedOpen.length) reason = `${head}; the balance is spread over the customer's other open invoices, oldest first`;
  else reason = `${head}; amount equals ${namedOpen.length > 1 ? "their combined" : "its"} outstanding`;
  if (others.length) reason += `. It also points to another customer (${others.join(", ")}): check before confirming`;
  const confidence = matches.length && namedOpen.length && !others.length ? 95 : 40;
  return result(credit, customerId, matches, confidence, reason, flags);
}

function matchByName(credit, customer, invs) {
  const amount = credit.credit_paise;
  const who = `Name matches ${customer.name}`;
  if (!invs.length) return result(credit, customer.id, [], 40, `${who} but it has no open invoices`, ["unmatched"]);
  const exact = invs.find((i) => near(i.outstanding_paise, amount));
  if (exact) {
    const matches = [{ invoice_id: exact.id, amount_paise: Math.min(amount, exact.outstanding_paise) }];
    return result(credit, customer.id, matches, 85, `${who}; amount equals the outstanding of ${label(exact)}`, []);
  }
  const tds = invs.find((i) => tdsFlag(i.outstanding_paise - amount, i.taxable_paise ?? 0));
  if (tds) {
    const flag = tdsFlag(tds.outstanding_paise - amount, tds.taxable_paise ?? 0);
    return result(credit, customer.id, [{ invoice_id: tds.id, amount_paise: amount }], 70, TDS_REASON, [flag]);
  }
  let running = 0;
  for (let k = 0; k < invs.length && running <= amount + TOL; k++) {
    running += invs[k].outstanding_paise;
    if (k >= 1 && near(running, amount)) {
      const set = invs.slice(0, k + 1);
      const reason = `${who}; amount equals the combined outstanding of ${set.map(label).join(", ")} (oldest first)`;
      return result(credit, customer.id, allocate(amount, set).matches, 75, reason, ["multi"]);
    }
  }
  const { matches, remainder } = allocate(amount, invs);
  const set = invs.slice(0, matches.length);
  const flags = flagsFor(matches, remainder, amount, set);
  const last = set[set.length - 1];
  let reason;
  if (flags.some(isTds)) reason = TDS_REASON;
  else if (flags.includes("overpaid")) reason = `${who}; amount is more than everything it owes, so this is an overpayment`;
  else if (set.length === 1) reason = `${who}; amount is less than the outstanding of ${label(last)}, so this is a part payment`;
  else reason = `${who}; amount spread over its open invoices oldest first, leaving ${label(last)} part paid`;
  const confidence = set.length > 1 && flags.includes("part") ? 40 : set.length > 1 && flags.includes("overpaid") ? 75 : 70;
  return result(credit, customer.id, matches, confidence, reason, flags);
}

export function matchCredits(credits, invoices, customers, opts = {}) {
  const invoiceFys = invoices.map((i) => i.fy).filter(Boolean).sort().reverse();
  const fys = opts.fys ?? [...new Set([...(opts.today ? [fyOf(opts.today)] : []), ...invoiceFys])];
  const open = invoices.filter(isOpen).sort(oldestFirst);
  const byRef = new Map(invoices.filter((i) => i.seq != null).map((i) => [`${i.fy}/${i.seq}`, i]));
  const indexed = customers.map((c) => ({ ...c, norm: normalizeName(c.name) }));
  const fuse = new Fuse(indexed, { keys: ["norm"], ...FUSE_OPTS });
  const maxWords = Math.min(4, Math.max(1, ...indexed.map((c) => c.norm.split(" ").length)));
  return credits.map((credit) => {
    if (!(credit.credit_paise > 0)) return result(credit, null, [], 0, "Money out (debit), not a customer payment", ["debit"]);
    const narration = credit.narration ?? "";
    const named = extractInvoiceRefs(narration, fys)
      .map((r) => byRef.get(`${r.fy}/${r.seq}`))
      .filter(Boolean);
    const customer = findCustomer(narration, fuse, maxWords);
    if (named.length) return matchByRef(credit, named, open, customer);
    if (customer) return matchByName(credit, customer, open.filter((i) => i.customer_id === customer.id));
    return result(credit, null, [], 0, "No invoice number or known customer name found in the narration", ["unmatched"]);
  });
}
