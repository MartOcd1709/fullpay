import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { run } from "@/lib/services/context";
import * as invoices from "@/lib/services/invoices";
import NewInvoiceForm from "./NewInvoiceForm";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("nav.new_invoice") };
}

// ?draft=<id> edits an existing draft; ?customer=<id> preselects a customer.
export default async function NewInvoicePage({ searchParams }) {
  const T = await getT();
  const sp = await searchParams;
  const draftId = /^\d{1,12}$/.test(String(sp?.draft ?? "")) ? sp.draft : null;
  let data;
  try {
    data = await run(async (c, ctx) => {
      const { rows } = await c.query("SELECT id, name, gstin, state_code, credit_days, preferred_lang, anonymized_at FROM customers ORDER BY name");
      const draft = draftId ? await invoices.get(c, ctx, draftId).catch(() => null) : null;
      const b = ctx.cfg.business;
      return {
        asOf: ctx.asOf,
        customers: rows,
        business: { name: b.name, state_code: b.state_code, registration: b.registration, turnover_paise: b.turnover_paise },
        rates: ctx.cfg.gst.rates_bps,
        draft: draft?.status === "draft" ? { id: draft.id, customer_id: draft.customer_id, issue_date: draft.issue_date, delivery_date: draft.delivery_date, place_of_supply: draft.place_of_supply, reverse_charge: draft.reverse_charge, ship_to: draft.ship_to, notes: draft.notes, items: draft.items } : null,
        draftMissing: !!draftId && draft?.status !== "draft",
      };
    });
  } catch (err) {
    console.error("[new-invoice]", err);
    return <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/invoices/new" retryLabel={T("btn.retry")} />;
  }
  if (data.draftMissing) {
    return <EmptyState title={T("core.nw.not_draft")} description={T("core.nw.not_draft_body")} action={<Button href="/invoices/new">{T("nav.new_invoice")}</Button>} />;
  }
  return (
    <>
      <PageHeader title={data.draft ? T("core.nw.edit_title") : T("nav.new_invoice")} subtitle={T("core.nw.subtitle")} />
      <NewInvoiceForm
        lang={T.lang}
        asOf={data.asOf}
        business={data.business}
        rates={data.rates}
        customers={data.customers}
        draft={data.draft}
        preselect={/^\d+$/.test(String(sp?.customer ?? "")) ? sp.customer : null}
      />
    </>
  );
}
