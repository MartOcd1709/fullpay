import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Money from "@/components/ui/Money";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { run } from "@/lib/services/context";
import * as invoices from "@/lib/services/invoices";

const LETTER_RUNGS = new Set(["demand_letter", "odr_guidance"]);

export async function generateMetadata() {
  const T = await getT();
  return { title: T("documents.title") };
}

export default async function DocumentsPage() {
  const T = await getT();
  let rows;
  try {
    rows = await run(async (c, ctx) => {
      const list = (await invoices.list(c, ctx, {})).filter((r) => r.status !== "draft");
      const { rows: counts } = await c.query(
        `SELECT invoice_id, count(*)::int AS n FROM escalation_events WHERE invoice_id IS NOT NULL GROUP BY invoice_id`,
      );
      const n = new Map(counts.map((r) => [Number(r.invoice_id), r.n]));
      return list.map((r) => ({ ...r, events: n.get(Number(r.id)) ?? 0 }));
    });
  } catch (err) {
    console.error("[documents]", err);
    return (
      <>
        <PageHeader title={T("documents.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/documents" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const open = (r) => (r.status === "paid" ? 0 : 1);
  rows.sort((a, b) => open(b) - open(a) || (b.days_overdue ?? 0) - (a.days_overdue ?? 0));
  const link = "inline-flex min-h-12 items-center rounded-xl border border-line px-3 font-semibold no-underline hover:bg-surface-2";
  return (
    <>
      <PageHeader title={T("documents.title")} subtitle={T("pages.docs.intro")} />
      {rows.length === 0 ? (
        <EmptyState title={T("documents.empty")} />
      ) : (
        <ul className="grid gap-3" aria-label={T("documents.title")}>
          {rows.map((inv) => (
            <li key={inv.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0">
                  <span className="mono font-semibold">{inv.number}</span> · <span>{inv.customer_name}</span>
                </span>
                <Money paise={inv.status === "paid" ? inv.total_paise : inv.outstanding_paise} className="font-bold" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
                <StatusChip status={inv.display_status} lang={T.lang} days={inv.days_overdue} />
                <span>{T("pages.docs.entries", { n: inv.events })}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/invoices/${inv.id}#tl-h`} className={link}>{T("pages.docs.timeline")}</Link>
                <Link href={`/print/invoice/${inv.id}`} className={link}>{T("pages.docs.invoice")}</Link>
                {LETTER_RUNGS.has(inv.rung) && <Link href={`/print/letter/${inv.id}`} className={link}>{T("pages.docs.letter")}</Link>}
                <Link href={`/print/bundle/${inv.id}`} className={link}>{T("pages.docs.bundle")}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
