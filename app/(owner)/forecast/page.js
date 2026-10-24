import PageHeader from "@/components/ui/PageHeader";
import StatusPill from "@/components/ui/StatusPill";
import ForecastChart from "@/components/collect/ForecastChart";
import { OfferButton } from "@/components/collect/OfferButton";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/auth";
import WhatIf from "@/components/collect/WhatIf";
import { Term } from "@/components/collect/client";
import { Amount, ErrorState, SectionTitle, date, inr, lateText, tr } from "@/components/collect/kit";
import { getLang, load } from "@/components/collect/server";
import * as fu from "@/lib/services/followups";
import { t } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: t("forecast.title", await getLang()) };
}

const range = (w, lang) => `${date(w.start, lang)} – ${date(w.end, lang)}`;

export default async function ForecastPage({ searchParams }) {
  const lang = await getLang();
  const T = tr(lang);
  const role = getSessionFromCookies(await cookies())?.role ?? "owner";
  const sp = await searchParams;
  const { data, error } = await load((c, ctx) => fu.forecastView(c, ctx, fu.parseWhatIf(sp, ctx.cfg.forecast?.weeks ?? 13)));
  if (error) {
    return (
      <>
        <PageHeader title={T("forecast.title")} />
        <ErrorState lang={lang} error={error} retryHref="/forecast" />
      </>
    );
  }
  const weeks = data.weeks;
  const fs = data.first_shortfall_week;
  const short = fs != null ? weeks[fs] : null;
  const lowest = weeks[data.lowest.index];
  const covered = data.cover_gap.reduce((s, g) => s + g.outstanding_paise, 0);
  const needWeek = short ? data.buffer_paise - short.closing_paise : 0;
  const leftWeek = Math.max(0, needWeek - covered);
  const current = {
    late: sp.late ? Number(sp.late) : null,
    order: sp.order ? Number(sp.order) : null,
    order_week: sp.order_week ? Number(sp.order_week) : null,
    supplier: sp.supplier ? Number(sp.supplier) : null,
  };
  const whatIfOn = current.late || current.order || current.supplier;
  const lateName = current.late ? data.customers.find((c) => c.id === current.late)?.name : null;

  return (
    <>
      <PageHeader title={<Term k="collect.fc.title" lang={lang} />} subtitle={T("collect.fc.subtitle", { n: weeks.length, date: date(data.today, lang) })} />

      {short ? (
        <a href="#gap" className="mb-4 flex items-start gap-3 rounded-xl border-2 border-error bg-error-soft p-4 text-ink no-underline">
          <StatusPill status="error" label={T("collect.fc.short_chip")} />
          <span className="font-semibold">
            {T("forecast.breach", { n: fs + 1 })} ({range(short, lang)})
          </span>
        </a>
      ) : (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-success bg-success-soft p-4 font-semibold">
          <StatusPill status="success" label={T("collect.fc.ok_chip")} />
          {T("collect.fc.no_breach", { amount: inr(data.buffer_paise), n: weeks.length })}
        </p>
      )}
      {whatIfOn && (
        <p className="mb-4 rounded-lg bg-info-soft p-3">
          {T("collect.fc.vs_base", {
            now: fs == null ? T("collect.fc.none") : T("collect.promise.week_n", { n: fs + 1 }),
            base: data.base_first_shortfall_week == null ? T("collect.fc.none") : T("collect.promise.week_n", { n: data.base_first_shortfall_week + 1 }),
          })}
          {lateName && ` ${T("collect.fc.late_who", { name: lateName })}`}
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label={<Term k="collect.fc.cash_now" lang={lang} />} paise={data.opening_cash_paise} lang={lang} />
        <Stat label={<Term k="collect.fc.lowest" lang={lang} />} paise={data.lowest.closing_paise} lang={lang} note={T("collect.fc.in_week", { n: data.lowest.index + 1, range: range(lowest, lang) })} />
        <Stat label={<Term k="collect.fc.buffer" lang={lang} />} paise={data.buffer_paise} lang={lang} note={T("collect.fc.buffer_note")} />
      </div>

      <WhatIf lang={lang} customers={data.customers} weeksN={weeks.length} current={current} defaultWeek={fs != null ? fs + 1 : 1} />

      <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="chart-h">
        <h2 id="chart-h" className="mb-3 text-lg font-semibold">
          {T("collect.fc.chart_title")}
        </h2>
        {!data.has_expenses && <p className="mb-3 rounded-lg bg-warning-soft p-3">{T("collect.fc.no_expenses")}</p>}
        <ForecastChart weeks={weeks} buffer={data.buffer_paise} firstShort={fs} lang={lang} />
      </section>

      {short && (
        <section id="gap" className="mt-4 scroll-mt-4 rounded-xl border-2 border-error bg-surface p-4 sm:p-5" aria-labelledby="gap-h">
          <h2 id="gap-h" className="text-lg font-semibold">
            {T("collect.fc.gap_title", { n: fs + 1, range: range(short, lang) })}
          </h2>
          <p className="mt-1">
            {T("collect.fc.gap_line", { closing: inr(short.closing_paise), gap: inr(needWeek) })}
          </p>
          {data.cover_gap.length > 0 ? (
            <>
              <h3 className="mt-4 font-semibold">{T("forecast.cover_gap")}</h3>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                {data.cover_gap.map((g) => (
                  <li key={g.invoice_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                    <span className="min-w-0">
                      <span className="font-semibold">{g.number}</span> · {g.customer_name}
                      <span className="block text-sm text-ink-muted">
                        {lateText(g.days_overdue, lang)}
                        {g.promise_date && ` · ${T("collect.fc.promised", { date: date(g.promise_date, lang) })}`}
                      </span>
                    </span>
                    <span className="tnum font-semibold">{inr(g.outstanding_paise)}</span>
                    <div className="w-full"><OfferButton lang={lang} invoiceId={g.invoice_id} suggestion={g.offer_suggestion} open={g.open_offer} role={role} /></div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-semibold">
                {leftWeek > 0 ? T("collect.fc.covers_part", { n: fs + 1, amount: inr(leftWeek) }) : T("collect.fc.covers_week", { n: fs + 1, amount: inr(covered) })}
              </p>
              {data.gap_uncovered_paise > 0 && <p className="mt-1 rounded-lg bg-warning-soft p-3">{T("collect.fc.still_short", { amount: inr(data.gap_uncovered_paise) })}</p>}
              <a href="/chase-first" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-accent px-5 font-semibold text-on-accent no-underline hover:bg-accent-strong">
                {T("collect.fc.go_chase")}
              </a>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-warning-soft p-3">{T("collect.fc.nothing_covers", { amount: inr(data.gap_uncovered_paise || needWeek) })}</p>
          )}
        </section>
      )}

      <SectionTitle id="table-h">{T("collect.fc.table_title")}</SectionTitle>
      <WeekTable weeks={weeks} lang={lang} totals={data.totals} fs={fs} />
      {data.totals.after_window_inflow_paise > 0 && <p className="mt-2 text-sm text-ink-muted">{T("collect.fc.after_window", { amount: inr(data.totals.after_window_inflow_paise), n: weeks.length })}</p>}
      <p className="mt-2 text-sm text-ink-muted">{T("collect.fc.how")}</p>
    </>
  );
}

function Stat({ label, paise, lang, note }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="font-semibold text-ink-muted">{label}</div>
      <Amount paise={paise} lang={lang} hero className="mt-1" />
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}

function WeekTable({ weeks, lang, totals, fs }) {
  const T = tr(lang);
  const head = [T("forecast.week"), T("forecast.opening"), <Term key="in" k="forecast.inflow" lang={lang} />, <Term key="out" k="forecast.outflow" lang={lang} />, T("forecast.closing")];
  return (
    <>
      <table className="hidden w-full border-collapse overflow-hidden rounded-xl border border-line bg-surface sm:table">
        <caption className="sr-only">{T("collect.fc.table_title")}</caption>
        <thead className="bg-surface-2 text-left">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={`px-3 py-2 font-semibold ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.index} className={`border-t border-line ${w.index === fs ? "bg-error-soft" : ""}`}>
              <th scope="row" className="px-3 py-2 text-left font-normal">
                <span className="font-semibold">{T("collect.promise.week_n", { n: w.index + 1 })}</span>
                <span className="block text-sm text-ink-muted">{range(w, lang)}</span>
                {w.below_buffer && <StatusPill status={w.index === fs ? "error" : "warning"} label={T("collect.fc.below")} className="mt-1" />}
              </th>
              <td className="tnum px-3 py-2 text-right">{inr(w.opening_paise)}</td>
              <td className="tnum px-3 py-2 text-right text-success">+{inr(w.inflow_paise)}</td>
              <td className="tnum px-3 py-2 text-right">−{inr(w.outflow_paise)}</td>
              <td className={`tnum px-3 py-2 text-right font-semibold ${w.closing_paise < 0 ? "text-error" : ""}`}>{inr(w.closing_paise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-line bg-surface-2">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">
              {T("collect.total")}
            </th>
            <td className="tnum px-3 py-2 text-right">{inr(weeks[0].opening_paise)}</td>
            <td className="tnum px-3 py-2 text-right text-success">+{inr(totals.inflow_paise)}</td>
            <td className="tnum px-3 py-2 text-right">−{inr(totals.outflow_paise)}</td>
            <td className="tnum px-3 py-2 text-right font-semibold">{inr(weeks.at(-1).closing_paise)}</td>
          </tr>
        </tfoot>
      </table>

      <ul className="space-y-3 sm:hidden">
        {weeks.map((w) => (
          <li key={w.index} className={`rounded-xl border p-3 ${w.index === fs ? "border-2 border-error bg-error-soft" : "border-line bg-surface"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{T("collect.promise.week_n", { n: w.index + 1 })}</span> <span className="text-sm text-ink-muted">{range(w, lang)}</span>
              </span>
              {w.below_buffer && <StatusPill status={w.index === fs ? "error" : "warning"} label={T("collect.fc.below")} />}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-ink-muted">{T("forecast.opening")}</dt>
              <dd className="tnum text-right">{inr(w.opening_paise)}</dd>
              <dt className="text-ink-muted">{T("forecast.inflow")}</dt>
              <dd className="tnum text-right text-success">+{inr(w.inflow_paise)}</dd>
              <dt className="text-ink-muted">{T("forecast.outflow")}</dt>
              <dd className="tnum text-right">−{inr(w.outflow_paise)}</dd>
              <dt className="font-semibold">{T("forecast.closing")}</dt>
              <dd className={`tnum text-right font-semibold ${w.closing_paise < 0 ? "text-error" : ""}`}>{inr(w.closing_paise)}</dd>
            </dl>
            <WeekDetail w={w} lang={lang} />
          </li>
        ))}
      </ul>

      <details className="mt-3 hidden rounded-xl border border-line bg-surface sm:block">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{T("collect.fc.detail_all")}</summary>
        <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-2">
          {weeks.map((w) => (
            <div key={w.index}>
              <h3 className="font-semibold">
                {T("collect.promise.week_n", { n: w.index + 1 })} <span className="font-normal text-ink-muted">{range(w, lang)}</span>
              </h3>
              <WeekLines w={w} lang={lang} />
            </div>
          ))}
        </div>
      </details>
    </>
  );
}

function WeekDetail({ w, lang }) {
  if (!w.inflows.length && !w.outflows.length) return null;
  return (
    <details className="mt-2">
      <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-accent">{t("collect.fc.detail", lang)}</summary>
      <WeekLines w={w} lang={lang} />
    </details>
  );
}

function WeekLines({ w, lang }) {
  const T = tr(lang);
  if (!w.inflows.length && !w.outflows.length) return <p className="text-ink-muted">{T("collect.fc.quiet")}</p>;
  return (
    <ul className="mt-1 space-y-1">
      {[...w.inflows].sort((a, b) => b.amount_paise - a.amount_paise).slice(0, 25).map((r, i) => (
        <li key={`i${i}`} className="flex justify-between gap-2">
          <span className="min-w-0">
            {r.invoice_id ? `${r.number} · ${r.customer_name}` : T("collect.fc.big_order")}
            {r.promise_date && <span className="text-sm text-info"> · {T("collect.fc.promised", { date: date(r.promise_date, lang) })}</span>}
          </span>
          <span className="tnum shrink-0 text-success">+{inr(r.amount_paise)}</span>
        </li>
      ))}
      {w.inflows.length > 25 && (
        <li className="flex justify-between gap-2 text-ink-muted">
          <span>{T("pages.cap.more_inflows", { n: w.inflows.length - 25 })}</span>
          <span className="tnum shrink-0">+{inr([...w.inflows].sort((a, b) => b.amount_paise - a.amount_paise).slice(25).reduce((s, r) => s + r.amount_paise, 0))}</span>
        </li>
      )}
      {w.outflows.map((r, i) => (
        <li key={`o${i}`} className="flex justify-between gap-2">
          <span className="min-w-0">
            {T(`collect.fc.cat.${r.category}`)} · {date(r.date, lang)}
          </span>
          <span className="tnum shrink-0">−{inr(r.amount_paise)}</span>
        </li>
      ))}
    </ul>
  );
}
