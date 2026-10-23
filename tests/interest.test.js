import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeInterest, conventionFootnote } from "../lib/interest.js";
import { addDays } from "../lib/time.js";

const LAKH5 = 50_000_000;
const DUE = "2026-01-15";
const FLAT = [{ from: "2020-01-01", bps: 650 }];
const hand = (base, bps, days) => Math.round((base * bps * days) / (10_000 * 365));
const sumDays = (r) => r.segments.reduce((s, x) => s + x.days, 0);
const sumInterest = (r) => r.segments.reduce((s, x) => s + x.interest_paise, 0);
const sumPaid = (r) => r.allocations_applied.reduce((s, a) => s + a.amount_paise, 0);

function assertInvariants(r, principal) {
  assert.equal(sumInterest(r), r.total_interest_paise);
  assert.equal(r.total_due_paise, principal + r.total_interest_paise - sumPaid(r) + r.overpaid_paise);
  assert.equal(r.total_due_paise, r.outstanding_principal_paise + r.unpaid_interest_paise);
  for (let i = 1; i < r.segments.length; i++) assert.equal(r.segments[i].from, addDays(r.segments[i - 1].to, 1));
  if (r.segments.length) {
    assert.equal(r.segments[0].from, r.start_date);
    assert.equal(r.segments.at(-1).to, r.as_of);
    assert.equal(sumDays(r), 1 + (Date.parse(r.as_of) - Date.parse(r.start_date)) / 86_400_000);
  }
  for (const s of r.segments) assert.ok(Number.isSafeInteger(s.interest_paise) && s.days > 0);
}

const flat = (as_of, extra = {}) => computeInterest({ principal_paise: LAKH5, due_date: DUE, as_of, series: FLAT, ...extra });

test("golden: 365 days at 19.5% with monthly rests", () => {
  const r = flat("2027-01-15");
  assertInvariants(r, LAKH5);
  assert.equal(sumDays(r), 365);
  assert.equal(r.start_date, "2026-01-16");
  assert.ok(Math.abs(r.total_interest_paise - 10_670_400) <= 500, `TaxGuru ±₹5: ${r.total_interest_paise}`);
  assert.ok(Math.abs(r.total_interest_paise - 10_670_800) <= 100, `engine 22 Oct ±₹1: ${r.total_interest_paise}`);
  assert.equal(r.rests.length, 12);
  assert.equal(r.rests[0], "2026-02-15");
  assert.equal(r.rests.at(-1), "2027-01-15");
  assert.ok(r.segments.every((s) => s.rate_bps === 1950 && s.bank_rate_bps === 650 && !s.dispute));
  assert.equal(r.segments[0].interest_paise, hand(LAKH5, 1950, 30));
  assert.equal(r.segments[1].base_paise, LAKH5 + r.segments[0].interest_paise);
  assert.equal(r.outstanding_principal_paise, LAKH5);
  assert.equal(r.total_due_paise, LAKH5 + r.total_interest_paise);
});

test("golden: 120 days", () => {
  const r = flat("2026-05-15");
  assertInvariants(r, LAKH5);
  assert.equal(sumDays(r), 120);
  assert.ok(Math.abs(r.total_interest_paise - 3_283_774) <= 100, String(r.total_interest_paise));
});

test("golden: 181 days", () => {
  const r = flat("2026-07-15");
  assertInvariants(r, LAKH5);
  assert.equal(sumDays(r), 181);
  assert.ok(Math.abs(r.total_interest_paise - 5_034_385) <= 100, String(r.total_interest_paise));
});

test("RBI rate change mid-period switches on the change date", () => {
  const series = [{ from: "2025-12-05", bps: 550 }, { from: "2026-10-07", bps: 575 }];
  const r = computeInterest({ principal_paise: LAKH5, due_date: "2026-09-15", as_of: "2026-11-10", series });
  assertInvariants(r, LAKH5);
  assert.deepEqual([...new Set(r.segments.map((s) => s.rate_bps))], [1650, 1725]);
  assert.deepEqual(
    r.segments.map((s) => [s.from, s.to, s.days, s.bank_rate_bps]),
    [
      ["2026-09-16", "2026-10-06", 21, 550],
      ["2026-10-07", "2026-10-14", 8, 575],
      ["2026-10-15", "2026-11-10", 27, 575],
    ],
  );
  assert.deepEqual(r.rests, ["2026-10-15"]);
  assert.deepEqual(r.segments.map((s) => s.interest_paise), [474_658, 189_041, 646_483]);
  assert.equal(r.total_interest_paise, 1_310_182);
});

test("part payment, interest_first: clears all unpaid interest, then principal", () => {
  const allocations = [{ date: "2026-03-01", amount_paise: 2_000_000 }];
  const r = flat("2026-04-30", { allocations });
  assertInvariants(r, LAKH5);
  assert.deepEqual(r.allocations_applied, [
    { date: "2026-03-01", amount_paise: 2_000_000, to_interest_paise: 1_181_336, to_principal_paise: 818_664 },
  ]);
  assert.equal(r.outstanding_principal_paise, LAKH5 - 818_664);
  assert.equal(r.overpaid_paise, 0);
  const after = r.segments.find((s) => s.from === "2026-03-01");
  assert.equal(after.base_paise, LAKH5 - 818_664);
  assert.equal(r.total_due_paise, LAKH5 + r.total_interest_paise - 2_000_000);
});

test("part payment, principal_first: reduces base directly and accrues less", () => {
  const allocations = [{ date: "2026-03-01", amount_paise: 2_000_000 }];
  const pf = flat("2026-04-30", { allocations, appropriation: "principal_first" });
  const if_ = flat("2026-04-30", { allocations });
  assertInvariants(pf, LAKH5);
  assert.deepEqual(pf.allocations_applied, [
    { date: "2026-03-01", amount_paise: 2_000_000, to_interest_paise: 0, to_principal_paise: 2_000_000 },
  ]);
  assert.equal(pf.outstanding_principal_paise, LAKH5 - 2_000_000);
  assert.equal(pf.convention.appropriation, "principal_first");
  assert.ok(pf.total_interest_paise < if_.total_interest_paise);
});

test("allocation on a rest date: compound first, then allocate", () => {
  const r = flat("2026-03-10", { allocations: [{ date: "2026-02-15", amount_paise: 500_000 }] });
  assertInvariants(r, LAKH5);
  const firstMonth = hand(LAKH5, 1950, 30);
  assert.deepEqual(r.rests, ["2026-02-15"]);
  assert.deepEqual(r.allocations_applied, [
    { date: "2026-02-15", amount_paise: 500_000, to_interest_paise: 500_000, to_principal_paise: 0 },
  ]);
  assert.equal(r.segments[1].from, "2026-02-15");
  assert.equal(r.segments[1].base_paise, LAKH5 + firstMonth - 500_000);
  assert.equal(r.outstanding_principal_paise, LAKH5);
});

test("accepted dispute span: 0% inside, rests still fire, rate resumes after", () => {
  const r = flat("2026-04-30", { dispute_spans: [{ from: "2026-02-20", to: "2026-03-20" }] });
  assertInvariants(r, LAKH5);
  const inside = r.segments.filter((s) => s.from >= "2026-02-20" && s.from < "2026-03-20");
  const outside = r.segments.filter((s) => !inside.includes(s));
  assert.deepEqual(inside.map((s) => [s.from, s.to]), [["2026-02-20", "2026-03-14"], ["2026-03-15", "2026-03-19"]]);
  assert.ok(inside.every((s) => s.dispute && s.rate_bps === 0 && s.interest_paise === 0 && s.bank_rate_bps === 650));
  assert.ok(outside.every((s) => !s.dispute && s.rate_bps === 1950 && s.interest_paise > 0));
  assert.deepEqual(r.rests, ["2026-02-15", "2026-03-15", "2026-04-15"]);
  const undisputed = flat("2026-04-30");
  assert.ok(r.total_interest_paise < undisputed.total_interest_paise);
});

test("open dispute span (to = null) runs to as_of", () => {
  const r = flat("2026-04-30", { dispute_spans: [{ from: "2026-03-01", to: null }] });
  assertInvariants(r, LAKH5);
  const before = r.segments.filter((s) => s.from < "2026-03-01");
  const after = r.segments.filter((s) => s.from >= "2026-03-01");
  assert.ok(after.length >= 2 && after.every((s) => s.dispute && s.interest_paise === 0));
  assert.equal(r.total_interest_paise, before.reduce((s, x) => s + x.interest_paise, 0));
});

test("series not covering the start date throws RATE_SERIES_GAP", () => {
  assert.throws(() => flat("2026-06-30", { series: [{ from: "2026-02-01", bps: 650 }] }), { code: "RATE_SERIES_GAP" });
  assert.throws(() => flat("2026-06-30", { series: [] }), { code: "RATE_SERIES_GAP" });
  assert.doesNotThrow(() => flat("2026-06-30", { series: [{ from: "2026-01-16", bps: 650 }] }));
});

test("as_of before the start date: zero segments, zero interest", () => {
  for (const as_of of ["2025-12-31", "2026-01-15"]) {
    const r = flat(as_of);
    assert.deepEqual(r.segments, []);
    assert.deepEqual(r.rests, []);
    assert.equal(r.total_interest_paise, 0);
    assert.equal(r.total_due_paise, LAKH5);
    assert.equal(r.start_date, "2026-01-16");
  }
  const paid = flat("2026-01-10", { series: [], allocations: [{ date: "2026-01-05", amount_paise: 1_000_000 }] });
  assert.equal(paid.total_due_paise, LAKH5 - 1_000_000);
  assert.equal(paid.allocations_applied[0].to_principal_paise, 1_000_000);
});

test("as_of on the start date accrues exactly one day", () => {
  const r = flat("2026-01-16");
  assertInvariants(r, LAKH5);
  assert.deepEqual(r.segments.map((s) => [s.from, s.to, s.days]), [["2026-01-16", "2026-01-16", 1]]);
  assert.equal(r.total_interest_paise, hand(LAKH5, 1950, 1));
});

test("allocation before start reduces the base from day one; future allocations are ignored", () => {
  const r = flat("2026-02-10", {
    allocations: [{ date: "2026-01-10", amount_paise: 10_000_000 }, { date: "2026-03-01", amount_paise: 999 }],
  });
  assertInvariants(r, LAKH5);
  assert.equal(r.segments[0].base_paise, LAKH5 - 10_000_000);
  assert.equal(r.allocations_applied.length, 1);
  assert.equal(r.allocations_applied[0].to_principal_paise, 10_000_000);
});

test("overpayment never drives the base negative", () => {
  const r = flat("2026-04-30", { allocations: [{ date: "2026-03-01", amount_paise: 60_000_000 }] });
  assertInvariants(r, LAKH5);
  assert.equal(r.outstanding_principal_paise, 0);
  assert.equal(r.total_due_paise, 0);
  assert.ok(r.overpaid_paise > 0);
  assert.ok(r.segments.filter((s) => s.from >= "2026-03-01").every((s) => s.base_paise === 0 && s.interest_paise === 0));
});

test("monthly rests clamp to month end", () => {
  const r = computeInterest({ principal_paise: LAKH5, due_date: "2026-01-31", as_of: "2026-05-31", series: FLAT });
  assertInvariants(r, LAKH5);
  assert.deepEqual(r.rests, ["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  assert.equal(r.segments[0].days, 27);
});

test("invalid inputs throw INVALID_INPUT", () => {
  assert.throws(() => flat("2026-02-30"), { code: "INVALID_INPUT" });
  assert.throws(() => computeInterest({ principal_paise: 100.5, due_date: DUE, as_of: "2026-03-01", series: FLAT }), { code: "INVALID_INPUT" });
  assert.throws(() => flat("2026-03-01", { day_count: "30/360" }), { code: "INVALID_INPUT" });
  assert.throws(() => flat("2026-03-01", { allocations: [{ date: "2026-02-01", amount_paise: -1 }] }), { code: "INVALID_INPUT" });
  assert.throws(() => flat("2026-03-01", { appropriation: "pro_rata" }), { code: "INVALID_INPUT" });
});

test("conventionFootnote states day count, rests, rate switch, dispute and appropriation rules", () => {
  const r = flat("2026-04-30");
  const en = conventionFootnote(r);
  for (const s of ["actual/365", "three times", "monthly rests", "Gurpreet Singh", "SC 2006", "V.K. Patel", "Simplex", "Cal HC 2024", "dispute", "first towards interest", "105 days"]) {
    assert.ok(en.includes(s), `en footnote missing "${s}"`);
  }
  assert.equal((en.match(/2026/g) ?? []).length, 5, "start, as_of and three rest dates");
  const hi = conventionFootnote(r, "hi");
  for (const s of ["चक्रवृद्धि", "गुरप्रीत सिंह", "पटेल", "सिम्प्लेक्स", "पहले ब्याज में", "365"]) assert.ok(hi.includes(s), `hi footnote missing "${s}"`);
  const pf = conventionFootnote(flat("2026-04-30", { appropriation: "principal_first" }));
  assert.ok(pf.includes("first towards principal"));
  assert.ok(conventionFootnote(flat("2026-01-10")).startsWith("No interest has accrued"));
  assert.ok(conventionFootnote(flat("2026-02-01")).includes("no monthly rest fell"));
});

test("segment rows are inclusive and never share a day (letter table)", () => {
  const r = flat("2026-03-10", { allocations: [{ date: "2026-03-01", amount_paise: 1 }] });
  assert.deepEqual(r.segments.map((s) => [s.from, s.to, s.days]), [
    ["2026-01-16", "2026-02-14", 30],
    ["2026-02-15", "2026-02-28", 14],
    ["2026-03-01", "2026-03-10", 10],
  ]);
});

test("conventionFootnote: prototype-key lang falls back to English", () => {
  const r = flat("2026-04-30");
  for (const lang of ["constructor", "__proto__", "toString"]) assert.equal(conventionFootnote(r, lang), conventionFootnote(r));
  const odd = { ...r, convention: { ...r.convention, appropriation: "constructor" } };
  assert.ok(conventionFootnote(odd).includes("first towards interest"));
});

test("footnote cites V.K. Patel for the varying rate, not for the change-date rule", () => {
  const en = conventionFootnote(flat("2026-04-30"));
  assert.ok(en.includes("varies over the period, not fixed at the due date (V.K. Patel"));
  assert.ok(en.includes("each RBI change applies from its change date"));
});

test("engine never touches Date (LLD grep-gate: only lib/time.js may)", () => {
  assert.doesNotMatch(readFileSync(new URL("../lib/interest.js", import.meta.url), "utf8"), /new Date|Date\.now|Date\.UTC/);
});

test("matches a day-by-day oracle across rate change, straddling dispute, rest-day and early payments", () => {
  const series = [{ from: "2025-12-05", bps: 550 }, { from: "2026-03-15", bps: 575 }];
  const allocations = [
    { date: "2026-01-10", amount_paise: 1_000_000 },
    { date: "2026-04-15", amount_paise: 3_000_000 },
    { date: "2026-04-15", amount_paise: 500_000 },
    { date: "2026-06-02", amount_paise: 7_000_000 },
  ];
  const dispute_spans = [{ from: "2026-03-01", to: "2026-03-20" }];
  const as_of = "2026-07-31";
  const r = computeInterest({ principal_paise: LAKH5, due_date: DUE, as_of, series, allocations, dispute_spans });
  assertInvariants(r, LAKH5);
  const rests = new Set(r.rests);
  let p = LAKH5, cap = 0, acc = 0, tot = 0;
  for (let d = "2026-01-16"; d <= as_of; d = addDays(d, 1)) {
    if (rests.has(d)) [cap, acc] = [cap + acc, 0];
    for (const a of allocations.filter((a) => a.date === d || (d === "2026-01-16" && a.date < d))) {
      let left = a.amount_paise;
      const t1 = Math.min(left, acc); acc -= t1; left -= t1;
      const t2 = Math.min(left, cap); cap -= t2; left -= t2;
      p -= Math.min(left, p);
    }
    const bps = d >= "2026-03-01" && d < "2026-03-20" ? 0 : (d >= "2026-03-15" ? 575 : 550) * 3;
    const x = ((p + cap) * bps) / (10_000 * 365);
    acc += x; tot += x;
  }
  assert.ok(Math.abs(r.total_interest_paise - tot) <= r.segments.length / 2 + 1, `${r.total_interest_paise} vs ${tot}`);
});
