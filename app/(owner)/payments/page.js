import PageHeader from "@/components/ui/PageHeader";
import StatusPill from "@/components/ui/StatusPill";
import { ImportPanel, ManualPayment } from "@/components/collect/PaymentsImport";
import { FlagChips, PendingPayment, RecordTds } from "@/components/collect/PaymentCard";
import { ErrorState, SectionTitle, date, inr, tr } from "@/components/collect/kit";
import { getLang, load } from "@/components/collect/server";
import * as fu from "@/lib/services/followups";
import { t } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: t("collect.pay.title", await getLang()) };
}

export default async function PaymentsPage() {
  const lang = await getLang();
  const T = tr(lang);
  const { data, error } = await load((c, ctx) => fu.paymentsView(c, ctx));
  if (error) {
    return (
      <>
        <PageHeader title={T("collect.pay.title")} />
        <ErrorState lang={lang} error={error} retryHref="/payments" />
      </>
    );
  }
  const { pending, confirmed, rejected } = data;
  return (
    <>
      <PageHeader title={T("collect.pay.title")} subtitle={T("collect.pay.subtitle", { n: pending.length })} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ImportPanel lang={lang} />
        <ManualPayment lang={lang} asOf={data.as_of} invoices={data.open_invoices} />
      </div>

      <section aria-labelledby="sec-pending">
        <SectionTitle id="sec-pending" count={pending.length}>
          {T("payments.to_confirm")}
        </SectionTitle>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-ink-muted">{T("collect.pay.none_pending")}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map((p) => (
              <PendingPayment key={p.id} p={p} lang={lang} invoices={data.open_invoices} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sec-confirmed">
        <SectionTitle id="sec-confirmed" count={data.confirmed_total}>
          {T("collect.pay.confirmed_h")}
        </SectionTitle>
        {confirmed.length === 0 ? (
          <p className="text-ink-muted">{T("payments.empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {confirmed.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="tnum font-semibold">{inr(p.amount_paise, true)}</span> · {date(p.paid_on, lang)} · {p.customer_name ?? T("collect.pay.unknown_payer")}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <StatusPill status="confirmed" label={T("collect.pay.st_confirmed")} />
                    {(p.flags?.length > 0 || p.is_tds_entry) && <FlagChips p={p} lang={lang} />}
                  </span>
                </div>
                <p className="mt-1 text-ink-muted">
                  {p.allocations.map((a) => `${a.number} ${inr(a.amount_paise, true)}`).join(" · ")}
                </p>
                {p.is_tds_entry && <p className="mt-1 text-sm text-ink-muted">{T("collect.pay.tds_entry_note")}</p>}
                {p.tds?.state === "can_record" && (
                  <>
                    <p className="mt-2 rounded-lg bg-warning-soft p-3">{T("collect.pay.tds_open", { number: p.tds.number, amount: inr(p.tds.amount_paise, true), pct: p.tds.pct })}</p>
                    <RecordTds p={p} lang={lang} />
                  </>
                )}
                {p.tds?.state === "recorded" && <p className="mt-1 font-semibold text-success">{T("collect.pay.tds_recorded", { amount: inr(p.tds.amount_paise, true) })}</p>}
              </li>
            ))}
          </ul>
        )}
        {data.confirmed_total > confirmed.length && <p className="mt-2 text-sm text-ink-muted">{T("collect.pay.showing", { n: confirmed.length, total: data.confirmed_total })}</p>}
      </section>

      {rejected.length > 0 && (
        <details className="mt-8 rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{T("collect.pay.rejected_h", { n: rejected.length })}</summary>
          <ul className="divide-y divide-line border-t border-line">
            {rejected.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <span className="tnum font-semibold">{inr(p.amount_paise, true)}</span> · {date(p.paid_on, lang)} · {p.narration ?? p.reference ?? ""}
                </span>
                <StatusPill status="rejected" label={T("collect.pay.st_rejected")} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
