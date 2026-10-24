import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Money from "@/components/ui/Money";
import { InvoiceRow, InvoiceList } from "@/components/ui/InvoiceRow";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { EditCustomer, OptOutToggle, Anonymize } from "@/components/pages/CustomerActions";
import { Grade, gradeReason, habitText } from "@/components/pages/Grade";
import { run } from "@/lib/services/context";
import * as customers from "@/lib/services/customers";
import * as invoices from "@/lib/services/invoices";
import * as statement from "@/lib/services/statement";
import { stateName } from "@/lib/gst";
import CopyButton from "@/components/public/CopyButton";
import { waDigits } from "@/components/collect/kit";

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
      stmtToken: await statement.ensureToken(c, Number(id)),
      business: ctx.cfg.business.name,
      asOf: ctx.asOf,
    }));
  } catch (err) {
    if (err?.status === 404) notFound();
    console.error("[customer]", err);
    return <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref={`/customers/${id}`} retryLabel={T("btn.retry")} />;
  }
  const { customer: c, rows, asOf, stmtToken, business } = data;
  const stmtUrl = stmtToken ? `${(process.env.APP_URL || "").replace(/\/+$/, "")}/s/${stmtToken}` : null;
  const wa = waDigits(c.phone);
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
            {c.treds_buyer && <span className="inline-flex w-fit rounded-full bg-info-soft px-2 py-0.5 text-sm font-semibold text-info">{T("pages.treds.chip")}</span>}
            <p className="mt-1 text-ink-muted"><strong>{T("pages.habit.label")}:</strong> {habitText(c, T) ?? T("pages.habit.none")}</p>
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
      {stmtUrl && (
        <Card title={T("pages.stmt.title")} className="mt-4">
          <p className="text-ink-muted">{T("pages.stmt.body")}</p>
          <p className="mt-2 break-all select-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm" data-testid="statement-url">{stmtUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={stmtUrl} label={T("pages.stmt.copy")} done={T("pages.stmt.copied")} />
            {wa && <Button variant="secondary" href={`https://wa.me/${wa}?text=${encodeURIComponent(T("pages.stmt.message", { name: c.name, business, url: stmtUrl }))}`} target="_blank" rel="noopener noreferrer">{T("pages.stmt.whatsapp")}</Button>}
            <Button variant="ghost" href={`/s/${stmtToken}`} target="_blank">{T("pages.stmt.open")}</Button>
          </div>
        </Card>
      )}
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
