import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import { Term } from "@/components/collect/client";
import { ErrorState, inr, date, tr } from "@/components/collect/kit";
import { getLang, load } from "@/components/collect/server";
import * as fu from "@/lib/services/followups";
import { t } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: t("chase.title", await getLang()) };
}

const SORTS = {
  score: (a, b) => b.score - a.score || b.outstanding_paise - a.outstanding_paise,
  amount: (a, b) => b.outstanding_paise - a.outstanding_paise,
  days: (a, b) => b.days_overdue - a.days_overdue,
};

// The reason in the UI language, from the same parts the engine uses.
function reason(r, fsw, T) {
  const parts = [inr(r.outstanding_paise), T("collect.days_overdue", { n: r.days_overdue })];
  parts.push(r.avg_late_days > 0 ? T("collect.ch.usually_late", { n: r.avg_late_days }) : T("collect.ch.usually_on_time"));
  if (r.in_gap && fsw != null) parts.push(T("collect.ch.covers", { n: fsw + 1 }));
  return parts.join(", ");
}

const CAP = 100; // render cap: totals and sorting use every row, the page sends the first CAP (ponytail: add paging if owners ask)

export default async function ChaseFirstPage({ searchParams }) {
  const lang = await getLang();
  const T = tr(lang);
  const sort = Object.hasOwn(SORTS, (await searchParams).sort) ? (await searchParams).sort : "score";
  const { data, error } = await load((c, ctx) => fu.chaseView(c, ctx));
  if (error) {
    return (
      <>
        <PageHeader title={T("chase.title")} />
        <ErrorState lang={lang} error={error} retryHref="/chase-first" />
      </>
    );
  }
  const rows = [...data.rows].sort(SORTS[sort]);
  const total = rows.reduce((s, r) => s + r.outstanding_paise, 0);
  return (
    <>
      <PageHeader title={T("chase.title")} subtitle={rows.length ? T("collect.ch.subtitle", { n: rows.length, amount: inr(total), date: date(data.as_of, lang) }) : null} />
      {rows.length === 0 ? (
        <EmptyState title={T("collect.ch.empty")} description={T("collect.ch.empty_body")} />
      ) : (
        <>
          <nav aria-label={T("collect.ch.sort")} className="mb-4 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink-muted">{T("collect.ch.sort")}:</span>
            {Object.keys(SORTS).map((k) => (
              <Link
                key={k}
                href={k === "score" ? "/chase-first" : `/chase-first?sort=${k}`}
                aria-current={sort === k ? "true" : undefined}
                className={`inline-flex min-h-12 items-center rounded-xl px-4 font-semibold no-underline ${sort === k ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink hover:bg-surface-2"}`}
              >
                {T(`collect.ch.sort_${k}`)}
              </Link>
            ))}
          </nav>
          {rows.length > CAP && <p className="mb-3 text-ink-muted">{T("pages.cap.top", { n: CAP, of: rows.length })}</p>}
          <ol className="space-y-3">
            {rows.slice(0, CAP).map((r, i) => {
              const tel = String(r.customer_phone ?? "").replace(/[^\d+]/g, "");
              return (
                <li key={r.id} className={`rounded-xl border bg-surface p-4 sm:p-5 ${r.in_gap ? "border-2 border-warning" : "border-line"}`}>
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="tnum flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-on-accent">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-lg font-semibold leading-snug">
                          <span className="sr-only">{T("collect.ch.rank", { n: i + 1 })} </span>
                          {r.customer_name} · <span className="font-normal">{r.number}</span>
                        </h2>
                        <span className="text-right">
                          <span className="tnum block text-xl font-bold">{inr(r.outstanding_paise)}</span>
                          <span className="text-sm text-ink-muted">
                            <Term k="chase.score" lang={lang} meaning={T("collect.ch.score_how")} label={T("collect.ch.score", { n: r.score })} />
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-lg">{reason(r, data.first_shortfall_week, T)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill status="overdue" label={T("collect.days_overdue", { n: r.days_overdue })} />
                        {r.grade && <StatusPill status={r.grade} label={T(`collect.ch.grade_${r.grade}`)} />}
                        {r.in_gap && <StatusPill status="warning" label={T("collect.ch.covers_chip", { n: data.first_shortfall_week + 1 })} />}
                        {r.paused_by && <StatusPill status="info" label={T(`collect.hold.${r.paused_by}`, { date: "" })} />}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tel && (
                          <a href={`tel:${tel}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-on-accent no-underline hover:bg-accent-strong">
                            {T("collect.ch.call", { name: r.customer_name })}
                          </a>
                        )}
                        <Link href={`/invoices/${r.id}`} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-semibold text-ink no-underline hover:bg-surface-2">
                          {T("collect.ch.open")}
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm text-ink-muted">{T("collect.ch.score_how")}</p>
        </>
      )}
    </>
  );
}
