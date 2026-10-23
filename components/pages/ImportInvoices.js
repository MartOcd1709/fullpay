"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import Money from "@/components/ui/Money";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

// Bring existing unpaid invoices in from Tally / Vyapar / Excel: choose a file, check it, then import.
export function ImportInvoices({ lang }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const reset = () => { setCsv(""); setName(""); setPreview(null); setErr(null); };
  async function check(text) {
    setBusy(true); setErr(null); setPreview(null);
    try { setPreview(await api("/api/invoices/import/preview", { body: { csv: text } })); }
    catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }
  async function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setName(f.name); setCsv(text); check(text);
  }
  async function sample() {
    const res = await fetch("/api/invoices/import/sample");
    const text = await res.text();
    setName("tally-bills-receivable-sample.csv"); setCsv(text); check(text);
  }
  async function commit() {
    setBusy(true);
    try {
      const r = await api("/api/invoices/import", { body: { csv } });
      toast(T("pages.imp.done", { n: r.imported, c: r.new_customers }));
      setOpen(false); reset(); router.refresh();
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }
  const s = preview?.summary;
  const shown = preview ? [...preview.rows].sort((a, b) => b.errors.length - a.errors.length).slice(0, 60) : [];
  return (
    <>
      <Button variant="secondary" onClick={() => { reset(); setOpen(true); }}>{T("pages.imp.open")}</Button>
      <Sheet wide open={open} onClose={() => setOpen(false)} title={T("pages.imp.title")} closeLabel={T("pages.cust.cancel")}>
        <div className="grid gap-4">
          <p className="text-ink-muted">{T("pages.imp.intro")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
              {T("pages.imp.choose")}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={pick} />
            </label>
            <Button variant="ghost" onClick={sample} disabled={busy}>{T("pages.imp.sample")}</Button>
            {name && <span className="break-all text-ink-muted">{name}</span>}
          </div>
          {busy && <p role="status">{T("pages.imp.checking")}</p>}
          {err && <p role="alert" className="rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{err}</p>}
          {s && (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["importable", s.importable], ["new_customers", s.new_customers], ["with_problems", s.with_problems], ["already_paid", s.already_paid]].map(([k, n]) => (
                  <div key={k} className="rounded-xl border border-line bg-surface-2 p-3">
                    <dt className="text-sm text-ink-muted">{T(`pages.imp.s.${k}`)}</dt>
                    <dd className="text-xl font-bold tnum">{n}</dd>
                  </div>
                ))}
              </dl>
              <p>{T("pages.imp.owed", { n: s.overdue })} <Money paise={s.outstanding_paise} className="font-bold" /></p>
              <p className="text-sm text-ink-muted">{T("pages.imp.columns", { cols: Object.entries(preview.mapping).map(([f, h]) => `${h} → ${T(`pages.imp.f.${f}`)}`).join(", ") })}</p>
              <div className="max-h-80 overflow-auto rounded-xl border border-line">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-ink-muted">
                    <tr>{["line", "number", "customer", "due", "owed", "check"].map((k) => <th key={k} scope="col" className="whitespace-nowrap px-2 py-2">{T(`pages.imp.col.${k}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.line} className="border-t border-line align-top">
                        <td className="whitespace-nowrap px-2 py-1 tnum">{r.line}</td>
                        <td className="whitespace-nowrap px-2 py-1 mono">{r.value.number ?? "—"}</td>
                        <td className="px-2 py-1">{r.customer.name}{r.customer.new && !r.errors.length ? <span className="ml-1 rounded bg-accent-soft px-1 text-accent">{T("pages.imp.new")}</span> : null}</td>
                        <td className="whitespace-nowrap px-2 py-1 tnum">{r.value.due_date ? T.date(r.value.due_date) : "—"}</td>
                        <td className="whitespace-nowrap px-2 py-1"><Money paise={r.value.balance_paise} /></td>
                        <td className={`px-2 py-1 ${r.errors.length ? "font-semibold text-error" : r.settled ? "text-ink-muted" : "text-success"}`}>
                          {r.errors.length ? r.errors.map((e) => T(`pages.imp.err.${e}`)).join("; ") : r.settled ? T("pages.imp.settled") : T("pages.imp.ok")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > shown.length && <p className="text-sm text-ink-muted">{T("pages.imp.more", { n: preview.rows.length - shown.length })}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={commit} disabled={busy || !s.importable}>{T("pages.imp.go", { n: s.importable })}</Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>{T("pages.cust.cancel")}</Button>
              </div>
              <p className="text-sm text-ink-muted">{T("pages.imp.after")}</p>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}

export default ImportInvoices;
