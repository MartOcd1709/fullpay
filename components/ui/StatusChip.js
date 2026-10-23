import Icon from "./Icon";
import { t } from "@/lib/i18n";

// Every status is icon + word, never colour alone (K19). Words live in i18n as core.chip.<status>.
const MAP = {
  draft: ["draft", "neutral"],
  sent: ["send", "info"],
  not_due: ["clock", "info"],
  due_soon: ["bellRing", "warning"],
  overdue: ["alert", "error"],
  part_paid: ["circleDot", "warning"],
  paid: ["check", "success"],
  disputed: ["dispute", "info"],
  promise: ["handshake", "info"],
  promise_broken: ["handshakeOff", "error"],
  promise_kept: ["handshake", "success"],
  snoozed: ["snooze", "info"],
  paused: ["snooze", "info"],
  failed: ["mailX", "error"],
  intact: ["shieldCheck", "success"],
  altered: ["shieldAlert", "error"],
  unchecked: ["shieldQuestion", "warning"],
  opt_out: ["eyeOff", "neutral"],
  anonymized: ["lock", "neutral"],
  grade_A: ["check", "success"],
  grade_B: ["clock", "warning"],
  grade_C: ["alert", "error"],
  auto: ["sparkle", "info"],
  manual: ["user", "neutral"],
  // The six ladder rungs
  heads_up: ["bell", "info"],
  due_date: ["calendar", "info"],
  overdue_gentle: ["mail", "warning"],
  overdue_firm: ["phone", "warning"],
  demand_letter: ["letter", "error"],
  odr_guidance: ["scale", "error"],
};

const STYLE = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-ink-muted",
};

export function StatusChip({ status, lang = "en", label, days, className = "" }) {
  const [icon, tone] = MAP[status] ?? ["info", "neutral"];
  let word = label ?? t(`core.chip.${status}`, lang);
  if (status === "overdue" && Number.isInteger(days) && days > 0 && !label) word = t("core.chip.overdue_days", lang, { n: days });
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold leading-tight ${STYLE[tone]} ${className}`}>
      <Icon name={icon} className="h-4 w-4" strokeWidth={2.25} />
      <span>{word}</span>
    </span>
  );
}

export const chipTone = (status) => (MAP[status] ?? [null, "neutral"])[1];

export default StatusChip;
