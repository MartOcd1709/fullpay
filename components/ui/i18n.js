import { t, tHint } from "@/lib/i18n";
import { fmtINR } from "@/lib/money";
import { formatDate, daysBetween } from "@/lib/time";

// T(key, vars) bound to one language, plus the formatting every screen shares.
export function makeT(lang = "en") {
  const T = (key, vars) => t(key, lang, vars);
  T.lang = lang;
  T.hint = (key) => tHint(key, lang);
  // Props for <Term>: plain label, the accounting term, and an optional one-line meaning ("<key>_meaning").
  T.term = (key, vars) => {
    const meaningKey = `${key}_meaning`;
    const meaning = t(meaningKey, lang, vars);
    return { label: t(key, lang, vars), term: tHint(key, lang), meaning: meaning === meaningKey ? "" : meaning, more: t("core.term_more", lang) };
  };
  T.money = (paise, { paise: withPaise = false } = {}) => (Number.isSafeInteger(paise) ? fmtINR(paise, { paise: withPaise || paise % 100 !== 0 }) : "—");
  T.date = (iso) => (iso ? formatDate(String(iso).slice(0, 10), lang) : "—");
  T.dateTime = (ts) => (ts ? dateTimeFmt[lang === "hi" ? "hi" : "en"].format(Date.parse(ts)) : "—");
  // "≈ 20.5 lakh" / "≈ 1.2 crore": owners think in lakhs (K21).
  T.lakh = (paise) => {
    if (!Number.isSafeInteger(paise) || Math.abs(paise) < 1e7) return "";
    const crore = Math.abs(paise) >= 1e9;
    const n = new Intl.NumberFormat("en-IN", { maximumFractionDigits: crore ? 2 : 1 }).format(paise / (crore ? 1e9 : 1e7));
    return t(crore ? "core.crore" : "core.lakh", lang, { n });
  };
  // Relative day words: "in 3 days", "today", "5 days ago".
  T.rel = (iso, asOf) => {
    const d = daysBetween(asOf, String(iso).slice(0, 10));
    if (d === 0) return t("core.rel_today", lang);
    if (d === 1) return t("core.rel_tomorrow", lang);
    return d > 0 ? t("core.rel_in", lang, { n: d }) : t("core.rel_ago", lang, { n: -d });
  };
  return T;
}

const dateTimeFmt = {
  en: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
  hi: new Intl.DateTimeFormat("hi-IN-u-nu-latn", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
};
