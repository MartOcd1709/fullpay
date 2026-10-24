import Link from "next/link";
import Money from "./Money";
import StatusChip from "./StatusChip";
import Icon from "./Icon";

// One bill as a tappable row: customer · number · still owed · status chip · when. Reused by the dashboard top 5,
// customer detail, documents and anywhere a list of bills appears (K22).
export function InvoiceRow({ inv, T, asOf, rank, reason, href, showCustomer = true, extra }) {
  const open = inv.status !== "paid" && inv.status !== "draft";
  const owed = open ? inv.outstanding_paise : inv.total_paise;
  const when =
    inv.status === "draft"
      ? T("core.inv.draft_unnumbered")
      : inv.status === "paid"
        ? T("core.inv.paid_total")
        : inv.days_overdue > 0
          ? T("core.inv.days_late", { n: inv.days_overdue })
          : T("core.inv.due_on", { date: T.date(inv.due_date), rel: T.rel(inv.due_date, asOf) });
  return (
    <li>
      <Link
        href={href ?? `/invoices/${inv.id}`}
        className="hover-lift flex min-h-12 items-start gap-3 rounded-xl border border-line bg-surface p-4 text-ink no-underline hover:border-accent focus-visible:border-accent"
      >
        {rank != null && (
          <span aria-hidden="true" className="tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent">
            {rank}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 font-semibold">
              {rank != null && <span className="sr-only">{rank}. </span>}
              {showCustomer ? inv.customer_name : inv.number ?? T("core.inv.draft_label")}
            </span>
            <Money paise={owed} className="text-lg font-bold" />
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
            {showCustomer && <span className="mono text-sm">{inv.number ?? T("core.inv.draft_label")}</span>}
            <StatusChip status={inv.display_status} lang={T.lang} days={inv.days_overdue} />
            <span>{when}</span>
          </span>
          {reason && <span className="mt-2 block text-ink">{reason}</span>}
          {extra}
        </span>
        <Icon name="chevron" className="mt-1 h-5 w-5 text-ink-muted" />
      </Link>
    </li>
  );
}

export function InvoiceList({ children, label }) {
  return (
    <ul className="space-y-3" aria-label={label}>
      {children}
    </ul>
  );
}

export default InvoiceRow;
