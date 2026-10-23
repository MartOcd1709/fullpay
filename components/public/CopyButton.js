"use client";

import { useState } from "react";

export default function CopyButton({ text, label, done }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 font-semibold text-ink hover:bg-surface-2"
    >
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
