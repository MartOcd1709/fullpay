// Read an outstanding-invoices export (Tally "Bills Receivable", Vyapar sale report, Zoho, plain Excel CSV) into rows.
// Pure: no DB. The header row is found automatically (Tally puts a title block above it); columns are matched by name.
import Papa from "papaparse";
import { rupeesToPaise } from "./money.js";
import { isISODate } from "./time.js";

const ALIASES = {
  number: ["invoice no", "invoice number", "inv no", "bill no", "bill number", "voucher no", "vch no", "ref no", "reference no", "invoice", "invoice id", "number", "doc no"],
  date: ["date", "invoice date", "bill date", "voucher date", "inv date", "doc date"],
  customer: ["party name", "party s name", "partys name", "customer", "customer name", "party", "buyer", "buyer name", "name", "particulars", "ledger", "ledger name", "client"],
  gstin: ["gstin", "gstin uin", "gst no", "gst number", "party gstin", "gstin of party", "customer gstin"],
  total: ["total", "amount", "invoice amount", "bill amount", "grand total", "total amount", "invoice value", "opening amount", "value", "invoice total"],
  balance: ["balance", "pending amount", "pending", "outstanding", "balance due", "due amount", "closing balance", "balance amount", "amount due", "unpaid"],
  received: ["received", "received amount", "paid", "paid amount", "amount received"],
  due: ["due date", "due on", "due", "payment due"],
  email: ["email", "e mail", "email id", "party email"],
  phone: ["phone", "mobile", "phone no", "mobile no", "contact", "contact no", "whatsapp"],
};
const norm = (h) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const LOOKUP = new Map(Object.entries(ALIASES).flatMap(([field, names]) => names.map((n) => [n, field])));
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export const MAX_ROWS = 5000;

function mapHeader(cells) {
  const mapping = {};
  cells.forEach((c, i) => {
    const f = LOOKUP.get(norm(c));
    if (f && mapping[f] == null) mapping[f] = i;
  });
  return mapping;
}

// "01/04/2026", "1-4-26", "01.04.2026", "2026-04-01", "1-Apr-26", "01 Apr 2026" → "2026-04-01" (Indian day-first order).
export function parseDate(s) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (isISODate(t.slice(0, 10))) return t.slice(0, 10);
  let m = t.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/);
  let d, mo, y;
  if (m) [, d, mo, y] = m;
  else if ((m = t.match(/^(\d{1,2})[\s\-/]?([A-Za-z]{3})[A-Za-z]*[\s\-/,]*(\d{2}|\d{4})$/))) [, d, mo, y] = [m[0], m[1], MONTHS[m[2].toLowerCase()], m[3]];
  else return null;
  y = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isISODate(iso) ? iso : null;
}

// "₹1,23,456.50", "1,23,456.50 Dr", "(500.00)", "12000 Cr" → paise; Cr / brackets come back negative (an advance, not a due).
export function parseAmount(s) {
  let t = String(s ?? "").replace(/[₹\s]|rs\.?|inr/gi, "");
  if (!t) return null;
  let sign = 1;
  if (/cr$/i.test(t)) sign = -1;
  t = t.replace(/(dr|cr)$/i, "");
  if (/^\(.*\)$/.test(t) || t.startsWith("-")) { sign = -1; t = t.replace(/[()\-]/g, ""); }
  t = t.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const p = rupeesToPaise(t);
  return Number.isSafeInteger(p) ? sign * p : null;
}

export function parseInvoiceCsv(text) {
  const { data } = Papa.parse(String(text ?? "").replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  let headerAt = -1, mapping = {};
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const m = mapHeader(data[i]);
    if (m.customer != null && (m.total != null || m.balance != null)) { headerAt = i; mapping = m; break; }
  }
  if (headerAt < 0) return { ok: false, error: "no_header", mapping: {}, rows: [], unmapped: [] };
  const header = data[headerAt];
  const unmapped = header.filter((h, i) => String(h).trim() && !Object.values(mapping).includes(i));
  const body = data.slice(headerAt + 1);
  const rows = [];
  const seen = new Set();
  for (let k = 0; k < body.length && rows.length < MAX_ROWS; k++) {
    const cells = body[k];
    const get = (f) => (mapping[f] == null ? "" : String(cells[mapping[f]] ?? "").trim());
    const customer = get("customer");
    // Tally's trailing "Total" / "Grand Total" lines and blank spacer rows are not invoices.
    if (!customer && !get("number")) continue;
    if (/^(grand\s+)?total$/i.test(customer) || /^(grand\s+)?total$/i.test(get("number"))) continue;
    const errors = [];
    const v = {
      number: get("number").slice(0, 60) || null,
      date: parseDate(get("date")),
      customer: customer.slice(0, 200),
      gstin: get("gstin").toUpperCase().replace(/\s/g, "") || null,
      total_paise: parseAmount(get("total")),
      balance_paise: parseAmount(get("balance")),
      received_paise: parseAmount(get("received")),
      due_date: parseDate(get("due")),
      email: get("email") || null,
      phone: get("phone") || null,
    };
    if (v.total_paise == null && v.balance_paise != null) v.total_paise = v.balance_paise;
    if (v.balance_paise == null && v.total_paise != null) v.balance_paise = Math.max(0, v.total_paise - Math.max(0, v.received_paise ?? 0));
    if (!v.customer) errors.push("no_customer");
    if (!v.number) errors.push("no_number");
    if (get("date") && !v.date) errors.push("bad_date");
    if (!v.date) errors.push(get("date") ? "bad_date" : "no_date");
    if (v.balance_paise != null && v.balance_paise < 0) errors.push("credit_balance");
    else if (v.total_paise == null || v.total_paise <= 0) errors.push("bad_amount");
    else if (v.balance_paise > v.total_paise) errors.push("balance_over_total");
    if (get("due") && !v.due_date) errors.push("bad_due_date");
    if (v.due_date && v.date && v.due_date < v.date) errors.push("due_before_date");
    const key = v.number?.toLowerCase();
    if (key && seen.has(key)) errors.push("duplicate_in_file");
    if (key) seen.add(key);
    rows.push({ line: headerAt + k + 2, value: v, errors: [...new Set(errors)] });
  }
  return { ok: true, header_line: headerAt + 1, mapping: Object.fromEntries(Object.entries(mapping).map(([f, i]) => [f, header[i]])), unmapped, rows, truncated: body.length > rows.length && rows.length >= MAX_ROWS };
}
