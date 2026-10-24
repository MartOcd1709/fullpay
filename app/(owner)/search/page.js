import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import { InvoiceRow, InvoiceList } from "@/components/ui/InvoiceRow";
import { Field, Input } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { run } from "@/lib/services/context";
import { search } from "@/lib/services/search";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("pages.search.title") };
}

function Section({ title, n, children }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">{title} <span className="tnum text-ink-muted">({n})</span></h2>
      {children}
    </section>
  );
}

export default async function SearchPage({ searchParams }) {
  const T = await getT();
  const sp = await searchParams;
  const q = String((Array.isArray(sp?.q) ? sp.q[0] : sp?.q) ?? "");
  let r;
  try {
    r = await run((c, ctx) => search(c, ctx, q).then((x) => ({ ...x, asOf: ctx.asOf })));
  } catch (err) {
    console.error("[search]", err);
    return <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/search" retryLabel={T("btn.retry")} />;
  }
  const total = r.customers.length + r.invoices.length + r.payments.length;
  return (
    <>
      <PageHeader title={T("pages.search.title")} subtitle={T("pages.search.subtitle")} />
      <form method="get" action="/search" role="search" className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field id="search-q" label={T("pages.search.label")} className="min-w-0 flex-1 basis-60">
            <Input id="search-q" name="q" type="search" defaultValue={r.q} placeholder={T("pages.search.placeholder")} autoComplete="off" autoFocus={!r.q} />
          </Field>
          <Button type="submit"><Icon name="search" />{T("core.inv.search_btn")}</Button>
        </div>
      </form>

      {r.q.length >= 2 && total === 0 && <p className="mt-6 text-ink-muted">{T("pages.search.none", { q: r.q })}</p>}
      {r.q.length === 1 && <p className="mt-6 text-ink-muted">{T("pages.search.short")}</p>}

      {r.customers.length > 0 && (
        <Section title={T("nav.customers")} n={r.customers.length}>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {r.customers.map((c) => (
              <li key={c.id}>
                <Link href={`/customers/${c.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-3 no-underline hover:bg-surface-2">
                  <span className="font-semibold" translate="no">{c.name}</span>
                  <span className="text-sm text-ink-muted">{c.gstin ?? c.phone ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.invoices.length > 0 && (
        <Section title={T("nav.invoices")} n={r.invoices.length}>
          <InvoiceList label={T("nav.invoices")}>
            {r.invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} T={T} asOf={r.asOf} />)}
          </InvoiceList>
        </Section>
      )}

      {r.payments.length > 0 && (
        <Section title={T("nav.payments")} n={r.payments.length}>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {r.payments.map((p) => (
              <li key={p.id}>
                <Link href={p.invoice_id ? `/invoices/${p.invoice_id}` : "/payments"} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-3 no-underline hover:bg-surface-2">
                  <span className="min-w-0">
                    <Money paise={Number(p.amount_paise)} className="font-semibold" /> · {T.date(p.paid_on)} · {p.customer_name ?? T("collect.pay.unknown_payer")}
                    {p.reference && <span className="block break-all text-sm text-ink-muted">{p.reference}</span>}
                  </span>
                  <span className="text-sm font-semibold text-ink-muted">{T(`pages.search.pay_${p.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
