import Link from "next/link";
import Icon from "./Icon";

// Error, loading and empty shapes shared by every screen (ux §1.5).
export function ErrorState({ title, message, code, retryHref, retryLabel }) {
  return (
    <section role="alert" className="rounded-xl border border-error/40 bg-error-soft p-5 text-error">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="alert" className="h-5 w-5" />
        {title}
      </h2>
      {message && <p className="mt-1 text-ink">{message}</p>}
      {code && <p className="mono mt-2 text-sm text-ink-muted">{code}</p>}
      {retryHref && (
        <Link href={retryHref} className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-error px-5 font-semibold text-on-accent no-underline">
          {retryLabel}
        </Link>
      )}
    </section>
  );
}

export function LoadingRows({ rows = 3, tiles = 0, label = "Loading" }) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <div className="skeleton mb-6 h-9 w-56" />
      {tiles > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
