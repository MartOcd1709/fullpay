import { fmtINR } from "@/lib/money";

export function Money({ paise, showPaise = true, className = "" }) {
  const text = Number.isSafeInteger(paise) ? fmtINR(paise, { paise: showPaise }) : "—";
  return <span className={`tnum whitespace-nowrap ${className}`}>{text}</span>;
}

export default Money;
