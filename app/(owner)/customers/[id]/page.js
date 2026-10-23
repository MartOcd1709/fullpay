import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Money from "@/components/ui/Money";
import { InvoiceRow, InvoiceList } from "@/components/ui/InvoiceRow";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { EditCustomer, OptOutToggle, Anonymize } from "@/components/pages/CustomerActions";
import { Grade, gradeReason } from "@/components/pages/Grade";
import { run } from "@/lib/services/context";
import * as customers from "@/lib/services/customers";
import * as invoices from "@/lib/services/invoices";
import { stateName } from "@/lib/gst";

export async function generateMetadata({ params }) {
  const T = await getT();
  return { title: `${T("customers.title")} #${(await params).id}` };
}

export default async function CustomerPage({ params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const T = await getT();
  let data;
  try {
    data = await run(async (c, ctx) => ({
      customer: await customers.get(c, ctx, Number(id)),
      rows: await invoices.list(c, ctx, { customer_id: Number(id) }),
      asOf: ctx.asOf,
    }));
  } catch (err) {
    if (err?.status === 404) notFound();
    console.error("[customer]", err);
    return <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref={`/customers/${id}`} retryLabel={T("btn.retry")} />;
  }
  const { customer: c, rows, asOf } = data;
  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={c.gstin ?? T("customers.unregistered")}
        actions={<Button variant="ghost" href="/customers">{T("pages.cust.back")}</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={T.term("customers.grade").label}>
          <div className="flex flex-col gap-3">
            <Grade grade={c.grade} T={T} />
            <p>{gradeReason(c, T)}</p>
            <p className="text-ink-muted">
              {T("customers.total_owed")}: <Money paise={c.total_owed_paise ?? 0} className="font-bold text-ink" />
            </p>
          </div>
        </Card>
        <Card title={T("pages.cust.contact")}>
          <dl className="grid gap-2">
            <div><dt className="text-sm text-ink-muted">{T("pages.cust.state")}</dt><dd>{stateName(c.state_code, T.lang)} ({c.state_code})</dd></div>
            {c.address && <div><dt className="text-sm text-ink-muted">{T("pages.set.address")}</dt><dd translate="no">{c.address}</dd></div>}
            {c.email && <div><dt className="text-sm text-ink-muted">Email</dt><dd className="break-all select-all">{c.email}</dd></div>}
            {c.phone && <div><dt className="text-sm text-ink-muted">Phone</dt><dd className="select-all">{c.phone}</dd></div>}
            <div><dt className="text-sm text-ink-muted">{T("pages.cust.lang")}</dt><dd>{c.preferred_lang === "hi" ? "हिंदी" : "English"}</dd></div>
            <div><dt className="text-sm text-ink-muted">{T.term("customers.avg_late").label}</dt><dd>{c.credit_days != null ? T("pages.cust.credit_days", { n: c.credit_days }) : T("pages.cust.credit_default")}</dd></div>
          </dl>
        </Card>
        <Card title={T("privacy.title")}>
          <div className="flex flex-col gap-3">
            {c.opt_out && <p className="font-semibold text-warning">{T("customers.optout_on")}</p>}
            {c.anonymized_at ? (
              <p>{T("customers.anonymized")}</p>
            ) : (
              <>
                <EditCustomer lang={T.lang} customer={c} label={T("btn.edit")} />
                <OptOutToggle lang={T.lang} id={c.id} optOut={c.opt_out} />
                <Anonymize lang={T.lang} id={c.id} />
                <p className="text-sm text-ink-muted">{T("privacy.anonymize_hint")}</p>
              </>
            )}
          </div>
        </Card>
      </div>
      <h2 className="mb-3 mt-6 text-lg font-semibold">{T("pages.cust.invoices")}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-muted">{T("pages.cust.no_invoices")}</p>
      ) : (
        <InvoiceList label={T("pages.cust.invoices")}>
          {rows.map((inv) => <InvoiceRow key={inv.id} inv={inv} T={T} asOf={asOf} showCustomer={false} />)}
        </InvoiceList>
      )}
    </>
  );
}
