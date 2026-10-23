"use client";

import { useId, useState } from "react";

// Plain word with the accounting term in a tap/Enter popover (not hover-only). `term` is the jargon, `meaning` one line.
export default function Term({ children, term, meaning, moreLabel }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center gap-1 align-baseline">
      <span>{children}</span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="-my-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-accent hover:bg-accent-soft"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8v.5" />
        </svg>
        <span className="sr-only">{moreLabel ?? term}</span>
      </button>
      {open && (
        <span id={id} role="note" className="absolute left-0 top-full z-30 mt-1 block w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-3 text-left text-base font-normal text-ink shadow-lg">
          <span className="block font-semibold">{term}</span>
          {meaning && <span className="mt-1 block text-ink-muted">{meaning}</span>}
        </span>
      )}
    </span>
  );
}
