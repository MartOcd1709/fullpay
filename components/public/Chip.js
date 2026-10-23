import Icon from "./Icon";

const TONES = {
  success: ["bg-success-soft text-success", "check"],
  warning: ["bg-warning-soft text-warning", "alert"],
  error: ["bg-error-soft text-error", "alert"],
  info: ["bg-info-soft text-info", "info"],
  neutral: ["bg-surface-2 text-ink-muted", "clock"],
};
const STATUS_TONE = { paid: "success", due_soon: "warning", part_paid: "warning", overdue: "error", disputed: "info", sent: "info", draft: "neutral" };

// Status is always icon + word, never colour alone.
export default function Chip({ tone, status, icon, children, className = "" }) {
  const [cls, glyph] = TONES[tone ?? STATUS_TONE[status] ?? "neutral"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold leading-tight ${cls} ${className}`}>
      <Icon name={icon ?? glyph} className="h-4 w-4" />
      <span>{children}</span>
    </span>
  );
}
