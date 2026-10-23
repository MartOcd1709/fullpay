import { fmtINR } from "@/lib/money";

// en-IN rupees; whole rupees by default unless there are paise. Negative amounts get the error colour plus a minus sign.
export function Money({ paise, showPaise, className = "" }) {
  if (!Number.isSafeInteger(paise)) return <span className={className}>—</span>;
  const text = fmtINR(paise, { paise: showPaise ?? paise % 100 !== 0 });
  return <span className={`tnum whitespace-nowrap ${paise < 0 ? "text-error" : ""} ${className}`}>{text}</span>;
}

export default Money;
