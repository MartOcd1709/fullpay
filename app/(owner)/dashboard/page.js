import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Term from "@/components/ui/Term";
import Money from "@/components/ui/Money";
import { AmountHero, StatCard } from "@/components/ui/StatCard";
import { InvoiceRow, InvoiceList } from "@/components/ui/InvoiceRow";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { interestTotal } from "@/components/ui/server/data";
import { run } from "@/lib/services/context";
import { forecastInputs } from "@/lib/services/views";
import { displayStatus } from "@/lib/services/common";
import { buildForecast, dashboard as dashboardOf } from "@/lib/forecast";
import { daysBetween } from "@/lib/time";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("nav.dashboard") };
}

const BUCKETS = [
  ["not_due", "bg-info", "clock"],
  ["d1_30", "bg-warning", "alert"],
  ["d31_60", "bg-error/60", "alert"],
  ["d61_90", "bg-error/80", "alert"],
  ["d90_plus", "bg-error", "alert"],
];

async function load() {
  return run(async (c, ctx) => {
    const input = await forecastInputs(c, ctx);
    return {
      asOf: ctx.asOf,
      input,
      d: dashboardOf(input),
      fc: buildForecast(input),
      interest: await interestTotal(c, ctx),
    };
  });
}

export default async function DashboardPage() {
  const T = await getT();
  let data;
  try {
    data = await load();
  } catch (err) {
    console.error("[dashboard]", err);
    return (
      <>
        <PageHeader title={T("nav.dashboard")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/dashboard" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const { asOf, input, d, fc, interest } = data;

  if (!input.invoices.length) {
    return (
      <>
        <PageHeader title={T("nav.dashboard")} subtitle={T("core.dash.as_of", { date: T.date(asOf) })} />
        <EmptyState title={T("core.dash.empty_title")} description={T("core.dash.empty_body")} action={<Button href="/invoices/new">{T("nav.new_invoice")}</Button>} />
      </>
    );
  }

  const unpaid = input.invoices.filter((i) => i.outstanding_paise > 0 && i.status !== "paid");
  const overdue = unpaid.filter((i) => i.due_date < asOf);
  const oldest = overdue.reduce((m, i) => Math.max(m, daysBetween(i.due_date, asOf)), 0);
  const customers = new Map(input.customers.map((c) => [String(c.id), c]));
  const gapIds = new Set(fc.cover_gap.map((g) => String(g.invoice_id)));
  const breach = fc.first_shortfall_week;
  const week = breach == null ? null : fc.weeks[breach];
  const lowWeek = fc.weeks[fc.lowest.index];
  const ageTotal = Object.values(d.aging).reduce((s, b) => s + b.amount_paise, 0) || 1;

  const reason = (inv) => {
    const late = Math.round(customers.get(String(inv.customer_id))?.avg_late_days ?? 0);
    const base = T(late > 0 ? "core.dash.reason" : "core.dash.reason_ontime", { amount: T.money(inv.outstanding_paise), days: inv.days_overdue, late });
    return gapIds.has(String(inv.id)) && breach != null ? base + T("core.dash.reason_gap", { week: breach + 1 }) : base;
  };

  return (
    <>
      <PageHeader title={T("nav.dashboard")} subtitle={T("core.dash.as_of", { date: T.date(asOf) })} actions={<Button href="/invoices/new"><Icon name="plus" />{T("nav.new_invoice")}</Button>} />

      <div className="grid gap-3 sm:grid-cols-2">
        <AmountHero
          term={T.term("core.dash.to_collect")}
          paise={d.to_collect_paise}
          lakh={T.lakh(d.to_collect_paise)}
          sub={T("core.dash.bills_n", { n: unpaid.length })}
          icon="rupee"
        />
        <AmountHero
          term={T.term("core.dash.overdue")}
          paise={d.overdue_paise}
          lakh={T.lakh(d.overdue_paise)}
          sub={T("core.dash.overdue_sub", { n: overdue.length, days: oldest })}
          tone={d.overdue_paise > 0 ? "error" : "neutral"}
          icon="alert"
        />
      </div>

      {week ? (
        <Link href="/forecast" className="mt-3 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-ink no-underline hover:border-warning">
          <Icon name="alert" className="mt-0.5 h-6 w-6 text-warning" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {T("core.dash.breach", { buffer: T.money(fc.buffer_paise), n: breach + 1, from: T.date(week.start), to: T.date(week.end) })}
            </span>
            <span className="block">{T("core.dash.breach_low", { amount: T.money(fc.lowest.closing_paise), n: fc.lowest.index + 1, date: T.date(lowWeek.end) })}</span>
            <span className="mt-1 inline-flex min-h-12 items-center gap-1 font-semibold text-accent">
              {T("core.dash.breach_cta", { n: fc.cover_gap.length })}
              <Icon name="chevron" className="h-4 w-4" />
            </span>
          </span>
        </Link>
      ) : (
        <p className="mt-3 flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4 font-semibold text-success">
          <Icon name="check" className="mt-0.5 h-6 w-6" />
          {T("core.dash.no_breach", { buffer: T.money(fc.buffer_paise), weeks: fc.weeks.length })}
        </p>
      )}

      {interest && (
        <section className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-accent/30 bg-accent-soft p-4">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="flex items-start gap-2 text-lg font-semibold">
              <Icon name="scale" className="mt-1 h-5 w-5 text-accent" />
              <Term {...T.term("core.dash.interest")} />
            </h2>
            <p className="text-ink-muted">{T("core.dash.interest_sub", { n: interest.count, date: T.date(asOf) })}</p>
          </div>
          <p className="text-3xl font-bold text-accent">
            <Money paise={interest.total_paise} />
          </p>
        </section>
      )}

      <section className="mt-8" aria-labelledby="chase-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="chase-h" className="text-xl font-semibold">
            <Term {...T.term("core.dash.chase")} />
          </h2>
          <Link href="/chase-first" className="inline-flex min-h-12 items-center gap-1 font-semibold text-accent no-underline">
            {T("core.see_all")}
            <Icon name="chevron" className="h-4 w-4" />
          </Link>
        </div>
        {d.top_chase.length ? (
          <InvoiceList label={T("core.dash.chase")}>
            {d.top_chase.map((inv, i) => (
              <InvoiceRow key={inv.id} rank={i + 1} T={T} asOf={asOf} reason={reason(inv)} inv={{ ...inv, display_status: displayStatus(inv, asOf) }} />
            ))}
          </InvoiceList>
        ) : (
          <EmptyState title={T("core.dash.chase_empty")} />
        )}
      </section>

      <section className="mt-8 rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="age-h">
        <h2 id="age-h" className="text-xl font-semibold">
          <Term {...T.term("core.dash.ageing")} />
        </h2>
        <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg bg-surface-2" aria-hidden="true">
          {BUCKETS.map(([k, color]) =>
            d.aging[k].amount_paise > 0 ? <div key={k} className={`${color} h-full border-r-2 border-surface last:border-r-0`} style={{ width: `${(100 * d.aging[k].amount_paise) / ageTotal}%` }} /> : null,
          )}
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {BUCKETS.map(([k, color, icon]) => (
            <li key={k} className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded ${color}`} />
              <Icon name={icon} className="h-4 w-4 text-ink-muted" />
              <span className="min-w-0 flex-1">{T(`core.age.${k}`)}</span>
              <span className="text-right">
                <Money paise={d.aging[k].amount_paise} className="font-semibold" />
                <span className="text-ink-muted"> · {T("core.dash.bills_count", { n: d.aging[k].count })}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-label={T("core.dash.more_numbers")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard term={T.term("core.dash.expected_week")} paise={d.expected_this_week_paise} icon="trend" />
          <StatCard term={T.term("core.dash.expected_month")} paise={d.expected_this_month_paise} icon="calendar" />
          <StatCard term={T.term("core.dash.bills_30")} paise={d.bills_next_30_paise} icon="letter" />
          <StatCard term={T.term("core.dash.cash")} paise={d.cash_in_bank_paise} icon="bank" />
          <StatCard
            term={T.term("core.dash.low")}
            paise={d.forecast_low.closing_paise}
            sub={T("core.dash.low_sub", { n: d.forecast_low.index + 1, date: T.date(lowWeek.end) })}
            tone={d.forecast_low.closing_paise < fc.buffer_paise ? "warning" : "neutral"}
            icon="trend"
          />
        </div>
      </section>
    </>
  );
}
