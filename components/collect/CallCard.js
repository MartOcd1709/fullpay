"use client";
import { useState } from "react";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import { Sheet, StatusLine, btn, errorText, tr, useAction } from "./client";
import PromiseSheet from "./PromiseSheet";

// The +15 rung: "Call the customer". A six-line script in the customer's language, a tel: link, and three outcomes,
// each logged as a chained call_logged event plus the event of what it changes (K26).
export default function CallCard({ inv, lang, asOf, weeksN, expectedWeek, maxDays, business }) {
  const T = tr(lang);
  const S = tr(inv.preferred_lang === "hi" ? "hi" : "en");
  const { call, busy, msg } = useAction(lang);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(null);
  const tel = String(inv.customer_phone ?? "").replace(/[^\d+]/g, "");
  const vars = {
    customer: inv.customer_name,
    owner: business.owner_name || business.name,
    business: business.name,
    number: inv.number,
    amount: fmtINR(inv.outstanding_paise, { paise: false }),
    due: formatDate(inv.due_date, inv.preferred_lang === "hi" ? "hi" : "en"),
    days: inv.days_overdue,
  };
  const url = `/api/followups/call/${inv.id}`;

  return (
    <article className="rounded-xl border-2 border-warning bg-surface p-4 sm:p-5" aria-labelledby={`call-${inv.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`call-${inv.id}`} className="text-lg font-semibold leading-snug">
            {T("collect.call.title", { customer: inv.customer_name })}
          </h3>
          <p className="text-ink-muted">
            {inv.number} · <span className="tnum font-semibold text-ink">{vars.amount}</span> · <span className="text-error">{T("collect.days_overdue", { n: inv.days_overdue })}</span>
          </p>
        </div>
        <StatusPill status="warning" label={T("collect.call.chip")} />
      </header>
      <p className="mt-2">{T("collect.call.why")}</p>

      <div className="mt-3 rounded-lg bg-surface-2 p-3">
        <p className="mb-1 text-sm font-semibold text-ink-muted">{T("collect.call.script", { lang: T(`app.lang_${inv.preferred_lang === "hi" ? "hi" : "en"}`) })}</p>
        <ol lang={inv.preferred_lang === "hi" ? "hi" : "en"} className="list-decimal space-y-1 pl-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <li key={n}>{S(`collect.call.line${n}`, vars)}</li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tel ? (
          <a href={`tel:${tel}`} className={btn("primary")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
            {T("collect.call.call_btn")}
          </a>
        ) : (
          <span className="text-ink-muted">{T("collect.fu.no_phone")}</span>
        )}
        {tel && <span className="select-all font-mono text-lg">{inv.customer_phone}</span>}
      </div>

      <fieldset className="mt-4 border-t border-line pt-3">
        <legend className="pt-3 font-semibold">{T("collect.call.outcome")}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <button type="button" className={btn("secondary")} disabled={busy} onClick={() => setPromiseOpen(true)}>
            {T("collect.call.o_promise")}
          </button>
          <button type="button" className={btn("secondary")} disabled={busy} onClick={() => setDisputeOpen(true)}>
            {T("collect.call.o_dispute")}
          </button>
          <button type="button" className={btn("secondary")} disabled={busy} onClick={() => call(url, { outcome: "snooze" }, { success: T("collect.call.snoozed") })}>
            {T("collect.call.o_snooze")}
          </button>
        </div>
      </fieldset>
      <StatusLine msg={msg} />

      <PromiseSheet
        open={promiseOpen}
        onClose={() => setPromiseOpen(false)}
        lang={lang}
        asOf={asOf}
        maxDays={maxDays}
        weeksN={weeksN}
        invoices={[inv]}
        expectedWeek={expectedWeek}
        title={T("collect.call.o_promise")}
        onSubmit={(date) => call(url, { outcome: "promise", promised_date: date }, { success: T("collect.promise.saved", { date: formatDate(date, lang) }) })}
      />
      <Sheet open={disputeOpen} onClose={() => setDisputeOpen(false)} lang={lang} title={T("collect.call.o_dispute")}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reason.trim()) return setErr({ tone: "error", text: T("collect.err.reason_required") });
            const r = await call(url, { outcome: "dispute", reason: reason.trim() }, { success: T("collect.call.disputed") });
            if (r.ok) setDisputeOpen(false);
            else setErr({ tone: "error", text: errorText(lang, r.error) });
          }}
        >
          <label className="label" htmlFor={`why-${inv.id}`}>
            {T("collect.call.dispute_label")}
          </label>
          <textarea id={`why-${inv.id}`} className="field" rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} required />
          <p className="mt-2 text-ink-muted">{T("collect.call.dispute_effect")}</p>
          <StatusLine msg={err} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" className={btn("secondary")} onClick={() => setDisputeOpen(false)}>
              {T("btn.cancel")}
            </button>
            <button type="submit" className={btn("primary")} disabled={busy}>
              {busy ? T("collect.saving") : T("collect.call.dispute_save")}
            </button>
          </div>
        </form>
      </Sheet>
    </article>
  );
}
