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
