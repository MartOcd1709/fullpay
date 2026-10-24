const TONE = { A: "bg-success-soft text-success", B: "bg-warning-soft text-warning", C: "bg-error-soft text-error" };

// Reliability grade as letter + word, never colour alone.
export function Grade({ grade, T }) {
  const g = TONE[grade] ? grade : "B";
  return (
    <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold ${TONE[g]}`}>
      <span aria-hidden="true" className="tnum">{g}</span>
      <span>{T(`pages.cust.grade_${g}`)}</span>
    </span>
  );
}

export function gradeReason(c, T) {
  if (!Number.isFinite(c.pct_on_time) || c.reason === "No payment history yet") return T("customers.grade_new");
  return T("customers.grade_reason", { pct: Math.round(c.pct_on_time), days: Math.round(c.avg_late_days ?? 0) });
}

// "Usually pays on Mondays · best day to remind: Sun 25 Oct" (null when there is no clear habit yet).
export function habitText(c, T) {
  const p = c?.pay_pattern;
  if (!p) return null;
  const habit = p.kind === "weekday"
    ? T("pages.habit.weekday", { day: T(`pages.habit.dow.${p.weekday}`) })
    : T("pages.habit.month", { from: ordinal(p.from, T.lang), to: ordinal(p.to, T.lang) });
  const b = c.best_reminder;
  const when = b ? (b.now ? T("pages.habit.now") : T("pages.habit.remind_on", { date: T.date(b.remind_on) })) : null;
  return when ? `${habit} · ${when}` : habit;
}

function ordinal(n, lang) {
  if (lang === "hi") return String(n);
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${s}`;
}
