"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Term from "@/components/ui/Term";
import Sheet from "@/components/ui/Sheet";
import Money from "@/components/ui/Money";
import CustomerForm from "@/components/ui/CustomerForm";
import { Field, Input, Select, Textarea, Check } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";
import { invoiceTotals, isInterstate, validateHSN, hsnDigitsRequired, einvoiceRequired, docTypeFor, stateName as stateNameOf, stateList } from "@/lib/gst";
import { rupeesToPaise, amountInWords } from "@/lib/money";
import { addDays } from "@/lib/time";
import { UQC } from "@/lib/data/uqc";

const BTN = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-60";
const PRIMARY = `${BTN} bg-accent text-on-accent hover:bg-accent-strong`;
const SECONDARY = `${BTN} border border-line bg-surface text-ink hover:bg-surface-2`;

let seq = 0;
const blankItem = (gst) => ({ key: ++seq, description: "", hsn: "", qty: "1", unit: "PCS", rate: "", discount: "", gst });
const fromPaise = (p) => (p ? (p / 100).toFixed(2).replace(/\.00$/, "") : "");
const QTY = /^\d{1,9}(\.\d{1,3})?$/;

function parseItem(it, taxed) {
  const err = {};
  let rate_paise = null;
  let discount_paise = 0;
  if (!it.description.trim()) err.description = "core.nw.e_description";
  if (!QTY.test(it.qty.trim()) || Number(it.qty) <= 0) err.qty = "core.nw.e_qty";
  try {
    rate_paise = rupeesToPaise(it.rate);
  } catch {
    err.rate = "core.nw.e_rate";
  }
  if (it.discount.trim()) {
    try {
      discount_paise = rupeesToPaise(it.discount);
    } catch {
      err.discount = "core.nw.e_rate";
    }
  }
  const qty_milli = QTY.test(it.qty.trim()) ? Math.round(Number(it.qty) * 1000) : 0;
  if (!err.rate && !err.qty && !err.discount && discount_paise > Math.round((qty_milli * rate_paise) / 1000)) err.discount = "core.nw.e_discount";
  return { err, item: { description: it.description.trim(), hsn_sac: it.hsn.trim() || null, qty_milli, unit: it.unit, rate_paise, discount_paise, gst_bps: taxed ? Number(it.gst) : 0 } };
}

export default function NewInvoiceForm({ lang, asOf, business, rates, customers: initialCustomers, draft, preselect }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const registration = business.registration ?? "regular";
  const taxed = docTypeFor(registration) === "tax_invoice";
  const defaultRate = rates.includes(1800) ? 1800 : rates[0];

  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(String(draft?.customer_id ?? preselect ?? ""));
  const [pos, setPos] = useState(draft?.place_of_supply ?? "");
  const [issueDate, setIssueDate] = useState(draft?.issue_date ?? asOf);
  const [deliveryDate, setDeliveryDate] = useState(draft?.delivery_date ?? "");
  const [reverse, setReverse] = useState(!!draft?.reverse_charge);
  const [shipTo, setShipTo] = useState(draft?.ship_to ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [items, setItems] = useState(() =>
    draft?.items?.length
      ? draft.items.map((it) => ({ key: ++seq, description: it.description, hsn: it.hsn_sac ?? "", qty: String(it.qty_milli / 1000), unit: it.unit ?? "PCS", rate: fromPaise(it.rate_paise), discount: fromPaise(it.discount_paise), gst: it.gst_bps }))
      : [blankItem(defaultRate)],
  );
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(null);
  const [formError, setFormError] = useState("");

  const customer = customers.find((c) => String(c.id) === customerId) ?? null;
  const placeOfSupply = pos || customer?.state_code || "";
  const credit = Math.min(customer?.credit_days ?? 15, 45);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate || issueDate) ? addDays(deliveryDate || issueDate, credit) : null;

  const parsed = items.map((it) => parseItem(it, taxed));
  const valid = parsed.filter((p) => !Object.keys(p.err).length).map((p) => p.item);
  const interstate = placeOfSupply ? isInterstate(business.state_code, placeOfSupply) : false;
  const totals = valid.length ? invoiceTotals(valid, { interstate, registration }) : null;
  const hsnNeed = hsnDigitsRequired(business.turnover_paise);
  const hsnErr = (it) => (taxed && !validateHSN(it.hsn, business.turnover_paise) ? T("new_invoice.hsn_digits", { n: hsnNeed }) : "");

  const update = (key, patch) => setItems(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const stateName = (code) => stateNameOf(code, T.lang);

  function payload() {
    return {
      customer_id: Number(customerId),
      issue_date: issueDate,
      delivery_date: deliveryDate || null,
      place_of_supply: placeOfSupply,
      reverse_charge: reverse,
      ship_to: shipTo.trim() || null,
      notes: notes.trim() || null,
      items: parsed.map((p) => p.item),
    };
  }

  function check() {
    setTouched(true);
    if (!customer) return T("core.nw.e_customer");
    if (parsed.some((p) => Object.keys(p.err).length) || items.some((it) => hsnErr(it))) return T("core.nw.e_items");
    return "";
  }

  async function save(andSend) {
    const problem = check();
    setFormError(problem);
    if (problem) return;
    setBusy(andSend ? "send" : "draft");
    try {
      const inv = draft?.id ? await api(`/api/invoices/${draft.id}`, { method: "PATCH", body: payload() }) : await api("/api/invoices", { body: payload() });
      if (andSend) {
        const out = await api(`/api/invoices/${inv.id}/send`, { body: {} });
        toast(T("core.act.sent_as", { number: out.invoice.number }));
      } else {
        toast(T("core.nw.draft_saved"));
      }
      router.push(`/invoices/${inv.id}`);
      router.refresh();
    } catch (e) {
      setFormError(e.code === "network" ? T("error.network") : e.message);
      setConfirmSend(false);
      setBusy(null);
    }
  }

  const taxLine = totals
    ? interstate
      ? T("core.nw.flip_other", { from: stateName(business.state_code), to: stateName(placeOfSupply), igst: T.money(totals.igst_paise) })
      : T("core.nw.flip_same", { from: stateName(business.state_code), to: stateName(placeOfSupply || business.state_code), cgst: T.money(totals.cgst_paise), sgst: T.money(totals.sgst_paise) })
    : "";

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
      {einvoiceRequired(business.turnover_paise) && (
        <p className="flex gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-3 font-medium text-info">
          <Icon name="info" className="mt-0.5" />
          {T("new_invoice.einvoice_note")}
        </p>
      )}
      {!taxed && <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 font-medium">{T(`core.nw.doc_${registration}`)}</p>}

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="s1">
        <h2 id="s1" className="mb-4 text-lg font-semibold">① {T("new_invoice.pick_customer")}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="customer" label={T("field.customer")} className="min-w-0 flex-1 basis-64" error={touched && !customer ? T("core.nw.e_customer") : ""}>
            <Select
              id="customer"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setPos("");
              }}
              error={touched && !customer ? "1" : ""}
            >
              <option value="">{T("core.nw.choose_customer")}</option>
              {customers.filter((c) => !c.anonymized_at).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <button type="button" className={SECONDARY} onClick={() => setAdding(true)}>
            <Icon name="plus" />
            {T("btn.add_customer")}
          </button>
        </div>
        {customer && (
          <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div className="flex flex-wrap gap-x-2"><dt className="font-semibold">{T("field.gstin")}:</dt><dd className="mono">{customer.gstin ?? T("customers.unregistered")}</dd></div>
            <div className="flex flex-wrap gap-x-2"><dt className="font-semibold">{T("field.state")}:</dt><dd>{stateName(customer.state_code)} ({customer.state_code})</dd></div>
            <div className="flex flex-wrap gap-x-2 sm:col-span-2"><dt className="font-semibold">{T("core.cust.credit_days")}:</dt><dd>{customer.credit_days == null ? T("core.inv.terms_none") : T("core.inv.terms_agreed", { n: credit })}</dd></div>
          </dl>
        )}
        {customer && customer.grade && (
          // Credit check before billing: the customer's own record, in words.
          <p role="note" className={`mt-3 rounded-xl border p-3 ${!customer.history ? "border-line bg-surface-2" : customer.grade === "C" ? "border-error/40 bg-error-soft" : customer.grade === "B" ? "border-warning/40 bg-warning-soft" : "border-success/40 bg-success-soft"}`}>
            <strong>{T("pages.credit.title")}: </strong>
            {!customer.history ? T("pages.credit.new")
              : customer.grade === "C" ? T("pages.credit.c", { name: customer.name, owed: T.money(customer.total_owed_paise), late: Math.round(customer.avg_late_days ?? 0) })
              : customer.grade === "B" ? T("pages.credit.b", { name: customer.name, owed: T.money(customer.total_owed_paise), late: Math.round(customer.avg_late_days ?? 0), pct: Math.round(customer.pct_on_time ?? 0) })
              : T("pages.credit.a", { name: customer.name, pct: Math.round(customer.pct_on_time ?? 100) })}
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field id="issue" label={T("field.invoice_date")}>
            <Input id="issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field id="delivery" label={T("core.nw.delivery_date")} hint={T("core.nw.delivery_hint")}>
            <Input id="delivery" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} hint="1" />
          </Field>
          <Field id="pos" label={T("core.nw.pos")} labelExtra={<Term {...T.term("core.nw.pos")} iconOnly />} hint={T("core.nw.pos_hint")}>
            <Select id="pos" value={placeOfSupply} onChange={(e) => setPos(e.target.value)} hint="1">
              <option value="">{T("core.cust.pick_state")}</option>
              {stateList(T.lang).map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </Select>
          </Field>
        </div>
        {customer && dueDate && (
          <p className="mt-3 flex gap-2 font-medium">
            <Icon name="calendar" className="mt-0.5 text-accent" />
            {T("core.nw.due_sentence", { date: T.date(dueDate), days: credit, from: deliveryDate ? T("core.nw.from_delivery") : T("core.nw.from_invoice") })}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="s2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="s2" className="text-lg font-semibold">② {T("new_invoice.items")}</h2>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => setItems([...items.filter((it) => it.description || it.rate), { ...blankItem(1800), description: T("core.nw.sample_desc"), hsn: "8708", qty: "1", unit: "NOS", rate: "10000" }])}
          >
            <Icon name="sparkle" />
            {T("core.nw.sample")}
          </button>
        </div>
        <ol className="space-y-4">
          {items.map((it, i) => {
            const e = touched ? parsed[i].err : {};
            const he = touched ? hsnErr(it) : "";
            const id = (f) => `it${it.key}-${f}`;
            return (
              <li key={it.key} className="rounded-xl border border-line p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold">{T("core.nw.item_n", { n: i + 1 })}</p>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(items.filter((x) => x.key !== it.key))} className="inline-flex min-h-12 items-center gap-1 rounded-xl px-3 font-semibold text-error hover:bg-error-soft">
                      <Icon name="close" className="h-4 w-4" />
                      {T("core.nw.remove")}
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <Field id={id("d")} label={T("field.description")} className="sm:col-span-4" error={e.description && T(e.description)}>
                    <Input id={id("d")} value={it.description} onChange={(ev) => update(it.key, { description: ev.target.value })} error={e.description} />
                  </Field>
                  <Field id={id("h")} label={T("core.nw.hsn")} labelExtra={<Term {...T.term("core.nw.hsn")} iconOnly />} className="sm:col-span-2" error={he}>
                    <Input id={id("h")} inputMode="numeric" value={it.hsn} onChange={(ev) => update(it.key, { hsn: ev.target.value.replace(/\D/g, "").slice(0, 8) })} error={he} />
                  </Field>
                  <Field id={id("q")} label={T("field.qty")} error={e.qty && T(e.qty)}>
                    <Input id={id("q")} inputMode="decimal" value={it.qty} onChange={(ev) => update(it.key, { qty: ev.target.value })} error={e.qty} />
                  </Field>
                  <Field id={id("u")} label={T("field.unit")}>
                    <Select id={id("u")} value={it.unit} onChange={(ev) => update(it.key, { unit: ev.target.value })}>
                      {UQC.map((u) => (
                        <option key={u.code} value={u.code}>{u.code} · {u.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={id("r")} label={T("core.nw.rate")} className="sm:col-span-2" error={e.rate && T(e.rate)}>
                    <Input id={id("r")} inputMode="decimal" value={it.rate} onChange={(ev) => update(it.key, { rate: ev.target.value })} error={e.rate} placeholder="₹" />
                  </Field>
                  <Field id={id("x")} label={T("core.nw.discount")} error={e.discount && T(e.discount)}>
                    <Input id={id("x")} inputMode="decimal" value={it.discount} onChange={(ev) => update(it.key, { discount: ev.target.value })} error={e.discount} placeholder="₹" />
                  </Field>
                  {taxed && (
                    <Field id={id("g")} label={T("field.gst_rate")}>
                      <Select id={id("g")} value={it.gst} onChange={(ev) => update(it.key, { gst: Number(ev.target.value) })}>
                        {rates.map((r) => (
                          <option key={r} value={r}>{r / 100}%</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" className={`${SECONDARY} mt-4 w-full sm:w-auto`} onClick={() => setItems([...items, blankItem(defaultRate)])}>
          <Icon name="plus" />
          {T("btn.add_item")}
        </button>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="s3">
        <h2 id="s3" className="mb-4 text-lg font-semibold">③ {T("core.nw.totals")}</h2>
        {totals ? (
          <div aria-live="polite">
            {taxed && (
              <p className="mb-4 flex gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 font-semibold text-accent">
                <Icon name="scale" className="mt-0.5" />
                {taxLine}
              </p>
            )}
            <dl className="space-y-2">
              <TotalRow label={<Term {...T.term("core.nw.taxable")} />} paise={totals.taxable_paise} />
              {taxed && !interstate && <TotalRow label="CGST" paise={totals.cgst_paise} />}
              {taxed && !interstate && <TotalRow label="SGST" paise={totals.sgst_paise} />}
              {taxed && interstate && <TotalRow label="IGST" paise={totals.igst_paise} />}
              <TotalRow label={<Term {...T.term("core.nw.round_off")} />} paise={totals.round_off_paise} />
              <TotalRow label={T("field.total")} paise={totals.total_paise} strong />
            </dl>
            <p className="mt-3 text-ink-muted">
              <span className="font-semibold">{T("field.in_words")}:</span> {amountInWords(totals.total_paise, lang)}
            </p>
          </div>
        ) : (
          <p className="text-ink-muted">{T("core.nw.totals_empty")}</p>
        )}
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          {taxed && <Check id="rc" label={T("core.nw.reverse")} hint={T("core.nw.reverse_hint")} checked={reverse} onChange={(e) => setReverse(e.target.checked)} />}
          <details open={!!shipTo}>
            <summary className="inline-flex min-h-12 cursor-pointer items-center font-semibold text-accent">{T("field.ship_to")}</summary>
            <Field id="ship" label={T("field.ship_to")} className="mt-2">
              <Textarea id="ship" value={shipTo} onChange={(e) => setShipTo(e.target.value)} rows={3} />
            </Field>
          </details>
          <Field id="notes" label={`${T("field.notes")} (${T("common.optional")})`}>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
      </section>

      {formError && <p role="alert" className="rounded-xl border border-error/40 bg-error-soft px-4 py-3 font-medium text-error">{formError}</p>}

      <div className="sticky bottom-[4.75rem] z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg lg:bottom-4">
        <p className="min-w-0 flex-1 basis-40">
          <span className="block text-ink-muted">{T("field.total")}</span>
          <span className="text-xl font-bold">{totals ? <Money paise={totals.total_paise} /> : "—"}</span>
          {totals && taxed && <span className="block text-sm text-ink-muted">{interstate ? `IGST ${T.money(totals.igst_paise)}` : `CGST ${T.money(totals.cgst_paise)} + SGST ${T.money(totals.sgst_paise)}`}</span>}
        </p>
        <button type="button" className={SECONDARY} disabled={!!busy} onClick={() => save(false)}>
          {busy === "draft" ? T("core.saving") : T("btn.save_draft")}
        </button>
        <button
          type="button"
          className={PRIMARY}
          disabled={!!busy}
          onClick={() => {
            const problem = check();
            setFormError(problem);
            if (!problem) setConfirmSend(true);
          }}
        >
          <Icon name="send" />
          {T("btn.send")}
        </button>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title={T("btn.add_customer")} closeLabel={T("core.close")}>
        <CustomerForm
          lang={lang}
          submitLabel={T("btn.add_customer")}
          onCancel={() => setAdding(false)}
          onSaved={(c) => {
            setCustomers([...customers, c].sort((a, b) => a.name.localeCompare(b.name)));
            setCustomerId(String(c.id));
            setPos("");
            setAdding(false);
            toast(T("core.cust.added", { name: c.name }));
          }}
        />
      </Sheet>

      <Sheet
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title={T("core.act.send_title")}
        closeLabel={T("core.close")}
        footer={
          <>
            <button type="button" className={`${PRIMARY} flex-1`} disabled={!!busy} onClick={() => save(true)}>
              {busy === "send" ? T("core.act.working") : T("core.act.send_confirm")}
            </button>
            <button type="button" className={`${SECONDARY} flex-1`} onClick={() => setConfirmSend(false)}>{T("btn.cancel")}</button>
          </>
        }
      >
        <p>{T("core.act.send_body")}</p>
        {totals && customer && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 font-semibold">
            {customer.name} · <Money paise={totals.total_paise} /> · {T("core.inv.due_on", { date: T.date(dueDate), rel: T.rel(dueDate, asOf) })}
          </p>
        )}
      </Sheet>
    </form>
  );
}

function TotalRow({ label, paise, strong }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "border-t border-line pt-2 text-xl font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd>
        <Money paise={paise} showPaise />
      </dd>
    </div>
  );
}
