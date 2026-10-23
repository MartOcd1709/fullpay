"use client";

import { useId } from "react";
import Icon from "./Icon";

// Plain label + ⓘ that opens a popover with the accounting term (K18). Native popover: opens on tap, click or Enter; Esc or tap outside closes.
export function Term({ label, term, meaning, more = "What does this mean?", className = "", iconOnly = false }) {
  const id = useId().replace(/:/g, "");
  if (!term && !meaning) return <span className={className}>{label}</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {!iconOnly && <span>{label}</span>}
      <button
        type="button"
        popoverTarget={`term-${id}`}
        aria-label={`${more} ${label}`}
        className="-my-3 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full text-ink-muted hover:text-accent"
      >
        <Icon name="info" className="h-[1.125rem] w-[1.125rem]" />
      </button>
      <span id={`term-${id}`} popover="auto" className="term-pop text-base font-normal">
        <span className="block font-semibold">{term || label}</span>
        {meaning && <span className="mt-1 block text-ink-muted">{meaning}</span>}
      </span>
    </span>
  );
}

export default Term;
