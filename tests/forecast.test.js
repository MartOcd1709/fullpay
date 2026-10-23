import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedInflowDate,
  buildForecast,
  agingBuckets,
  reliability,
  chaseScore,
  chaseList,
} from "../lib/forecast.js";

const TODAY = "2026-10-24";
const L = (rupees) => rupees * 100; // paise

const customers = [
  { id: 1, name: "Prompt Traders", avg_late_days: 0 },
  { id: 2, name: "Slow Movers", avg_late_days: 10 },
  { id: 3, name: "Chronic Late", avg_late_days: 20, grade: "C" },
];

const inv = (id, customer_id, due_date, rupees, extra = {}) => ({
  id,
  number: `INV/26-27/${String(id).padStart(4, "0")}`,
  customer_id,
  due_date,
  outstanding_paise: L(rupees),
  status: "sent",
  promise_date: null,
  ...extra,
});

// Scenario A: hand-computed. Opening ₹1,20,000, buffer ₹50,000, salaries ₹60,000 monthly on the 1st, one supplier bill.
const scenarioA = () => ({
  today: TODAY,
  opening_cash_paise: L(120000),
  buffer_paise: L(50000),
  customers,
  invoices: [
    inv(1, 1, "2026-11-15", 40000), // expected 15 Nov -> week 3
    inv(2, 1, "2026-12-10", 90000), // expected 10 Dec -> week 6
    inv(3, 2, "2026-12-20", 70000), // expected 30 Dec -> week 9
    inv(4, 1, "2026-09-30", 30000), // overdue, clamped to today -> week 0
    inv(5, 1, "2026-11-01", 55000, { status: "paid", outstanding_paise: 0 }),
    inv(6, 1, "2026-11-02", 10000, { status: "draft" }),
  ],
  expenses: [
    { id: 1, category: "salaries", description: "Salaries", amount_paise: L(60000), due_on: "2026-10-01", recurring: "monthly", paid: false },
    { id: 2, category: "supplier", description: "Board stock", amount_paise: L(20000), due_on: "2026-11-10", recurring: null, paid: false },
    { id: 3, category: "supplier", description: "Paid already", amount_paise: L(99000), due_on: "2026-11-12", recurring: null, paid: true },
  ],
});

const closings = (f) => f.weeks.map((w) => w.closing_paise);

test("expectedInflowDate: promise wins, else due + avg late, never before today", () => {
  const c = { id: 2, avg_late_days: 10 };
  assert.equal(expectedInflowDate(inv(1, 2, "2026-11-01", 1), c, TODAY), "2026-11-11");
  assert.equal(expectedInflowDate(inv(1, 2, "2026-11-01", 1, { promise_date: "2026-11-05" }), c, TODAY), "2026-11-05");
  assert.equal(expectedInflowDate(inv(1, 2, "2026-09-01", 1), c, TODAY), TODAY);
  assert.equal(expectedInflowDate(inv(1, 2, "2026-09-01", 1, { promise_date: "2026-10-01" }), c, TODAY), TODAY);
  assert.equal(expectedInflowDate(inv(1, 9, "2026-11-01", 1), undefined, TODAY), "2026-11-01");
});

test("week chaining: 13 weeks, closing(n) === opening(n+1), week 0 starts today", () => {
  const f = buildForecast(scenarioA());
  assert.equal(f.weeks.length, 13);
  assert.equal(f.weeks[0].start, TODAY);
  assert.equal(f.weeks[0].end, "2026-10-30");
  assert.equal(f.weeks[12].start, "2027-01-16");
  assert.equal(f.weeks[0].opening_paise, L(120000));
  for (let i = 0; i < 12; i++) {
    assert.equal(f.weeks[i].closing_paise, f.weeks[i + 1].opening_paise, `week ${i}`);
    assert.equal(f.weeks[i].closing_paise, f.weeks[i].opening_paise + f.weeks[i].inflow_paise - f.weeks[i].outflow_paise);
    assert.equal(f.weeks[i].index, i);
  }
  assert.deepEqual(
    closings(f).map((p) => p / 100),
    [150000, 90000, 70000, 110000, 110000, 50000, 140000, 140000, 140000, 150000, 150000, 150000, 150000],
  );
});

test("totals equal unpaid invoice outstanding and the expenses placed in the window", () => {
  const f = buildForecast(scenarioA());
  assert.equal(f.totals.inflow_paise, L(40000 + 90000 + 70000 + 30000));
  assert.equal(f.outstanding_paise, L(230000));
  assert.equal(f.totals.outflow_paise, L(3 * 60000 + 20000));
  const inflowIds = f.weeks.flatMap((w) => w.inflows.map((i) => i.invoice_id)).sort();
  assert.deepEqual(inflowIds, [1, 2, 3, 4]);
  assert.equal(f.weeks.flatMap((w) => w.inflows).reduce((a, i) => a + i.amount_paise, 0), f.totals.inflow_paise);
  assert.equal(f.weeks.flatMap((w) => w.outflows).reduce((a, o) => a + o.amount_paise, 0), f.totals.outflow_paise);
  assert.deepEqual(f.weeks[0].inflows, [{ invoice_id: 4, number: "INV/26-27/0004", customer_id: 1, amount_paise: L(30000), date: TODAY }]);
  assert.deepEqual(f.weeks[2].outflows, [{ expense_id: 2, category: "supplier", amount_paise: L(20000), date: "2026-11-10" }]);
});

test("closing exactly at the buffer is not a shortfall; lowest week reported", () => {
  const f = buildForecast(scenarioA());
  assert.equal(f.first_shortfall_week, null);
  assert.deepEqual(f.cover_gap, []);
  assert.deepEqual(f.lowest, { index: 5, closing_paise: L(50000) });
  assert.equal(f.weeks.some((w) => w.below_buffer), false);
});

test("late-customer what-if moves inflows later and creates a shortfall; cover_gap takes the fewest oldest-due invoices", () => {
  const f = buildForecast({ ...scenarioA(), whatIf: { late_customer_id: 1, late_days: 30 } });
  assert.deepEqual(
    closings(f).map((p) => p / 100),
    [120000, 60000, 40000, 40000, 70000, 10000, 10000, 50000, 50000, 60000, 60000, 150000, 150000],
  );
  assert.equal(f.first_shortfall_week, 2);
  assert.equal(f.weeks[1].below_buffer, false);
  assert.equal(f.weeks[2].below_buffer, true);
  assert.deepEqual(f.lowest, { index: 5, closing_paise: L(10000) });
  assert.deepEqual(
    f.cover_gap.map((g) => [g.invoice_id, g.outstanding_paise, g.due_date]),
    [[4, L(30000), "2026-09-30"], [1, L(40000), "2026-11-15"]],
  );
  assert.equal(f.weeks[4].inflows[0].invoice_id, 4);
  assert.equal(f.weeks[4].inflows[0].date, "2026-11-23");
  assert.equal(f.totals.inflow_paise, L(230000));
  assert.equal(f.weeks[9].inflows[0].invoice_id, 3, "other customers are not shifted");
});

test("late_days defaults to 30 and inflows shifted past the window drop out of totals", () => {
  const f = buildForecast({ ...scenarioA(), whatIf: { late_customer_id: 2 } });
  assert.equal(f.totals.inflow_paise, L(230000 - 70000));
  assert.equal(f.outstanding_paise, L(230000));
});

test("big order what-if removes the shortfall", () => {
  const f = buildForecast({
    ...scenarioA(),
    whatIf: { late_customer_id: 1, late_days: 30, big_order: { amount_paise: L(50000), week_index: 1 } },
  });
  assert.equal(f.first_shortfall_week, null);
  assert.deepEqual(f.cover_gap, []);
  assert.deepEqual(f.weeks[1].inflows, [
    { invoice_id: null, number: "What-if: big order", customer_id: null, amount_paise: L(50000), date: "2026-10-31" },
  ]);
  assert.equal(f.weeks[5].closing_paise, L(60000));
  assert.equal(buildForecast({ ...scenarioA(), whatIf: { big_order: { amount_paise: L(1), week_index: 13 } } }).totals.inflow_paise, L(230000));
});

test("supplier delay what-if moves only supplier outflows", () => {
  const base = buildForecast(scenarioA());
  const f = buildForecast({ ...scenarioA(), whatIf: { supplier_delay_days: 14 } });
  assert.equal(base.weeks[2].outflows.length, 1);
  assert.equal(f.weeks[2].outflows.length, 0);
  assert.deepEqual(f.weeks[4].outflows, [{ expense_id: 2, category: "supplier", amount_paise: L(20000), date: "2026-11-24" }]);
  assert.equal(f.weeks[1].outflows[0].category, "salaries");
  assert.equal(f.weeks[1].outflows[0].date, "2026-11-01");
  assert.equal(f.totals.outflow_paise, base.totals.outflow_paise);
});

test("monthly expenses expand onto the same day of month across month ends; past occurrences skipped; paid skipped", () => {
  const f = buildForecast({
    today: TODAY,
    opening_cash_paise: 0,
    buffer_paise: 0,
    expenses: [
      { id: 1, category: "salaries", amount_paise: L(1), due_on: "2026-10-01", recurring: "monthly", paid: false },
      { id: 2, category: "rent", amount_paise: L(2), due_on: "2026-10-05", recurring: "monthly", paid: false },
      { id: 3, category: "gst", amount_paise: L(3), due_on: "2026-10-20", recurring: "monthly", paid: false },
      { id: 4, category: "other", amount_paise: L(4), due_on: "2026-08-31", recurring: "monthly", paid: false },
      { id: 5, category: "other", amount_paise: L(5), due_on: "2026-12-05", recurring: "monthly", paid: false },
      { id: 6, category: "other", amount_paise: L(6), due_on: "2026-10-05", recurring: "monthly", paid: true },
      { id: 7, category: "electricity", amount_paise: L(7), due_on: "2026-10-15", recurring: null, paid: false },
    ],
  });
  const dates = (id) => f.weeks.flatMap((w) => w.outflows.filter((o) => o.expense_id === id).map((o) => o.date));
  assert.deepEqual(dates(1), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.deepEqual(dates(2), ["2026-11-05", "2026-12-05", "2027-01-05"]);
  assert.deepEqual(dates(3), ["2026-11-20", "2026-12-20", "2027-01-20"]);
  assert.deepEqual(dates(4), ["2026-10-31", "2026-11-30", "2026-12-31"]);
  assert.deepEqual(dates(5), ["2026-12-05", "2027-01-05"]);
  assert.deepEqual(dates(6), []);
  assert.deepEqual(dates(7), [TODAY], "unpaid past-due one-off bill is clamped to today");
  assert.equal(f.totals.outflow_paise, L(3 * 1 + 3 * 2 + 3 * 3 + 3 * 4 + 2 * 5 + 7));
  const feb = buildForecast({
    today: "2027-01-15",
    expenses: [{ id: 9, category: "other", amount_paise: 1, due_on: "2027-01-31", recurring: "monthly", paid: false }],
  });
  assert.deepEqual(feb.weeks.flatMap((w) => w.outflows.map((o) => o.date)), ["2027-01-31", "2027-02-28", "2027-03-31"]);
});

test("aging: due today is not_due; bucket edges at 30/31, 60/61, 90/91 days", () => {
  const b = agingBuckets(
    [
      inv(1, 1, "2026-11-01", 1),
      inv(2, 1, TODAY, 2),
      inv(3, 1, "2026-10-23", 4),
      inv(4, 1, "2026-09-24", 8),
      inv(5, 1, "2026-09-23", 16),
      inv(6, 1, "2026-08-25", 32),
      inv(7, 1, "2026-08-24", 64),
      inv(8, 1, "2026-07-26", 128),
      inv(9, 1, "2026-07-25", 256),
      inv(10, 1, "2026-01-01", 512),
      inv(11, 1, "2026-01-01", 1024, { status: "paid", outstanding_paise: 0 }),
      inv(12, 1, "2026-01-01", 2048, { status: "draft" }),
    ],
    TODAY,
  );
  assert.deepEqual(b, {
    not_due: { count: 2, amount_paise: L(3) },
    d1_30: { count: 2, amount_paise: L(12) },
    d31_60: { count: 2, amount_paise: L(48) },
    d61_90: { count: 2, amount_paise: L(192) },
    d90_plus: { count: 2, amount_paise: L(768) },
  });
});

test("reliability grades at the thresholds, with the reason in words", () => {
  const paid = (due_date, lateDays) => {
    const d = new Date(`${due_date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + lateDays);
    return { due_date, paid_on: d.toISOString().slice(0, 10) };
  };
  const history = (lateList) => lateList.map((late, i) => paid(`2026-0${1 + (i % 9)}-10`, late));
  const c = { id: 1 };

  assert.deepEqual(reliability(c, []), { grade: "B", avg_late_days: 0, pct_on_time: null, reason: "No payment history yet" });

  const nine = reliability(c, history([0, 0, 0, 0, 0, 0, 0, 0, 0, 20]));
  assert.deepEqual(nine, { grade: "A", avg_late_days: 2, pct_on_time: 90, reason: "Paid 9 of 10 invoices on time, average 2 days late" });

  assert.equal(reliability(c, history([0, 0, 0, 0, 25])).grade, "A", "pct 80 and avg 5 is still A");
  assert.equal(reliability(c, history([0, 0, 0, 0, 30])).grade, "B", "avg 6 drops to B");
  assert.equal(reliability(c, history([0, 0, 0, 0, 0, 0, 0, 1, 1, 1])).grade, "B", "pct 70 drops to B");
  assert.equal(reliability(c, history([0, 10])).grade, "B", "pct exactly 50 is B");
  assert.equal(reliability(c, history([0, 1, 1])).grade, "C", "pct 33 is C");
  assert.equal(reliability(c, history([0, 0, 0, 0, 0, 0, 0, 0, 0, 300])).grade, "B", "avg exactly 30 is B");
  assert.equal(reliability(c, history([0, 0, 0, 0, 0, 0, 0, 0, 0, 310])).grade, "C", "avg 31 is C");

  const early = reliability(c, [paid("2026-05-10", -10), paid("2026-06-10", 10)]);
  assert.deepEqual(early, { grade: "B", avg_late_days: 5, pct_on_time: 50, reason: "Paid 1 of 2 invoices on time, average 5 days late" });
  assert.equal(reliability(c, [paid("2026-05-10", 1)]).reason, "Paid 0 of 1 invoice on time, average 1 day late");
});

test("chase: large, old, grade-C, gap-covering invoice ranks first with the reason in words", () => {
  const invoices = [
    inv(42, 3, "2026-09-16", 120000), // 38 days overdue, grade C
    inv(43, 1, "2026-10-20", 5000), // 4 days overdue, grade A
    inv(44, 1, "2026-11-20", 20000), // not yet due
    inv(45, 2, "2026-10-01", 30000, { status: "disputed" }),
    inv(46, 1, "2026-09-01", 30000, { status: "paid", outstanding_paise: 0 }),
  ];
  const forecast = buildForecast({
    today: TODAY,
    opening_cash_paise: L(10000),
    buffer_paise: L(50000),
    customers,
    invoices,
    expenses: [{ id: 1, category: "salaries", amount_paise: L(130000), due_on: "2026-11-01", recurring: null, paid: false }],
  });
  assert.equal(forecast.first_shortfall_week, 1);
  assert.deepEqual(forecast.lowest, { index: 1, closing_paise: L(35000) });
  assert.deepEqual(forecast.cover_gap.map((g) => g.invoice_id), [42]);

  const top = chaseScore(invoices[0], customers[2], forecast, TODAY);
  assert.equal(top.reason, "₹1,20,000, 38 days overdue, customer usually pays 20 days late, covers the shortfall in week 2");
  assert.ok(top.score >= 70 && top.score <= 100, `score ${top.score}`);

  const small = chaseScore(invoices[1], customers[0], forecast, TODAY);
  assert.equal(small.reason, "₹5,000, 4 days overdue, customer usually pays on time");
  assert.ok(small.score < top.score);

  const list = chaseList(invoices, customers, forecast, TODAY);
  assert.deepEqual(list.map((r) => r.id), [42, 43], "disputed, paid and not-yet-due invoices are left out");
  assert.equal(list[0].customer_name, "Chronic Late");
  assert.equal(list[0].days_overdue, 38);
  assert.equal(list[0].score, top.score);
  assert.equal(list[0].reason, top.reason);
  assert.ok(list[0].reason.includes("₹1,20,000") && list[0].reason.includes("38 days"));
});

test("chase score: paise amounts, singular day, not-yet-due wording, no forecast", () => {
  const r = chaseScore(inv(1, 1, "2026-10-23", 999.5), { id: 1, avg_late_days: 1 }, null, TODAY);
  assert.equal(r.reason, "₹999.50, 1 day overdue, customer usually pays 1 day late");
  assert.equal(chaseScore(inv(1, 1, "2026-10-27", 100), undefined, null, TODAY).reason, "₹100, due in 3 days, customer usually pays on time");
  assert.equal(chaseScore(inv(1, 1, TODAY, 100), undefined, null, TODAY).reason, "₹100, due today, customer usually pays on time");
  const c = chaseScore(inv(1, 1, "2026-10-23", 100), { id: 1, avg_late_days: 40 }, null, TODAY);
  const a = chaseScore(inv(1, 1, "2026-10-23", 100), { id: 1, avg_late_days: 0 }, null, TODAY);
  assert.equal(c.score - a.score, 15, "grade C derived from avg_late_days adds urgency");
});
