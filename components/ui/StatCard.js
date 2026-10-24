import Money from "./Money";
import Term from "./Term";
import Icon from "./Icon";

const TONE = {
  neutral: "border-line bg-surface",
  error: "border-error/40 bg-error-soft",
  warning: "border-warning/40 bg-warning-soft",
  success: "border-success/40 bg-success-soft",
  accent: "border-accent/30 bg-accent-soft",
};

// A labelled amount. `term` = props from T.term(key) so the label carries its accounting term (K18).
export function StatCard({ term, label, paise, sub, tone = "neutral", icon, className = "" }) {
  const body = (
    <>
      <div className="flex items-start gap-2 font-semibold leading-snug text-ink-muted">
        {icon && <Icon name={icon} className="mt-0.5 h-5 w-5" />}
        {term ? <Term {...term} /> : <span>{label}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold leading-tight sm:text-[1.75rem]">
        <Money paise={paise} />
      </p>
      {sub && <p className="mt-1 text-ink-muted">{sub}</p>}
    </>
  );
  return <div className={`flex min-h-[7.5rem] flex-col rounded-xl border p-4 ${TONE[tone] ?? TONE.neutral} ${className}`}>{body}</div>;
}

// Hero amount (K21): big number with a lakh sub-label and a context line.
export function AmountHero({ term, paise, lakh, sub, tone = "neutral", icon, className = "" }) {
  return (
    <div className={`flex min-h-[8.5rem] flex-col rounded-xl border p-4 sm:p-5 ${TONE[tone] ?? TONE.neutral} ${className}`}>
      <div className="flex items-start gap-2 text-lg font-semibold leading-snug">
        {icon && <Icon name={icon} className="mt-1 h-5 w-5" />}
        <Term {...term} />
      </div>
      <p className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
        <Money paise={paise} />
      </p>
      {lakh && <p className="tnum font-semibold text-ink-muted">{lakh}</p>}
      {sub && <p className="mt-1 text-ink-muted">{sub}</p>}
    </div>
  );
}

export default StatCard;
