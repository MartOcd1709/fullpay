import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Money from "@/components/ui/Money";
import Term from "@/components/ui/Term";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { AddCustomer } from "@/components/pages/CustomerActions";
import { Grade, gradeReason } from "@/components/pages/Grade";
import { run } from "@/lib/services/context";
import * as customers from "@/lib/services/customers";
import { STATE_CODES } from "@/lib/gst";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("customers.title") };
}

export default async function CustomersPage() {
  const T = await getT();
  let rows;
  try {
    rows = await run((c, ctx) => customers.list(c, ctx));
  } catch (err) {
    console.error("[customers]", err);
    return (
      <>
        <PageHeader title={T("customers.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/customers" retryLabel={T("btn.retry")} />
      </>
    );
  }
  rows.sort((a, b) => (b.total_owed_paise ?? 0) - (a.total_owed_paise ?? 0));
  return (
    <>
      <PageHeader title={T("customers.title")} actions={<AddCustomer lang={T.lang} />} />
      {rows.length === 0 ? (
        <EmptyState title={T("customers.empty")} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label={T("customers.title")}>
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-ink no-underline hover:border-accent focus-visible:border-accent"
              >
                <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="mono block text-sm text-ink-muted">
                      {c.gstin ?? T("customers.unregistered")} · {STATE_CODES[c.state_code] ?? c.state_code}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm text-ink-muted">{T("customers.total_owed")}</span>
                    <Money paise={c.total_owed_paise ?? 0} className="text-lg font-bold" />
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Grade grade={c.grade} T={T} />
                  <span className="text-ink-muted">{gradeReason(c, T)}</span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                  <span>{c.credit_days != null ? T("pages.cust.credit_days", { n: c.credit_days }) : T("pages.cust.credit_default")}</span>
                  {c.opt_out && <span className="font-semibold text-warning">{T("customers.optout_on")}</span>}
                  {c.anonymized_at && <span>{T("customers.anonymized")}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-ink-muted">
        <Term {...T.term("customers.grade")} />
      </p>
    </>
  );
}
