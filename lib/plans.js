// Instalment plans: a customer offers to pay one bill in 2 or 3 parts. Pure rules, no database.
// The part now due is carried as the bill's open promise, so reminders pause, the forecast moves, and a missed part
// breaks the promise and restarts reminders exactly as a broken promise does today.
import { addDays, daysBetween, isISODate } from "./time.js";
import { PROMISE_MAX_DAYS } from "./ladder.js";

export const PLAN_MAX_DAYS = 60; // the last part within 60 days of today
export const PLAN_MIN_PART_PAISE = 50_000; // ₹500
export const PLAN_PARTS = [2, 3];

const fail = (code, message) => ({ ok: false, error: { code, message } });

// parts: [{ date: 'YYYY-MM-DD', amount_paise }] in order. They must add up to exactly what is still owed.
export function validatePlan(parts, { outstanding_paise, today, maxDays = PLAN_MAX_DAYS }) {
  if (!Array.isArray(parts) || !PLAN_PARTS.includes(parts.length)) return fail("plan_parts", "Choose 2 or 3 parts");
  let prev = today;
  let sum = 0;
  for (const [i, p] of parts.entries()) {
    if (!isISODate(p?.date)) return fail("invalid_date", "Each part needs a date");
    if (p.date <= prev) return fail("plan_date_order", i === 0 ? "The first part must be after today" : "Each part must come after the one before");
    if (!Number.isSafeInteger(p.amount_paise) || p.amount_paise < PLAN_MIN_PART_PAISE) return fail("plan_part_small", "Each part must be at least ₹500");
    sum += p.amount_paise;
    prev = p.date;
  }
  if (daysBetween(today, parts[0].date) > PROMISE_MAX_DAYS) return fail("plan_first_far", `The first part must be within ${PROMISE_MAX_DAYS} days`);
  if (daysBetween(today, prev) > maxDays) return fail("plan_too_far", `The last part must be within ${maxDays} days`);
  if (sum !== outstanding_paise) return fail("plan_sum", "The parts must add up to the amount still owed");
  return { ok: true, parts: parts.map((p) => ({ date: p.date, amount_paise: p.amount_paise })) };
}

// Whether a bill can be split at all: n parts of at least ₹500 each.
export const canSplit = (outstanding_paise, n = 2) => Number.isSafeInteger(outstanding_paise) && outstanding_paise >= n * PLAN_MIN_PART_PAISE;

// The offer the pay page starts from: n near-equal parts in whole rupees (the last takes the rest), in 7 days and then every 2 weeks.
export function suggestParts(outstanding_paise, today, n = 2) {
  const each = Math.floor(outstanding_paise / n / 100) * 100;
  return Array.from({ length: n }, (_, i) => ({
    date: addDays(today, 7 + 14 * i),
    amount_paise: i === n - 1 ? outstanding_paise - each * (n - 1) : each,
  }));
}

// The parts still to come, with what is left of each (the first may be part paid). The last is trued up so the parts add
// up to what is still owed (a credit note or a rounding difference never leaves money missing from the forecast).
export function remainingParts(parts, paidSince, outstanding_paise) {
  const left = [];
  let upTo = 0;
  for (const p of parts) {
    const before = upTo;
    upTo += p.amount_paise;
    if (paidSince >= upTo) continue;
    left.push({ date: p.date, amount_paise: upTo - Math.max(before, paidSince) });
  }
  if (!left.length) return outstanding_paise > 0 ? [{ date: parts.at(-1).date, amount_paise: outstanding_paise }] : [];
  const others = left.slice(0, -1).reduce((s, p) => s + p.amount_paise, 0);
  left.at(-1).amount_paise = Math.max(0, outstanding_paise - others);
  return left.filter((p) => p.amount_paise > 0);
}

// The part to pay next (1-based number, its date and what is left of it), or null when every part is paid.
export function nextDue(parts, paidSince) {
  let upTo = 0;
  for (const [i, p] of parts.entries()) {
    const before = upTo;
    upTo += p.amount_paise;
    if (paidSince < upTo) return { number: i + 1, of: parts.length, date: p.date, amount_paise: upTo - Math.max(before, paidSince) };
  }
  return null;
}

// Each part, marked paid once the money received since the plan began covers it and every part before it.
export function progress(parts, paidSince) {
  let upTo = 0;
  return parts.map((p) => {
    upTo += p.amount_paise;
    return { ...p, paid: paidSince >= upTo };
  });
}
