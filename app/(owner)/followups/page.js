import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import FollowupCard from "@/components/collect/FollowupCard";
import CallCard from "@/components/collect/CallCard";
import { ErrorState, SectionTitle, date, inr, tr } from "@/components/collect/kit";
import { getLang, load } from "@/components/collect/server";
import * as fu from "@/lib/services/followups";
import { FestivalDrive, QuietBanner } from "@/components/collect/FestivalDrive";
import * as festivalSvc from "@/lib/services/festival";
import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/auth";

import { t } from "@/lib/i18n";
import { mailSetup } from "@/lib/mail";

export async function generateMetadata() {
  return { title: t("collect.fu.title", await getLang()) };
}

const CAP = 100; // render cap: totals and sorting use every row, the page sends the first CAP (ponytail: add paging if owners ask)

export default async function FollowupsPage() {
  const lang = await getLang();
  const T = tr(lang);
  const { data, error } = await load((c, ctx) => fu.listToday(c, ctx));
  const festival = (await load((c, ctx) => festivalSvc.driveView(c, ctx))).data;
  const role = getSessionFromCookies(await cookies())?.role ?? "owner";
  if (error) {
    return (
      <>
        <PageHeader title={T("collect.fu.title")} />
        <ErrorState lang={lang} error={error} retryHref="/followups" />
      </>
    );
  }
  const { ready, failed, held, done, calls } = data;
  const common = { lang, asOf: data.as_of, weeksN: data.weeks_n, expectedWeek: data.expected_week, maxDays: data.promise_max_days };
  const nothing = !ready.length && !failed.length && !calls.length;
  const summary = [
    T("collect.fu.sum_ready", { n: ready.length }),
    calls.length ? T("collect.fu.sum_calls", { n: calls.length }) : null,
    failed.length ? T("collect.fu.sum_failed", { n: failed.length }) : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={T("collect.fu.title")} subtitle={`${date(data.as_of, lang)} · ${summary.join(" · ")}`} />
      <p className="-mt-3 mb-6 max-w-prose text-ink-muted">{T("collect.fu.intro")}</p>
      {!mailSetup().configured && <p role="note" className="mb-6 max-w-prose rounded-xl bg-info-soft p-3 text-info">{T("collect.fu.no_email_mode")}</p>}
      {festival?.quiet && <QuietBanner lang={lang} quiet={festival.quiet} />}
      {festival?.drive && <FestivalDrive lang={lang} view={festival} role={role} />}

      {nothing && (
        <EmptyState
          title={data.next_due ? T("collect.fu.empty_next", { date: date(data.next_due, lang) }) : T("collect.fu.empty_none")}
          description={T("collect.fu.empty_body")}
        />
      )}

      {ready.length > 0 && (
        <section aria-labelledby="sec-ready">
          <SectionTitle id="sec-ready" count={ready.length}>
            {T("collect.fu.ready")}
          </SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {ready.length > CAP && <p className="text-ink-muted">{T("pages.cap.first", { n: CAP, of: ready.length })}</p>}
            {ready.slice(0, CAP).map((r) => (
              <FollowupCard key={r.id} row={r} {...common} />
            ))}
          </div>
        </section>
      )}

      {calls.length > 0 && (
        <section aria-labelledby="sec-calls">
          <SectionTitle id="sec-calls" count={calls.length}>
            {T("collect.call.section")}
          </SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {calls.length > CAP && <p className="text-ink-muted">{T("pages.cap.first", { n: CAP, of: calls.length })}</p>}
            {calls.slice(0, CAP).map((inv) => (
              <CallCard key={inv.id} inv={inv} business={data.business} {...common} />
            ))}
          </div>
        </section>
      )}

      {failed.length > 0 && (
        <section aria-labelledby="sec-failed">
          <SectionTitle id="sec-failed" count={failed.length}>
            {T("collect.fu.failed")}
          </SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {failed.length > CAP && <p className="text-ink-muted">{T("pages.cap.first", { n: CAP, of: failed.length })}</p>}
            {failed.slice(0, CAP).map((r) => (
              <FollowupCard key={r.id} row={r} {...common} />
            ))}
          </div>
        </section>
      )}

      {held.length > 0 && (
        <section aria-labelledby="sec-held">
          <SectionTitle id="sec-held" count={held.length}>
            {T("collect.fu.held")}
          </SectionTitle>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {held.length > CAP && <p className="text-ink-muted">{T("pages.cap.first", { n: CAP, of: held.length })}</p>}
            {held.slice(0, CAP).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <span className="font-semibold">{r.customer_name}</span> · {r.invoices.map((i) => i.number).join(", ")}
                </span>
                <StatusPill status="info" label={T(`collect.hold.${r.hold}`, { date: date(r.hold_until, lang) })} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="sec-done">
          <SectionTitle id="sec-done" count={done.length}>
            {T("collect.fu.done")}
          </SectionTitle>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {done.length > CAP && <p className="text-ink-muted">{T("pages.cap.first", { n: CAP, of: done.length })}</p>}
            {done.slice(0, CAP).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <span className="font-semibold">{r.customer_name}</span> · {r.invoices.map((i) => i.number).join(", ")} · <span className="tnum">{inr(r.amount_paise)}</span>
                </span>
                <StatusPill status="success" label={T("collect.fu.sent_via", { channel: T(`collect.chan.${r.channel}`), time: r.sent_time ?? "" })} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-sm text-ink-muted">{T("collect.fu.rules")}</p>
    </>
  );
}
