import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import Term from "@/components/ui/Term";
import Money from "@/components/ui/Money";
import StatusChip from "@/components/ui/StatusChip";
import DataTable from "@/components/ui/DataTable";
import Timeline from "@/components/ui/Timeline";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { chainFor } from "@/components/ui/server/data";
import { timelineModel } from "@/components/ui/server/timeline";
import { run } from "@/lib/services/context";
import * as invoices from "@/lib/services/invoices";
import * as customers from "@/lib/services/customers";
import { interestEligible } from "@/lib/services/common";
import { expectedInflowDate } from "@/lib/forecast";
import { RUNGS } from "@/lib/ladder";
import InvoiceActions from "./InvoiceActions";

export async function generateMetadata({ params }) {
  const T = await getT();
  return { title: `${T("core.inv.detail_title")} ${(await params).id}` };
}

const LINK = "inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold text-ink no-underline hover:bg-surface-2";

export default async function InvoicePage({ params }) {
  const T = await getT();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  let data;
  try {
    data = await run(async (c, ctx) => {
      const inv = await invoices.get(c, ctx, id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!inv) return null;
      const customer = await customers.get(c, ctx, inv.customer_id);
      return { inv, customer, chain: await chainFor(c, inv.timeline), cfg: ctx.cfg, asOf: ctx.asOf };
    });
  } catch (err) {
    console.error("[invoice]", err);
    return <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref={`/invoices/${id}`} retryLabel={T("btn.retry")} />;
  }
  if (!data) notFound();
  const { inv, customer, chain, cfg, asOf } = data;

  const draft = inv.status === "draft";
  const received = inv.paid_paise + inv.credited_paise;
  const rungAt = RUNGS.indexOf(inv.rung);
  const model = timelineModel({ inv, cfg, asOf, T, chain });
  const appUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
  const payUrl = inv.pay_token && inv.outstanding_paise > 0 ? `${appUrl}/pay/${inv.pay_token}` : null;
  const terms =
    customer.credit_days == null
      ? T("core.inv.terms_none")
      : T("core.inv.terms_agreed", { n: Math.min(customer.credit_days, 45) });
  const interest = inv.interest;

  const L = Object.fromEntries(
    [
      "send", "edit", "promise", "snooze", "change_snooze", "answer_dispute", "promise_broken_before", "promise_open", "pay_link", "copy", "copied",
      "open_pay", "send_title", "send_body", "send_confirm", "sent_as", "promise_title", "promise_date", "promise_limit", "promise_amount",
      "promise_amount_hint", "promise_confirm", "promise_saved", "amount_invalid", "effect_move", "effect_same", "week_n", "after_window",
      "snooze_title", "snooze_body", "snooze_until", "snooze_confirm", "snoozed_toast", "unsnooze", "unsnoozed", "plus_days", "working",
    ].map((k) => [k, T(`core.act.${k}`)]),
  );
  Object.assign(L, { cancel: T("btn.cancel"), close: T("core.close"), network: T("error.network"), lang: T.lang });

  const items = inv.items.map((it) => ({ ...it, tax: it.cgst_paise + it.sgst_paise + it.igst_paise }));

  return (
    <>
      <Link href="/invoices" className="mb-2 inline-flex min-h-12 items-center gap-1 font-semibold text-accent no-underline">
        <Icon name="chevron" className="h-4 w-4 rotate-180" />
        {T("nav.invoices")}
      </Link>
      <PageHeader
        title={<span className="mono">{inv.number ?? T("core.inv.draft_label")}</span>}
        subtitle={
          <>
            <Link href={`/customers/${inv.customer_id}`}>{inv.customer_name}</Link> · {T("core.inv.issued_on", { date: T.date(inv.issue_date) })}
          </>
        }
        actions={
          <>
            <a href={`/print/invoice/${inv.id}`} className={LINK}>
              <Icon name="print" />
              {T(`core.doc.${inv.doc_type}`)}
            </a>
            {!draft && rungAt >= RUNGS.indexOf("demand_letter") && (
              <a href={`/print/letter/${inv.id}`} className={LINK}>
                <Icon name="letter" />
                {T("letter.title")}
              </a>
            )}
            {!draft && (
              <a href={`/print/bundle/${inv.id}`} className={LINK}>
                <Icon name="scale" />
                {T("core.doc.bundle")}
              </a>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusChip status={inv.display_status} lang={T.lang} days={inv.days_overdue} />
        {inv.rung && <StatusChip status={inv.rung} lang={T.lang} label={T(`core.rung.${inv.rung}`)} />}
        {customer.opt_out && <StatusChip status="opt_out" lang={T.lang} />}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold">
          <Icon name="scale" className="h-4 w-4 text-accent" />
          {terms}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={T("core.inv.amount")} paise={inv.total_paise} sub={inv.credited_paise > 0 ? T("core.inv.credited", { amount: T.money(inv.credited_paise) }) : null} />
        <StatCard term={T.term("core.inv.received")} paise={received} />
        <StatCard
          term={T.term("core.inv.still_owed_term")}
          paise={draft ? inv.total_paise : inv.outstanding_paise}
          tone={inv.days_overdue > 0 && inv.outstanding_paise > 0 ? "error" : "neutral"}
          sub={draft ? T("core.inv.draft_due", { date: T.date(inv.due_date) }) : inv.days_overdue > 0 && inv.outstanding_paise > 0 ? T("core.inv.due_late", { date: T.date(inv.due_date), n: inv.days_overdue }) : T("core.inv.due_line", { date: T.date(inv.due_date), rel: T.rel(inv.due_date, asOf) })}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6 lg:order-1">
          {interest && interest.total_interest_paise > 0 && (
            <section className="rounded-xl border border-accent/30 bg-accent-soft p-4 sm:p-5" aria-labelledby="int-h">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="int-h" className="text-lg font-semibold">
                  <Term {...T.term("core.dash.interest")} />
                </h2>
                <Money paise={interest.total_interest_paise} className="text-2xl font-bold text-accent" />
              </div>
              <p className="mt-1 text-ink-muted">{T("core.int.since", { date: T.date(interest.start_date), asof: T.date(interest.as_of) })}</p>
              <DataTable
                className="mt-3"
                caption={T("core.int.table")}
                rowKey={(s) => `${s.from}-${s.to}`}
                rows={interest.segments}
                columns={[
                  { key: "from", label: T("core.int.period"), primary: true, render: (s) => `${T.date(s.from)} – ${T.date(s.to)}` },
                  { key: "days", label: T("core.int.days"), align: "right", render: (s) => <span className="tnum">{s.days}</span> },
                  { key: "base", label: T("core.int.base"), align: "right", render: (s) => <Money paise={s.base_paise} /> },
                  { key: "rate", label: T("core.int.rate"), align: "right", render: (s) => (s.dispute ? T("core.int.rate_zero") : T("core.int.rate_val", { rate: (s.rate_bps / 100).toFixed(2), bank: (s.bank_rate_bps / 100).toFixed(2) })) },
                  { key: "int", label: T("core.int.interest"), align: "right", render: (s) => <Money paise={s.interest_paise} className="font-semibold" /> },
                ]}
              />
              <p className="mt-3 text-ink-muted">{T("core.int.note")}</p>
            </section>
          )}
          {!interest && !draft && inv.days_overdue > 0 && inv.outstanding_paise > 0 && !interestEligible(cfg) && (
            <p className="rounded-xl border border-line bg-surface px-4 py-3 text-ink-muted">{T("core.int.not_eligible")}</p>
          )}

          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="tl-h">
            <h2 id="tl-h" className="mb-3 text-lg font-semibold">{T("core.tl.title")}</h2>
            {draft ? <p className="text-ink-muted">{T("core.tl.empty")}</p> : <Timeline model={model} />}
          </section>
        </div>

        <aside className="space-y-6 lg:order-2">
          <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="act-h">
            <h2 id="act-h" className="mb-3 text-lg font-semibold">{T("common.actions")}</h2>
            {inv.status === "paid" ? (
              <p className="flex items-center gap-2 font-medium text-success">
                <Icon name="check" />
                {T("core.act.paid_done")}
              </p>
            ) : (
              <InvoiceActions
                inv={{ id: inv.id, status: inv.status, outstanding_paise: inv.outstanding_paise, promises: inv.promises, snoozed_until: inv.snoozed_until }}
                asOf={asOf}
                expected={expectedInflowDate(inv, customer, asOf)}
                payUrl={payUrl}
                L={L}
              />
            )}
          </section>

          <details className="rounded-xl border border-line bg-surface p-4" open={draft}>
            <summary className="flex min-h-12 cursor-pointer items-center justify-between font-semibold">
              {T("core.inv.items_title", { n: items.length })}
              <Icon name="chevron" className="h-5 w-5 rotate-90" />
            </summary>
            <ul className="mt-2 divide-y divide-line">
              {items.map((it) => (
                <li key={it.id} className="py-2">
                  <p className="font-medium">{it.description}</p>
                  <p className="text-ink-muted">
                    {it.hsn_sac ? `HSN/SAC ${it.hsn_sac} · ` : ""}
                    {(it.qty_milli / 1000).toLocaleString("en-IN")} {it.unit} × <Money paise={it.rate_paise} />
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-ink-muted">{T("core.inv.item_tax", { rate: it.gst_bps / 100 })}</span>
                    <Money paise={it.taxable_paise + it.tax} className="font-semibold" />
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-2">
              <Row label={T("core.nw.taxable")} paise={inv.taxable_paise} />
              {inv.igst_paise > 0 ? <Row label="IGST" paise={inv.igst_paise} /> : (
                <>
                  <Row label="CGST" paise={inv.cgst_paise} />
                  <Row label="SGST" paise={inv.sgst_paise} />
                </>
              )}
              <Row label={T("field.round_off")} paise={inv.round_off_paise} />
              <Row label={T("field.total")} paise={inv.total_paise} strong />
            </dl>
          </details>
        </aside>
      </div>
    </>
  );
}

function Row({ label, paise, strong }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "text-lg font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd>
        <Money paise={paise} showPaise />
      </dd>
    </div>
  );
}
