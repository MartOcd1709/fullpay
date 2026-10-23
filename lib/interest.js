const DAY_MS = 86_400_000;
const DAYS_IN_YEAR = 365;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const err = (code, message) => Object.assign(new Error(message), { code });

const toMs = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const isDate = (d) => typeof d === "string" && ISO_DATE.test(d) && fromMs(toMs(d)) === d;
const addDays = (d, n) => fromMs(toMs(d) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

function addMonths(d, n) {
  const [y, m, day] = d.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return fromMs(first.getTime());
}

function assertDate(d, name) {
  if (!isDate(d)) throw err("INVALID_INPUT", `${name} must be a YYYY-MM-DD date`);
}

function assertPaise(n, name) {
  if (!Number.isSafeInteger(n) || n < 0) throw err("INVALID_INPUT", `${name} must be a non-negative integer`);
}

function validate(input) {
  assertPaise(input.principal_paise, "principal_paise");
  assertDate(input.due_date, "due_date");
  assertDate(input.as_of, "as_of");
  if (!Array.isArray(input.series)) throw err("INVALID_INPUT", "series must be an array");
  input.series.forEach((s, i) => {
    assertDate(s.from, `series[${i}].from`);
    assertPaise(s.bps, `series[${i}].bps`);
  });
  input.allocations.forEach((a, i) => {
    assertDate(a.date, `allocations[${i}].date`);
    assertPaise(a.amount_paise, `allocations[${i}].amount_paise`);
  });
  input.dispute_spans.forEach((s, i) => {
    assertDate(s.from, `dispute_spans[${i}].from`);
    if (s.to != null) assertDate(s.to, `dispute_spans[${i}].to`);
  });
  if (!Number.isSafeInteger(input.multiplier) || input.multiplier < 1) {
    throw err("INVALID_INPUT", "multiplier must be a positive integer");
  }
  if (!["interest_first", "principal_first"].includes(input.appropriation)) {
    throw err("INVALID_INPUT", "appropriation must be interest_first or principal_first");
  }
  if (input.day_count !== "actual/365") throw err("INVALID_INPUT", "day_count must be actual/365");
}

function restDates(due_date, as_of) {
  const rests = [];
  for (let n = 1; ; n++) {
    const rest = addMonths(due_date, n);
    if (rest > as_of) return rests;
    rests.push(rest);
  }
}

function bankRateAt(series, day) {
  return series.findLast((s) => s.from <= day).bps;
}

function inDispute(spans, day) {
  return spans.some((s) => s.from <= day && (s.to == null || day < s.to));
}

function groupAllocations(allocations, start_date, as_of) {
  const byDate = new Map();
  for (const a of allocations) {
    if (a.date > as_of) continue;
    const key = a.date < start_date ? start_date : a.date;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(a);
  }
  return byDate;
}

function applyAllocation(st, { date, amount_paise }, appropriation) {
  let left = amount_paise;
  const take = (key) => {
    const paid = Math.min(left, st[key]);
    st[key] -= paid;
    left -= paid;
    return paid;
  };
  // Gurpreet Singh v Union of India (SC 2006): part-payments go first towards interest, then principal.
  const order =
    appropriation === "principal_first"
      ? ["principal", "capitalised", "accrued"]
      : ["accrued", "capitalised", "principal"];
  const paid = Object.fromEntries(order.map((key) => [key, take(key)]));
  st.overpaid += left;
  st.applied.push({
    date,
    amount_paise,
    to_interest_paise: paid.accrued + paid.capitalised,
    to_principal_paise: paid.principal,
  });
}

function segmentInterest(base_paise, rate_bps, days) {
  const numerator = base_paise * rate_bps * days;
  if (!Number.isSafeInteger(numerator)) throw err("AMOUNT_TOO_LARGE", "interest numerator exceeds safe integer range");
  return Math.round(numerator / (10_000 * DAYS_IN_YEAR));
}

function collectBoundaries({ start_date, as_of, rests, series, byDate, spans }) {
  const bounds = new Set([start_date, addDays(as_of, 1)]);
  const add = (d) => {
    if (d != null && d > start_date && d <= as_of) bounds.add(d);
  };
  rests.forEach(add);
  series.forEach((s) => add(s.from));
  [...byDate.keys()].forEach(add);
  spans.forEach((s) => {
    add(s.from);
    add(s.to);
  });
  return [...bounds].sort();
}

function summarise({ start_date, as_of, segments, rests, st, total_interest_paise, convention }) {
  return {
    start_date,
    as_of,
    segments,
    rests,
    allocations_applied: st.applied,
    total_interest_paise,
    unpaid_interest_paise: st.capitalised + st.accrued,
    outstanding_principal_paise: st.principal,
    total_due_paise: st.principal + st.capitalised + st.accrued,
    overpaid_paise: st.overpaid,
    convention,
  };
}

export function computeInterest({
  principal_paise,
  due_date,
  as_of,
  series,
  multiplier = 3,
  allocations = [],
  dispute_spans = [],
  appropriation = "interest_first",
  day_count = "actual/365",
}) {
  validate({ principal_paise, due_date, as_of, series, multiplier, allocations, dispute_spans, appropriation, day_count });
  const start_date = addDays(due_date, 1);
  const convention = {
    day_count,
    multiplier,
    rests: "monthly from due date",
    rate_switch: "on the RBI change date",
    dispute: "0% during owner-accepted disputes",
    appropriation,
  };
  const st = { principal: principal_paise, capitalised: 0, accrued: 0, overpaid: 0, applied: [] };
  const sortedAllocations = [...allocations].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = groupAllocations(sortedAllocations, start_date, as_of);

  if (as_of < start_date) {
    [...byDate.values()].flat().forEach((a) => applyAllocation(st, a, appropriation));
    return summarise({ start_date, as_of, segments: [], rests: [], st, total_interest_paise: 0, convention });
  }

  const sortedSeries = [...series].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  if (!sortedSeries.length || sortedSeries[0].from > start_date) {
    throw err("RATE_SERIES_GAP", `RBI Bank Rate series does not cover ${start_date}`);
  }
  const rests = restDates(due_date, as_of);
  const restSet = new Set(rests);
  const bounds = collectBoundaries({ start_date, as_of, rests, series: sortedSeries, byDate, spans: dispute_spans });
  const end = bounds[bounds.length - 1];

  const segments = [];
  let total_interest_paise = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (restSet.has(from)) {
      st.capitalised += st.accrued;
      st.accrued = 0;
    }
    (byDate.get(from) ?? []).forEach((a) => applyAllocation(st, a, appropriation));
    const bank_rate_bps = bankRateAt(sortedSeries, from);
    const dispute = inDispute(dispute_spans, from);
    const rate_bps = dispute ? 0 : bank_rate_bps * multiplier;
    const days = daysBetween(from, to);
    const base_paise = st.principal + st.capitalised;
    const interest_paise = segmentInterest(base_paise, rate_bps, days);
    st.accrued += interest_paise;
    total_interest_paise += interest_paise;
    segments.push({ from, to: to === end ? as_of : to, days, base_paise, rate_bps, bank_rate_bps, interest_paise, dispute });
  }
  return summarise({ start_date, as_of, segments, rests, st, total_interest_paise, convention });
}

const FOOTNOTE = {
  en: {
    locale: "en-IN",
    month: "short",
    none: (asOf) => `No interest has accrued: the invoice was not yet overdue on ${asOf}.`,
    times: (m) => (m === 3 ? "three times" : `${m} times`),
    rests: (dates) => (dates.length ? ` (rests on ${dates.join(", ")})` : " (no monthly rest fell within this period)"),
    appropriation: {
      interest_first: "first towards interest and then towards principal",
      principal_first: "first towards principal and then towards interest",
    },
    text: (p) =>
      `Interest under s.16 of the MSMED Act, 2006 is charged at ${p.times} the RBI Bank Rate, compounded with monthly rests counted from the due date${p.rests}, on an actual/365 day count from ${p.start} to ${p.asOf} (${p.days} days). ` +
      `When the RBI changes the Bank Rate, the new rate applies from the change date (V.K. Patel & Co v Simplex Infrastructures Ltd, Cal HC 2024). ` +
      `No interest is charged for any period of a dispute we have accepted. ` +
      `Part payments are appropriated ${p.appropriation} (Gurpreet Singh v Union of India, SC 2006).`,
  },
  hi: {
    locale: "hi-IN",
    month: "long",
    none: (asOf) => `${asOf} तक कोई ब्याज नहीं लगा है: बीजक इस तारीख तक अतिदेय नहीं था।`,
    times: (m) => (m === 3 ? "तीन गुना" : `${m} गुना`),
    rests: (dates) => (dates.length ? ` (चक्रवृद्धि की तारीखें: ${dates.join(", ")})` : " (इस अवधि में कोई मासिक अंतराल नहीं आया)"),
    appropriation: {
      interest_first: "पहले ब्याज में और फिर मूलधन में",
      principal_first: "पहले मूलधन में और फिर ब्याज में",
    },
    text: (p) =>
      `एमएसएमईडी अधिनियम, 2006 की धारा 16 के अंतर्गत ब्याज भारतीय रिज़र्व बैंक की बैंक दर के ${p.times} की दर से, नियत तारीख से मासिक अंतराल पर चक्रवृद्धि करते हुए${p.rests}, वास्तविक दिन/365 के आधार पर ${p.start} से ${p.asOf} तक (${p.days} दिन) गिना गया है। ` +
      `आरबीआई द्वारा बैंक दर बदलने पर नई दर बदलाव की तारीख से लागू होती है (वी.के. पटेल एंड कंपनी बनाम सिम्प्लेक्स इंफ्रास्ट्रक्चर्स लिमिटेड, कलकत्ता उच्च न्यायालय 2024)। ` +
      `हमारे द्वारा स्वीकार किए गए विवाद की अवधि के लिए कोई ब्याज नहीं लिया गया है। ` +
      `आंशिक भुगतान ${p.appropriation} समायोजित किए गए हैं (गुरप्रीत सिंह बनाम भारत संघ, सर्वोच्च न्यायालय 2006)।`,
  },
};

export function conventionFootnote(result, lang = "en") {
  const t = FOOTNOTE[lang] ?? FOOTNOTE.en;
  const fmt = new Intl.DateTimeFormat(t.locale, { day: "numeric", month: t.month, year: "numeric", timeZone: "UTC" });
  const date = (d) => fmt.format(new Date(toMs(d)));
  if (!result.segments.length) return t.none(date(result.as_of));
  return t.text({
    times: t.times(result.convention.multiplier ?? 3),
    rests: t.rests(result.rests.map(date)),
    start: date(result.start_date),
    asOf: date(result.as_of),
    days: result.segments.reduce((sum, s) => sum + s.days, 0),
    appropriation: t.appropriation[result.convention.appropriation] ?? t.appropriation.interest_first,
  });
}
