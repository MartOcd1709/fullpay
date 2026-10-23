// Server-safe building blocks shared by the collections screens (no hooks, no browser APIs).
import { t } from "@/lib/i18n";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";

export const tr = (lang) => (key, vars) => t(key, lang, vars);

export const inr = (paise, withPaise = false) => (Number.isSafeInteger(paise) ? fmtINR(paise, { paise: withPaise && paise % 100 !== 0 }) : "—");

export const date = (iso, lang) => (iso ? formatDate(String(iso).slice(0, 10), lang) : "—");

// "₹20.46 lakh" under a hero number; nothing below one lakh.
export function lakh(paise, lang) {
  if (!Number.isSafeInteger(paise) || Math.abs(paise) < 1e7) return null;
  const n = Math.round(Math.abs(paise) / 1e5) / 100;
  return t("collect.lakh", lang, { n: `${paise < 0 ? "−" : ""}${n}` });
}

export function Amount({ paise, lang, hero = false, className = "" }) {
  const sub = hero ? lakh(paise, lang) : null;
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`tnum whitespace-nowrap font-semibold ${hero ? "text-2xl sm:text-3xl" : ""} ${paise < 0 ? "text-error" : ""}`}>{inr(paise)}</span>
      {sub && <span className="text-sm font-normal text-ink-muted">{sub}</span>}
    </span>
  );
}

export const Chip = ({ tone, label, className = "" }) => <StatusPill status={tone} label={label} className={className} />;

// "29 days overdue" / "due today" / "due in 3 days"
export function lateText(days, lang) {
  if (days > 0) return t("collect.days_overdue", lang, { n: days });
  if (days === 0) return t("collect.due_today", lang);
  return t("collect.due_in", lang, { n: -days });
}

export function ErrorState({ lang, error, retryHref }) {
  const T = tr(lang);
  return (
    <section role="alert" className="rounded-xl border border-error bg-error-soft p-5 text-ink">
      <h2 className="text-lg font-semibold text-error">{T("collect.error_title")}</h2>
      <p className="mt-1">{error?.message || T("error.generic")}</p>
      {error?.code && <p className="mt-1 font-mono text-sm text-ink-muted">{error.code}</p>}
      {retryHref && (
        <a href={retryHref} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-accent px-5 font-semibold text-on-accent no-underline hover:bg-accent-strong">
          {T("btn.retry")}
        </a>
      )}
    </section>
  );
}

export function LoadingRows({ label = "Loading…", rows = 3 }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div className="h-9 w-2/3 max-w-sm animate-pulse rounded-lg bg-surface-2" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-5">
          <div className="h-5 w-1/2 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-surface-2" />
          <div className="mt-4 h-12 w-40 animate-pulse rounded-xl bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ children, count, id }) {
  return (
    <h2 id={id} className="mb-3 mt-8 flex items-center gap-2 text-xl font-semibold first:mt-0">
      {children}
      {count != null && <span className="tnum rounded-full bg-surface-2 px-2.5 py-0.5 text-base font-semibold text-ink-muted">{count}</span>}
    </h2>
  );
}

// wa.me needs digits only with the country code; a bare 10-digit Indian number gets 91.
export function waDigits(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d.length >= 11 ? d : null;
}

export const payUrl = (token) => (token ? `${(process.env.APP_URL || "").replace(/\/$/, "")}/pay/${token}` : null);
