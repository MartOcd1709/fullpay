"use client";
import { useState } from "react";
import { formatDate } from "@/lib/time";
import { StatusLine, Term, btn, toPaise, tr, useAction } from "./client";

// Import a bank CSV (file or paste) or load the sample statement (K6). Nothing is marked paid here.
export function ImportPanel({ lang }) {
  const T = tr(lang);
  const { call, busy, msg, setMsg } = useAction(lang);
  const [result, setResult] = useState(null);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  async function send(url, body) {
    setResult(null);
    const r = await call(url, body);
    if (r.ok) setResult(r.data);
  }
  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 1_000_000) return setMsg({ tone: "error", text: T("collect.err.file_too_large") });
    send("/api/payments/import", { csv: await f.text() });
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="imp-h">
      <h2 id="imp-h" className="text-lg font-semibold">
        <Term k="collect.pay.import" lang={lang} />
      </h2>
      <p className="mt-1 text-ink-muted">{T("payments.import_hint")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className={btn("primary", "cursor-pointer focus-within:outline focus-within:outline-4 focus-within:outline-accent")}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          {busy ? T("collect.pay.reading") : T("collect.pay.choose_file")}
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={onFile} disabled={busy} />
        </label>
        <button type="button" className={btn("secondary")} disabled={busy} onClick={() => send("/api/payments/sample")}>
          {T("collect.pay.sample")}
        </button>
        <button type="button" className={btn("ghost")} aria-expanded={showPaste} onClick={() => setShowPaste((s) => !s)}>
          {T("collect.pay.paste")}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{T("collect.pay.sample_hint")}</p>
      {showPaste && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (paste.trim()) send("/api/payments/import", { csv: paste });
          }}
        >
          <label className="label" htmlFor="csv-paste">
            {T("collect.pay.paste_label")}
          </label>
          <textarea id="csv-paste" className="field font-mono text-sm" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} spellCheck={false} />
          <button type="submit" className={btn("primary", "mt-2")} disabled={busy || !paste.trim()}>
            {T("collect.pay.read_paste")}
          </button>
        </form>
      )}
      <StatusLine msg={msg} />
      {result && <ImportSummary result={result} lang={lang} />}
    </section>
  );
}

function ImportSummary({ result, lang }) {
  const T = tr(lang);
  const n = result.imported.length;
  return (
    <div role="status" className="mt-3 rounded-lg bg-info-soft p-3 text-ink">
      <p className="font-semibold">
        {T("collect.pay.summary", { n, skipped: result.skipped.length, dup: result.duplicates_skipped })}
      </p>
      {result.duplicates_skipped > 0 && n === 0 && <p className="mt-1">{T("collect.pay.all_dupes", { n: result.duplicates_skipped })}</p>}
      {result.skipped.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{T("collect.pay.skipped_lines")}</summary>
          <ul className="list-disc space-y-1 pl-6">
            {result.skipped.map((s, i) => (
              <li key={i}>{T("collect.pay.skip_line", { line: s.line, reason: T(`collect.pay.skip.${s.reason}`) })}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// Add a payment by hand: against one open invoice, or with a narration for the matcher.
export function ManualPayment({ lang, asOf, invoices }) {
  const T = tr(lang);
  const { call, busy, msg, setMsg } = useAction(lang);
  const [f, setF] = useState({ paid_on: asOf, amount: "", invoice_id: "", reference: "", narration: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const amount_paise = toPaise(f.amount);
    if (!amount_paise) return setMsg({ tone: "error", text: T("collect.err.invalid_amount") });
    const body = { paid_on: f.paid_on, amount_paise };
    if (f.invoice_id) body.invoice_id = Number(f.invoice_id);
    if (f.reference.trim()) body.reference = f.reference.trim();
    if (f.narration.trim()) body.narration = f.narration.trim();
    const r = await call("/api/payments", body, { success: T("collect.pay.manual_added") });
    if (r.ok) setF({ ...f, amount: "", reference: "", narration: "" });
  }

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-lg font-semibold sm:px-5">{T("payments.manual")}</summary>
      <form onSubmit={submit} className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <label className="label" htmlFor="mp-date">
            {T("field.paid_on")}
          </label>
          <input id="mp-date" type="date" className="field" max={asOf} value={f.paid_on} onChange={set("paid_on")} required />
          <p className="mt-1 text-sm text-ink-muted">{T("collect.pay.not_after", { date: formatDate(asOf, lang) })}</p>
        </div>
        <div>
          <label className="label" htmlFor="mp-amt">
            {T("field.amount")}
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-lg font-semibold">₹</span>
            <input id="mp-amt" className="field tnum" inputMode="decimal" autoComplete="off" value={f.amount} onChange={set("amount")} required />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="mp-inv">
            {T("collect.pay.for_invoice")}
          </label>
          <select id="mp-inv" className="field" value={f.invoice_id} onChange={set("invoice_id")}>
            <option value="">{T("collect.pay.let_match")}</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {i.customer_name} · {T("collect.pay.owes", { amount: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(i.outstanding_paise / 100) })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mp-ref">
            <Term k="field.reference" lang={lang} /> <span className="font-normal text-ink-muted">({T("common.optional")})</span>
          </label>
          <input id="mp-ref" className="field" maxLength={100} value={f.reference} onChange={set("reference")} />
        </div>
        <div>
          <label className="label" htmlFor="mp-nar">
            {T("collect.pay.narration")} <span className="font-normal text-ink-muted">({T("common.optional")})</span>
          </label>
          <input id="mp-nar" className="field" maxLength={300} value={f.narration} onChange={set("narration")} />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className={btn("primary", "w-full sm:w-auto")} disabled={busy}>
            {busy ? T("collect.saving") : T("btn.add_payment")}
          </button>
          <p className="mt-2 text-sm text-ink-muted">{T("payments.confirm_hint")}</p>
          <StatusLine msg={msg} />
        </div>
      </form>
    </details>
  );
}
