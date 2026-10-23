// 13-week cash forecast, what-ifs, cover-the-gap, ageing, reliability and the chase score. Pure: plain data in, plain data out.

import { addDays, addMonths, daysBetween } from "./time.js";
import { fmtINR } from "./money.js";

const laterOf = (a, b) => (a > b ? a : b);

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const indexById = (rows) => new Map(rows.map((r) => [String(r.id), r]));
const sum = (rows, key) => rows.reduce((acc, r) => acc + r[key], 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const isUnpaid = (inv) => inv.outstanding_paise > 0 && inv.status !== "paid" && inv.status !== "draft";

export function expectedInflowDate(invoice, customer, today) {
  const avgLate = Math.round(customer?.avg_late_days ?? 0);
  const expected = invoice.promise_date ?? addDays(invoice.due_date, avgLate);
  return laterOf(today, expected);
}

function expenseDates(expense, today, end) {
  if (expense.recurring !== "monthly") return expense.due_on < end ? [laterOf(today, expense.due_on)] : [];
  const dates = [];
  for (let n = 0; ; n++) {
    const date = addMonths(expense.due_on, n);
    if (date >= end) return dates;
    if (date >= today) dates.push(date);
  }
}

const byDateThenAmount = (a, b) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : b.amount_paise - a.amount_paise;

const byDueThenAmount = (a, b) =>
  a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : b.outstanding_paise - a.outstanding_paise;

// Only invoices expected after the first short week can help: collecting one today lifts every week before its expected week.
function coverGap(rows, candidates, buffer, from) {
  const need = rows.map((w) => Math.max(0, buffer - w.closing_paise));
  const picked = [];
  for (const { week, ...inv } of candidates.filter((c) => c.week > from).sort(byDueThenAmount)) {
    const reach = Math.min(week, rows.length);
    if (!need.slice(from, reach).some((n) => n > 0)) continue;
    for (let i = 0; i < reach; i++) need[i] = Math.max(0, need[i] - inv.outstanding_paise);
    picked.push(inv);
  }
  return { picked, uncovered_paise: Math.max(0, ...need) };
}

export function buildForecast({
  today,
  opening_cash_paise = 0,
  buffer_paise = 0,
  invoices = [],
  customers = [],
  expenses = [],
  weeks = 13,
  whatIf = {},
}) {
  const { late_customer_id = null, big_order = null } = whatIf;
  const late_days = Number(whatIf.late_days ?? 30);
  const supplier_delay_days = Number(whatIf.supplier_delay_days ?? 0);
  const end = addDays(today, weeks * 7);
  const customerById = indexById(customers);
  const unpaid = invoices.filter(isUnpaid);

  const inflows = unpaid.map((inv) => {
    let date = expectedInflowDate(inv, customerById.get(String(inv.customer_id)), today);
    if (sameId(inv.customer_id, late_customer_id)) date = laterOf(today, addDays(date, late_days));
    return { invoice_id: inv.id, number: inv.number, customer_id: inv.customer_id, amount_paise: inv.outstanding_paise, date };
  });
  const orderWeek = Number(big_order?.week_index);
  if (big_order && Number.isInteger(orderWeek) && orderWeek >= 0 && orderWeek < weeks) {
    inflows.push({
      invoice_id: null,
      number: "What-if: big order",
      customer_id: null,
      amount_paise: big_order.amount_paise,
      date: addDays(today, orderWeek * 7),
    });
  }

  const outflows = expenses
    .filter((e) => !e.paid)
    .flatMap((e) =>
      expenseDates(e, today, end).map((date) => ({
        expense_id: e.id,
        category: e.category,
        amount_paise: e.amount_paise,
        date: e.category === "supplier" && supplier_delay_days ? laterOf(today, addDays(date, supplier_delay_days)) : date,
      })),
    );

  const weekOf = (row) => Math.floor(daysBetween(today, row.date) / 7);
  const rows = [];
  let opening = opening_cash_paise;
  for (let index = 0; index < weeks; index++) {
    const weekIn = inflows.filter((r) => weekOf(r) === index).sort(byDateThenAmount);
    const weekOut = outflows.filter((r) => weekOf(r) === index).sort(byDateThenAmount);
    const inflow_paise = sum(weekIn, "amount_paise");
    const outflow_paise = sum(weekOut, "amount_paise");
    const closing_paise = opening + inflow_paise - outflow_paise;
    rows.push({
      index,
      start: addDays(today, index * 7),
      end: addDays(today, index * 7 + 6),
      opening_paise: opening,
      inflow_paise,
      outflow_paise,
      closing_paise,
      inflows: weekIn,
      outflows: weekOut,
      below_buffer: closing_paise < buffer_paise,
    });
    opening = closing_paise;
  }

  const first_shortfall_week = rows.find((w) => w.below_buffer)?.index ?? null;
  const low = rows.reduce((best, w) => (w.closing_paise < best.closing_paise ? w : best), rows[0]);
  const lowest = { index: low.index, closing_paise: low.closing_paise };
  const after_window_inflows = inflows.filter((r) => weekOf(r) >= weeks).sort(byDateThenAmount);
  const candidates = unpaid.map((inv, i) => ({
    invoice_id: inv.id,
    number: inv.number,
    customer_id: inv.customer_id,
    outstanding_paise: inv.outstanding_paise,
    due_date: inv.due_date,
    week: weekOf(inflows[i]),
  }));
  const gap = first_shortfall_week === null ? { picked: [], uncovered_paise: 0 } : coverGap(rows, candidates, buffer_paise, first_shortfall_week);
  return {
    today,
    buffer_paise,
    weeks: rows,
    first_shortfall_week,
    lowest,
    gap_paise: Math.max(0, buffer_paise - lowest.closing_paise),
    cover_gap: gap.picked,
    gap_uncovered_paise: gap.uncovered_paise,
    totals: {
      inflow_paise: sum(rows, "inflow_paise"),
      outflow_paise: sum(rows, "outflow_paise"),
      after_window_inflow_paise: sum(after_window_inflows, "amount_paise"),
    },
    after_window_inflows,
    outstanding_paise: sum(unpaid, "outstanding_paise"),
  };
}

// Due today (0 days overdue) is not_due — pinned; ERPNext puts it in the first overdue bucket.
const bucketOf = (days) =>
  days <= 0 ? "not_due" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "d90_plus";

export function agingBuckets(invoices, today) {
  const buckets = {};
  for (const key of ["not_due", "d1_30", "d31_60", "d61_90", "d90_plus"]) buckets[key] = { count: 0, amount_paise: 0 };
  for (const inv of invoices.filter(isUnpaid)) {
    const bucket = buckets[bucketOf(daysBetween(inv.due_date, today))];
    bucket.count += 1;
    bucket.amount_paise += inv.outstanding_paise;
  }
  return buckets;
}

const RELIABILITY = { a_min_pct_on_time: 80, a_max_avg_late: 5, c_max_pct_on_time: 50, c_min_avg_late: 30 };

// With `today`, invoices still unpaid past due count as late so far (a lower bound), so a customer who never pays is not graded B.
export function reliability(customer, invoices = [], { today = null, thresholds = {} } = {}) {
  const t = { ...RELIABILITY, ...thresholds };
  const history = invoices.filter((h) => h.due_date && (h.paid_on || (today && h.due_date < today)));
  if (history.length === 0) return { grade: "B", avg_late_days: 0, pct_on_time: null, reason: "No payment history yet" };
  const lateDays = history.map((h) => Math.max(0, daysBetween(h.due_date, h.paid_on || today)));
  const onTime = lateDays.filter((d) => d === 0).length;
  const open = history.filter((h) => !h.paid_on).length;
  const avg_late_days = Math.round(lateDays.reduce((a, b) => a + b, 0) / history.length);
  const pct_on_time = Math.round((onTime / history.length) * 100);
  const grade =
    pct_on_time >= t.a_min_pct_on_time && avg_late_days <= t.a_max_avg_late
      ? "A"
      : pct_on_time < t.c_max_pct_on_time || avg_late_days > t.c_min_avg_late
        ? "C"
        : "B";
  const reason =
    `Paid ${onTime} of ${plural(history.length, "invoice")} on time, average ${plural(avg_late_days, "day")} late` +
    (open ? `, ${plural(open, "invoice")} still unpaid past due` : "");
  return { grade, avg_late_days, pct_on_time, reason };
}

const gradeFromAvgLate = (avg) => (avg > 30 ? "C" : avg > 5 ? "B" : "A");
const GRADE_POINTS = { A: 0, B: 5, C: 15 };

const formatINR = (paise) => fmtINR(paise, { paise: paise % 100 !== 0 });

const overdueText = (days) =>
  days > 0 ? `${plural(days, "day")} overdue` : days === 0 ? "due today" : `due in ${plural(-days, "day")}`;

const payerText = (customer) => {
  const avg = Math.round(customer?.avg_late_days ?? 0);
  return avg > 0 ? `customer usually pays ${plural(avg, "day")} late` : "customer usually pays on time";
};

export function chaseScore(invoice, customer, forecast, today) {
  const daysOverdue = daysBetween(invoice.due_date, today);
  const total = forecast?.outstanding_paise || invoice.outstanding_paise;
  const share = total > 0 ? invoice.outstanding_paise / total : 0;
  const amountScore = share > 0 ? clamp(1 + Math.log10(share) / 2, 0, 1) : 0; // 10% of the book = half points, 1% = none
  const overdueScore = clamp(daysOverdue / 90, 0, 1);
  const grade = customer?.grade ?? gradeFromAvgLate(customer?.avg_late_days ?? 0);
  const inGap = (forecast?.cover_gap ?? []).some((g) => sameId(g.invoice_id, invoice.id));
  const score = Math.round(35 * amountScore + 30 * overdueScore + (Object.hasOwn(GRADE_POINTS, grade) ? GRADE_POINTS[grade] : 0) + (inGap ? 20 : 0));
  const parts = [formatINR(invoice.outstanding_paise), overdueText(daysOverdue), payerText(customer)];
  if (inGap) parts.push(`covers the shortfall in week ${forecast.first_shortfall_week + 1}`);
  return { score: clamp(score, 0, 100), reason: parts.join(", ") };
}

export function chaseList(invoices, customers, forecast, today) {
  const customerById = indexById(customers);
  return invoices
    .filter((inv) => isUnpaid(inv) && inv.status !== "disputed" && daysBetween(inv.due_date, today) > 0)
    .map((inv) => {
      const customer = customerById.get(String(inv.customer_id));
      return {
        ...inv,
        customer_name: customer?.name ?? null,
        days_overdue: daysBetween(inv.due_date, today),
        ...chaseScore(inv, customer, forecast, today),
      };
    })
    .sort((a, b) => b.score - a.score || b.outstanding_paise - a.outstanding_paise);
}

export function dashboard(ctx) {
  const { today, invoices = [], customers = [], opening_cash_paise = 0 } = ctx;
  const forecast = buildForecast({ ...ctx, whatIf: {} });
  const unpaid = invoices.filter(isUnpaid);
  const monthEnd = addDays(addMonths(`${today.slice(0, 8)}01`, 1), -1);
  const next30 = addDays(today, 30);
  const inflows = forecast.weeks.flatMap((w) => w.inflows).concat(forecast.after_window_inflows);
  const outflows = forecast.weeks.flatMap((w) => w.outflows);
  return {
    to_collect_paise: sum(unpaid, "outstanding_paise"),
    overdue_paise: sum(unpaid.filter((inv) => inv.due_date < today), "outstanding_paise"),
    expected_this_week_paise: forecast.weeks[0]?.inflow_paise ?? 0,
    expected_this_month_paise: sum(inflows.filter((r) => r.date <= monthEnd), "amount_paise"),
    bills_next_30_paise: sum(outflows.filter((r) => r.date < next30), "amount_paise"),
    cash_in_bank_paise: opening_cash_paise,
    forecast_low: forecast.lowest,
    aging: agingBuckets(invoices, today),
    top_chase: chaseList(invoices, customers, forecast, today).slice(0, 5),
  };
}
