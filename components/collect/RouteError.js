"use client";
import { useEffect } from "react";
import { t } from "@/lib/i18n";

// Route-level error boundary body: a crash in one screen shows this instead of a blank page.
export default function RouteError({ error, reset }) {
  const lang = typeof document !== "undefined" && document.documentElement.lang === "hi" ? "hi" : "en";
  useEffect(() => console.error(error), [error]);
  return (
    <section role="alert" className="rounded-xl border border-error bg-error-soft p-5">
      <h1 className="text-xl font-semibold text-error">{t("collect.error_title", lang)}</h1>
      <p className="mt-1">{t("error.generic", lang)}</p>
      {error?.digest && <p className="mt-1 font-mono text-sm text-ink-muted">{error.digest}</p>}
      <button type="button" onClick={reset} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong">
        {t("btn.retry", lang)}
      </button>
    </section>
  );
}
