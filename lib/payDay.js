import { addDays, weekdayOf } from "./time.js";
// When does a customer usually pay? From their past payment dates (IST 'YYYY-MM-DD'), one of:
//   { kind: "weekday", weekday: 0-6 (Sun-Sat), share, n }   — at least 60% of payments on one weekday
//   { kind: "month",   from: 1-31, to: 1-31, share, n }       — at least 70% within one 7-day stretch of the month
// or null when there are fewer than 3 payment days or no clear habit. Pure.

const dow = weekdayOf;
const dom = (iso) => Number(iso.slice(8, 10));

export function payPattern(dates) {
  const days = [...new Set((dates ?? []).filter(Boolean))].sort();
  const n = days.length;
  if (n < 3) return null;
  const byDow = new Array(7).fill(0);
  for (const d of days) byDow[dow(d)]++;
  const top = byDow.indexOf(Math.max(...byDow));
  const weekday = { kind: "weekday", weekday: top, share: byDow[top] / n, n };
  let month = null;
  for (let from = 1; from <= 25; from++) {
    const hits = days.filter((d) => dom(d) >= from && dom(d) <= from + 6).length;
    if (!month || hits > month.hits) month = { from, hits };
  }
  const inWindow = days.filter((d) => dom(d) >= month.from && dom(d) <= month.from + 6).map(dom);
  const monthP = { kind: "month", from: Math.min(...inWindow), to: Math.max(...inWindow), share: month.hits / n, n };
  const okW = weekday.share >= 0.6, okM = monthP.share >= 0.7;
  if (okM && (!okW || monthP.share >= weekday.share)) return monthP;
  return okW ? weekday : null;
}

// The day to send a reminder so it lands just before the usual payment day: the day before the next such day.
export function bestReminderDay(pattern, today) {
  if (!pattern) return null;
  const add = addDays;
  // Already inside the usual week of the month: now is the time.
  if (pattern.kind === "month" && dom(today) >= pattern.from && dom(today) <= pattern.to) return { pay_day: today, remind_on: today, now: true };
  for (let k = 1; k <= 40; k++) {
    const d = add(today, k);
    if (pattern.kind === "weekday" ? dow(d) === pattern.weekday : dom(d) === pattern.from) return { pay_day: d, remind_on: add(d, -1) };
  }
  return null;
}
