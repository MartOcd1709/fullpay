import Link from "next/link";
import Icon from "@/components/ui/Icon";

// The setup steps with a tick for each one done. `compact` lists only what is left (for the dashboard).
export default function SetupChecklist({ steps, T, compact = false }) {
  const done = steps.filter((s) => s.done).length;
  const shown = compact ? steps.filter((s) => !s.done) : steps;
  return (
    <div>
      <p className="font-semibold">{T("pages.setup.progress", { done, total: steps.length })}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={T("pages.setup.title")}>
        <div className="h-full rounded-full bg-success" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <ul className="mt-3 grid gap-2">
        {shown.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-success text-on-accent" : "border-2 border-line"}`} aria-hidden="true">
              {s.done && <Icon name="check" className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="sr-only">{s.done ? T("pages.setup.done") : T("pages.setup.todo")}: </span>
              {s.href && !s.done ? <Link href={s.href} className="font-semibold">{T(`pages.setup.${s.key}`)}</Link> : <span className={s.done ? "text-ink-muted" : "font-semibold"}>{T(`pages.setup.${s.key}`)}</span>}
              {!s.done && <span className="block text-sm text-ink-muted">{T(`pages.setup.${s.key}_why`)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
