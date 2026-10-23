"use client";

import { useRouter } from "next/navigation";

// EN / हिंदी switch for public pages: writes the same `lang` cookie the app uses and re-renders on the server.
export default function LangToggle({ lang, label }) {
  const router = useRouter();
  const set = (next) => {
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {[["en", "English"], ["hi", "हिंदी"]].map(([code, name]) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => set(code)}
          className={`min-h-11 rounded-[0.6rem] px-3 text-sm font-semibold ${lang === code ? "bg-accent text-on-accent" : "text-ink hover:bg-surface-2"}`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
