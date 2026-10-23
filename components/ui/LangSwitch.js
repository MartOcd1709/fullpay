"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";

// EN | हिंदी, each in its own script. Sets the cookie (and config) and re-renders every string on the page.
export default function LangSwitch({ lang, label }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pick(next) {
    if (next === lang || busy) return;
    setBusy(true);
    try {
      await api("/api/lang", { body: { lang: next } });
      router.refresh();
    } catch {
      // A failed switch leaves the page as it was; nothing to undo.
    }
    setBusy(false);
  }
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {[
        ["en", "English", "EN"],
        ["hi", "हिंदी", "हिं"],
      ].map(([code, name, shortName]) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => pick(code)}
          className={`min-h-12 rounded-[0.6rem] px-3 font-semibold ${lang === code ? "bg-accent text-on-accent" : "text-ink hover:bg-surface-2"}`}
        >
          <span className="sm:hidden" aria-hidden="true">{shortName}</span>
          <span className="max-sm:sr-only">{name}</span>
        </button>
      ))}
    </div>
  );
}
