const TONE = {
  paid: "success", confirmed: "success", kept: "success", intact: "success", A: "success", success: "success",
  due_soon: "warning", part_paid: "warning", pending: "warning", awaiting_owner: "warning", queued: "warning",
  snoozed: "warning", promised: "warning", B: "warning", warning: "warning",
  overdue: "error", disputed: "error", failed: "error", rejected: "error", broken: "error", C: "error", error: "error",
  sent: "info", info: "info",
  draft: "neutral", cancelled: "neutral", neutral: "neutral",
};

const WORD = {
  draft: "Draft", sent: "Sent", due_soon: "Due soon", overdue: "Overdue", part_paid: "Part paid", paid: "Paid",
  disputed: "Disputed", pending: "Pending", confirmed: "Confirmed", rejected: "Rejected", queued: "Queued",
  awaiting_owner: "Needs your tap", failed: "Failed", kept: "Promise kept", broken: "Promise broken",
  snoozed: "Snoozed", promised: "Promise to pay", cancelled: "Cancelled", intact: "Intact",
  A: "Grade A", B: "Grade B", C: "Grade C", success: "OK", warning: "Attention", error: "Problem", info: "Info", neutral: "—",
};

const STYLE = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-ink-muted",
};

const GLYPH = {
  success: <path d="M5 12.5 9.5 17 19 7" />,
  warning: <path d="M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5" />,
  error: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5m0 3v.5" />,
  info: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8v.5" />,
  neutral: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
};

export function StatusPill({ status, label, className = "" }) {
  const tone = TONE[status] ?? "neutral";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold leading-tight ${STYLE[tone]} ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {GLYPH[tone]}
      </svg>
      <span>{label ?? WORD[status] ?? String(status)}</span>
    </span>
  );
}

export default StatusPill;
