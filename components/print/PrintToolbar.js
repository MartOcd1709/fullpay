"use client";

// Screen-only bar above the A4 sheet. Back, Print / Save as PDF, plus page-specific controls.
export default function PrintToolbar({ s, children }) {
  return (
    <div className="no-print sticky top-0 z-10 mb-4 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-2 px-4 py-2">
        <button type="button" onClick={() => (history.length > 1 ? history.back() : window.location.assign("/documents"))} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-semibold text-ink hover:bg-surface-2">
          {s.back}
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong">
          {s.print}
        </button>
        {children}
        <p className="w-full text-ink-muted">{s.hint}</p>
      </div>
    </div>
  );
}
