// /proof: the organiser pack's "before you finish" checks, run live against this deployment. Each row: what, expected, actual, pass.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { invoiceTotals, validateGSTIN, docTypeFor } from "../gst.js";
import { evaluate, RUNGS } from "../ladder.js";
import { parseBankCsv, matchCredits } from "../recon.js";
import { buildForecast } from "../forecast.js";
import { loadChain, verifyChain } from "../chain.js";
import { fmtINR } from "../money.js";
import { addDays } from "../time.js";
import { t } from "../i18n.js";
import { forecastInputs } from "./views.js";
import { INVOICE_SELECT } from "./common.js";

let W = (k, v) => t(`proof.v.${k}`, "en", v); // value words in the page language (set per run)
const row = (key, expected, actual, vars = {}) => ({ key, vars, expected: String(expected), actual: String(actual), pass: String(expected) === String(actual) });
const inr = (p) => fmtINR(p, { paise: p % 100 !== 0 });

function gst() {
  const tenK = { qty_milli: 1000, rate_paise: 1_000_000, gst_bps: 1800 };
  const same = invoiceTotals([tenK], { interstate: false });
  const other = invoiceTotals([tenK], { interstate: true });
  const small = { qty_milli: 3000, rate_paise: 33_300, gst_bps: 500 };
  const s1 = invoiceTotals([small], { interstate: false });
  const disc = invoiceTotals([{ ...tenK, discount_paise: 100_000 }], { interstate: false });
  const comp = invoiceTotals([tenK], { interstate: false, registration: "composition" });
  const zero = invoiceTotals([{ ...tenK, gst_bps: 0 }], { interstate: false });
  return [
    row("gst_same", `CGST ${inr(90_000)} + SGST ${inr(90_000)} = ${inr(1_180_000)}`, `CGST ${inr(same.cgst_paise)} + SGST ${inr(same.sgst_paise)} = ${inr(same.total_paise)}`),
    row("gst_other", `IGST ${inr(180_000)} = ${inr(1_180_000)}`, `IGST ${inr(other.igst_paise)} = ${inr(other.total_paise)}`),
    row("gst_333", `CGST ${inr(2498)} + SGST ${inr(2498)}, ${W("round_off")} ${inr(4)}, ${W("total")} ${inr(104_900)}`, `CGST ${inr(s1.cgst_paise)} + SGST ${inr(s1.sgst_paise)}, ${W("round_off")} ${inr(s1.round_off_paise)}, ${W("total")} ${inr(s1.total_paise)}`),
    row("gst_discount", `${W("taxable")} ${inr(900_000)}, ${W("total")} ${inr(1_062_000)}`, `${W("taxable")} ${inr(disc.taxable_paise)}, ${W("total")} ${inr(disc.total_paise)}`),
    row("gst_composition", `${W("bos")}, ${W("tax")} ${inr(0)}, ${W("total")} ${inr(1_000_000)}`, `${docTypeFor("composition") === "bill_of_supply" ? W("bos") : docTypeFor("composition")}, ${W("tax")} ${inr(comp.cgst_paise + comp.sgst_paise + comp.igst_paise)}, ${W("total")} ${inr(comp.total_paise)}`),
    row("gst_zero", `${W("tax")} ${inr(0)}, ${W("total")} ${inr(1_000_000)}`, `${W("tax")} ${inr(zero.cgst_paise + zero.sgst_paise + zero.igst_paise)}, ${W("total")} ${inr(zero.total_paise)}`),
  ];
}

async function gstins(client) {
  const { rows } = await client.query("SELECT name, gstin FROM customers WHERE gstin IS NOT NULL ORDER BY id");
  const flip = (g) => g.slice(0, 7) + (g[7] === "A" ? "B" : "A") + g.slice(8);
  const valid = rows.filter((r) => validateGSTIN(r.gstin).valid).length;
  const caught = rows.filter((r) => !validateGSTIN(flip(r.gstin)).valid).length;
  return [row("gstin_valid", rows.length, valid, { n: rows.length }), row("gstin_tamper", rows.length, caught, { n: rows.length })];
}

async function numbering(client) {
  const { rows } = await client.query(
    `SELECT fy, count(*)::int AS n, min(seq)::int AS lo, max(seq)::int AS hi, count(DISTINCT seq)::int AS d FROM invoices WHERE seq IS NOT NULL GROUP BY fy ORDER BY fy`,
  );
  const dup = (await client.query("SELECT count(*)::int AS n FROM (SELECT lower(number) FROM invoices WHERE number IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x")).rows[0].n;
  const long = (await client.query("SELECT count(*)::int AS n FROM invoices WHERE seq IS NOT NULL AND length(number) > 16")).rows[0].n;
  return [
    ...rows.map((r) => row("numbers_fy", W("no_gaps", { hi: r.n }), r.lo === 1 && r.hi === r.n && r.d === r.n ? W("no_gaps", { hi: r.hi }) : W("gaps", { lo: r.lo, hi: r.hi, d: r.d, n: r.n }), { fy: r.fy })),
    row("numbers_dup", 0, dup), row("numbers_len", 0, long),
  ];
}

function letter(cfg) {
  const title = t("letter.title", "en");
  const disclaimer = t("letter.disclaimer", "en", { business: cfg.business?.name ?? "" });
  return [
    row("letter_title", "Payment Demand Letter", title),
    row("letter_line", W("yes"), /It is not a notice from the GST department and not a legal notice from a lawyer\.$/.test(disclaimer) ? W("yes") : W("no")),
    row("letter_deadline", W("days", { n: 7 }), W("days", { n: cfg.letter?.deadline_days ?? "?" })), // the pack: 7 days from the letter's date
  ];
}

function ladder(cfg) {
  const offsets = cfg.ladder?.offsets;
  const due = "2026-11-02";
  const inv = { id: 1, status: "sent", rung: null, paused_by: null, snoozed_until: null, due_date: due, outstanding_paise: 1_180_000 };
  const reached = {}, times = {};
  for (let d = addDays(due, -6); d <= addDays(due, 50); d = addDays(d, 1)) {
    const r = evaluate(inv, { today: d, offsets, customer: { opt_out: false } });
    if (r.eligible && r.target_rung) { reached[r.target_rung] ??= d; times[r.target_rung] = (times[r.target_rung] ?? 0) + 1; inv.rung = r.target_rung; }
  }
  const rows = RUNGS.map((rung) => row("ladder_day", addDays(due, offsets[rung]), reached[rung] ?? "—", { rung }));
  rows.push(row("ladder_once", W("once"), RUNGS.every((r) => times[r] === 1) ? W("once") : JSON.stringify(times)));
  const pausedDispute = RUNGS.some((_, i) => evaluate({ ...inv, rung: "due_date", paused_by: "dispute" }, { today: addDays(due, 7 + i * 5), offsets, customer: {} }).eligible);
  rows.push(row("ladder_dispute", W("paused"), pausedDispute ? W("sent_anyway") : W("paused")));
  const promise = { promised_date: addDays(due, 20), status: "open" };
  const before = evaluate({ ...inv, rung: "due_date" }, { today: addDays(due, 10), offsets, customer: {}, open_promise: promise }).eligible;
  const after = evaluate({ ...inv, rung: "due_date" }, { today: addDays(due, 21), offsets, customer: {}, open_promise: promise }).eligible;
  rows.push(row("ladder_promise", W("promise_ok"), !before && after ? W("promise_ok") : `${before} / ${after}`));
  return rows;
}

async function matching(client) {
  const csv = await readFile(path.join(process.cwd(), "db", "bank-statement.csv"), "utf8");
  const { rows } = parseBankCsv(csv);
  const inv = (await client.query(`${INVOICE_SELECT} WHERE i.status IN ('sent','part_paid','disputed','paid')`)).rows;
  const cust = (await client.query("SELECT id, name FROM customers WHERE anonymized_at IS NULL")).rows;
  const fys = [...new Set(inv.map((r) => r.fy))].sort().reverse();
  const out = matchCredits(rows.filter((r) => r.credit_paise > 0), inv, cust, { fys });
  const has = (f) => out.some((m) => (f === "exact" ? m.flags.length === 0 && m.matches.length === 1 && m.confidence >= 85 : m.flags.includes(f)));
  const gate = (await client.query("SELECT count(*)::int AS n FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE p.status <> 'confirmed'")).rows[0].n;
  return [
    ...["exact", "part", "multi", "tds_2", "overpaid", "unmatched"].map((f) => row("match_case", W("found"), has(f) ? W("found") : W("missing"), { case: f })),
    row("match_gate", 0, gate),
  ];
}

async function forecast(client, ctx) {
  const input = await forecastInputs(client, ctx);
  const fc = buildForecast(input);
  const breaks = fc.weeks.slice(1).filter((w, i) => w.opening_paise !== fc.weeks[i].closing_paise).length;
  const inflow = fc.weeks.reduce((a, w) => a + w.inflow_paise, 0) + fc.after_window_inflows.reduce((a, r) => a + r.amount_paise, 0);
  const owed = input.invoices.filter((i) => i.outstanding_paise > 0).reduce((a, i) => a + i.outstanding_paise, 0);
  const last = fc.weeks.at(-1);
  const net = fc.weeks.reduce((a, w) => a + w.inflow_paise - w.outflow_paise, 0);
  return [
    row("fc_chain", 0, breaks, { n: fc.weeks.length }),
    row("fc_inflows", inr(owed), inr(inflow)),
    row("fc_closing", inr(input.opening_cash_paise + net), inr(last.closing_paise)),
  ];
}

async function record(client) {
  const rows = await loadChain(client);
  const v = verifyChain(rows);
  return [row("record", W("unaltered"), v.ok ? W("unaltered") : W("broken", { id: v.breakAtId }), { n: rows.length })];
}

export async function run(client, ctx, lang = "en") {
  W = (k, v) => t(`proof.v.${k}`, lang, v);
  const t0 = performance.now();
  const sections = [
    { key: "gst", rows: gst() },
    { key: "gstin", rows: await gstins(client) },
    { key: "numbers", rows: await numbering(client) },
    { key: "letter", rows: letter(ctx.cfg) },
    { key: "ladder", rows: ladder(ctx.cfg) },
    { key: "matching", rows: await matching(client) },
    { key: "forecast", rows: await forecast(client, ctx) },
    { key: "record", rows: await record(client) },
  ];
  const all = sections.flatMap((s) => s.rows);
  return { as_of: ctx.asOf, ms: Math.round(performance.now() - t0), total: all.length, passed: all.filter((r) => r.pass).length, sections };
}
