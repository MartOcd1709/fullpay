import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import InboxCard from "@/components/collect/InboxCard";
import { ErrorState, SectionTitle, date, inr, tr } from "@/components/collect/kit";
import { getLang, load } from "@/components/collect/server";
import * as fu from "@/lib/services/followups";
import { t } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: t("collect.ib.title", await getLang()) };
}

const RESOLUTION_TONE = { accept_credit_note: "success", mark_paid: "success", edit: "success", reject: "neutral" };

export default async function InboxPage() {
  const lang = await getLang();
  const T = tr(lang);
  const { data, error } = await load((c, ctx) => fu.inboxView(c, ctx));
  if (error) {
    return (
      <>
        <PageHeader title={T("collect.ib.title")} />
        <ErrorState lang={lang} error={error} retryHref="/inbox" />
      </>
    );
  }
  const disputes = data.open.filter((i) => i.kind === "dispute");
  const claims = data.open.filter((i) => i.kind === "claim");
  return (
    <>
      <PageHeader title={T("collect.ib.title")} subtitle={T("collect.ib.subtitle", { d: disputes.length, c: claims.length })} />
      {data.open.length === 0 && <EmptyState title={T("collect.ib.empty")} description={T("collect.ib.empty_body")} />}

      {disputes.length > 0 && (
        <section aria-labelledby="sec-disputes">
          <SectionTitle id="sec-disputes" count={disputes.length}>
            {T("collect.ib.disputes")}
          </SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {disputes.map((i) => (
              <InboxCard key={i.id} item={i} lang={lang} asOf={data.as_of} />
            ))}
          </div>
        </section>
      )}
      {claims.length > 0 && (
        <section aria-labelledby="sec-claims">
          <SectionTitle id="sec-claims" count={claims.length}>
            {T("collect.ib.claims")}
          </SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {claims.map((i) => (
              <InboxCard key={i.id} item={i} lang={lang} asOf={data.as_of} />
            ))}
          </div>
        </section>
      )}

      {data.resolved.length > 0 && (
        <details className="mt-8 rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{T("collect.ib.resolved", { n: data.resolved.length })}</summary>
          <ul className="divide-y divide-line border-t border-line">
            {data.resolved.map((i) => (
              <li key={i.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-semibold">
                    {i.customer_name} · {i.invoice_number}
                  </span>
                  <StatusPill status={RESOLUTION_TONE[i.resolution] ?? "neutral"} label={T(`collect.ib.res_${i.resolution}`)} />
                </div>
                <p className="mt-1 text-ink-muted">
                  {T(i.kind === "claim" ? "collect.ib.claim" : "collect.ib.dispute")} · {date(i.opened_on, lang)} → {date(i.resolved_on, lang)} · {T("collect.ib.still_owed")} <span className="tnum">{inr(i.outstanding_paise)}</span>
                </p>
                {i.resolution === "accept_credit_note" && i.credit_notes && <p className="mt-1">{T("collect.ib.cn_issued", { cn: i.credit_notes, date: date(i.opened_on, lang) })}</p>}
                {i.accepted && i.kind === "dispute" && i.resolution !== "accept_credit_note" && <p className="mt-1">{T("collect.ib.interest_span", { from: date(i.opened_on, lang), to: date(i.resolved_on, lang) })}</p>}
                {i.reply && <p className="mt-1 text-ink-muted">{T("collect.ib.your_reply", { reply: i.reply })}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
