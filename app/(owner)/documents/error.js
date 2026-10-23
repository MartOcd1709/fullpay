"use client";

import { t } from "@/lib/i18n";

// A crash in this screen shows a message, not a blank page (pack debug prompt "Blank white screen").
export default function Error({ reset, error }) {
  const lang = typeof document !== "undefined" && document.documentElement.lang === "hi" ? "hi" : "en";
  return (
    <section role="alert" className="rounded-xl border border-error/40 bg-error-soft p-5">
      <h2 className="text-lg font-semibold text-error">{t("core.err.screen_title", lang)}</h2>
      <p className="mt-1">{t("core.err.screen_body", lang)}</p>
      {error?.digest && <p className="mono mt-2 text-sm text-ink-muted">{t("core.err.reference", lang, { ref: error.digest })}</p>}
      <button type="button" onClick={() => reset()} className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-error px-5 font-semibold text-on-accent">
        {t("btn.retry", lang)}
      </button>
    </section>
  );
}
