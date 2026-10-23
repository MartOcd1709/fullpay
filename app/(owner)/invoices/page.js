import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Money from "@/components/ui/Money";
import StatusChip from "@/components/ui/StatusChip";
import DataTable from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { ImportInvoices } from "@/components/pages/ImportInvoices";
import { run } from "@/lib/services/context";
import * as invoices from "@/lib/services/invoices";
import { isDueSoon, isOverdue } from "@/lib/services/common";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("nav.invoices") };
}

const STATUSES = ["overdue", "due_soon", "part_paid", "disputed", "sent", "paid", "draft"];
const DERIVED = { due_soon: isDueSoon, overdue: isOverdue };
const KEYS = ["q", "customer", "status", "due_from", "due_to", "min", "max"];
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isNum = (s) => /^\d{1,4}$/.test(s);

export default async function InvoicesPage({ searchParams }) {
  const T = await getT();
  const sp = await searchParams;
  const f = Object.fromEntries(KEYS.map((k) => [k, one(sp?.[k]).slice(0, 80)]));
  const filters = {
    q: f.q || undefined,
    customer_id: /^\d+$/.test(f.customer) ? f.customer : undefined,
    due_from: isDate(f.due_from) ? f.due_from : undefined,
    due_to: isDate(f.due_to) ? f.due_to : undefined,
    min_days_overdue: isNum(f.min) ? f.min : undefined,
    max_days_overdue: isNum(f.max) ? f.max : undefined,
  };
  const status = STATUSES.includes(f.status) ? f.status : "";

  let rows, customers, asOf;
  try {
    ({ rows, customers, asOf } = await run(async (c, ctx) => ({
      rows: await invoices.list(c, ctx, filters),
      customers: (await c.query("SELECT id, name FROM customers ORDER BY name")).rows,
      asOf: ctx.asOf,
    })));
  } catch (err) {
    console.error("[invoices]", err);
    return (
      <>
        <PageHeader title={T("nav.invoices")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/invoices" retryLabel={T("btn.retry")} />
      </>
    );
  }

  const match = (r, s) => (DERIVED[s] ? DERIVED[s](r, asOf) : r.display_status === s);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => match(r, s)).length]));
  const shown = status ? rows.filter((r) => match(r, status)) : rows;
  const PAGE = 100;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(one(sp?.page), 10) || 1));
  const visible = shown.slice((page - 1) * PAGE, page * PAGE);
  const qs = (patch) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v));
    const s = p.toString();
    return s ? `/invoices?${s}` : "/invoices";
  };
  const moreOpen = !!(f.customer || f.due_from || f.due_to || f.min || f.max);
  const anyFilter = KEYS.some((k) => f[k]);

  const columns = [
    {
      key: "number",
      label: T("field.invoice_number"),
      primary: true,
      render: (r) => (
        <Link href={`/invoices/${r.id}`} className="inline-flex min-h-12 items-center gap-1 font-semibold text-accent sm:min-h-0">
          <span className="mono">{r.number ?? T("core.inv.draft_label")}</span>
        </Link>
      ),
    },
    { key: "customer_name", label: T("field.customer"), render: (r) => <span className="font-medium">{r.customer_name}</span> },
    { key: "due_date", label: T("field.due_date"), render: (r) => <span className="whitespace-nowrap">{T.date(r.due_date)}</span> },
    { key: "total", label: T("core.inv.amount"), align: "right", render: (r) => <Money paise={r.total_paise} /> },
    { key: "owed", label: T("core.inv.still_owed"), align: "right", render: (r) => <Money paise={r.status === "draft" ? r.total_paise : r.outstanding_paise} className="font-semibold" /> },
    {
      key: "status",
      label: T("field.status"),
      render: (r) => (
        <span className="flex flex-col items-end gap-1 sm:items-start">
          <StatusChip status={r.display_status} lang={T.lang} days={r.days_overdue} />
          {r.paused_by && <span className="text-sm text-ink-muted">{T(`core.inv.paused_${r.paused_by}`)}</span>}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={T("nav.invoices")}
        subtitle={T("core.inv.list_sub", { n: rows.length })}
        actions={<><ImportInvoices lang={T.lang} /><Button href="/invoices/new"><Icon name="plus" />{T("nav.new_invoice")}</Button></>}
      />

      <nav aria-label={T("core.inv.filter_status")} className="-mx-1 mb-4 flex flex-wrap gap-2">
        <Link href={qs({ status: "" })} aria-current={!status ? "true" : undefined} className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 font-semibold no-underline ${!status ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-accent"}`}>
          {T("common.all")} <span className="tnum">{rows.length}</span>
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={qs({ status: status === s ? "" : s })}
            aria-current={status === s ? "true" : undefined}
            className={`inline-flex min-h-12 items-center gap-1 rounded-full border px-1.5 pr-3 no-underline ${status === s ? "border-accent ring-2 ring-accent" : "border-line bg-surface hover:border-accent"}`}
          >
            <StatusChip status={s} lang={T.lang} />
            <span className="tnum font-semibold text-ink">{counts[s]}</span>
          </Link>
        ))}
      </nav>

      <form method="get" action="/invoices" className="mb-6 rounded-xl border border-line bg-surface p-4" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="flex flex-wrap items-end gap-3">
          <Field id="q" label={T("core.inv.search_label")} className="min-w-0 flex-1 basis-60">
            <Input id="q" type="search" defaultValue={f.q} placeholder={T("invoices.search")} autoComplete="off" />
          </Field>
          <Button type="submit"><Icon name="search" />{T("core.inv.search_btn")}</Button>
        </div>
        <details className="mt-3" open={moreOpen}>
          <summary className="inline-flex min-h-12 cursor-pointer items-center font-semibold text-accent">{T("core.inv.more_filters")}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field id="customer" label={T("field.customer")}>
              <Select id="customer" defaultValue={f.customer}>
                <option value="">{T("common.all")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field id="due_from" label={T("core.inv.due_from")}>
              <Input id="due_from" type="date" defaultValue={f.due_from} />
            </Field>
            <Field id="due_to" label={T("core.inv.due_to")}>
              <Input id="due_to" type="date" defaultValue={f.due_to} />
            </Field>
            <Field id="min" label={T("core.inv.min_over")}>
              <Input id="min" type="number" min="0" max="9999" inputMode="numeric" defaultValue={f.min} />
            </Field>
            <Field id="max" label={T("core.inv.max_over")}>
              <Input id="max" type="number" min="0" max="9999" inputMode="numeric" defaultValue={f.max} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit">{T("core.inv.apply")}</Button>
            {anyFilter && <Button variant="secondary" href="/invoices">{T("core.inv.clear")}</Button>}
          </div>
        </details>
      </form>

      <p className="mb-3 font-medium text-ink-muted" aria-live="polite">
        {T("core.inv.showing", { n: visible.length, total: shown.length })}
      </p>
      <DataTable
        caption={T("nav.invoices")}
        columns={columns}
        rows={visible}
        empty={
          <EmptyState
            title={rows.length || anyFilter ? T("core.inv.none_match") : T("invoices.empty")}
            action={anyFilter ? <Button variant="secondary" href="/invoices">{T("core.inv.clear")}</Button> : <Button href="/invoices/new">{T("nav.new_invoice")}</Button>}
          />
        }
      />
      {pages > 1 && (
        <nav aria-label={T("pages.page.label")} className="mt-4 flex flex-wrap items-center gap-3">
          {page > 1 && <Button variant="secondary" href={qs({ status, page: String(page - 1) })}>{T("pages.page.prev")}</Button>}
          <span className="text-ink-muted">{T("pages.page.of", { n: page, of: pages })}</span>
          {page < pages && <Button variant="secondary" href={qs({ status, page: String(page + 1) })}>{T("pages.page.next")}</Button>}
        </nav>
      )}
    </>
  );
}
