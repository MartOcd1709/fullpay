"use client";
import { useState } from "react";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import { Sheet, StatusLine, btn, errorText, tr, useAction } from "./client";

const waDigits = (phone) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d.length >= 11 ? d : null;
};

// A customer's offer to pay one bill in parts (inbox kind 'plan'): approve it, or decline it with an optional reply.
export default function PlanCard({ item, lang }) {
  const T = tr(lang);
  const { call, busy, msg } = useAction(lang);
  const [declining, setDeclining] = useState(false);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState(null);
  const [sentReply, setSentReply] = useState(null);
  const parts = item.plan_parts ?? [];
  const url = `/api/inbox/${item.id}/resolve`;
  const money = (p) => fmtINR(p, { paise: p % 100 !== 0 });
  const digits = waDigits(item.customer_phone);

  async function decline(e) {
    e.preventDefault();
    const r = await call(url, { action: "reject", reply: reply.trim() || undefined }, { success: T("collect.ib.plan_declined"), refresh: !reply.trim() });
    if (r.ok) {
      setDeclining(false);
      if (reply.trim()) setSentReply(reply.trim());
    } else setErr({ tone: "error", text: errorText(lang, r.error) });
  }

  return (
    <article className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`pl-${item.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`pl-${item.id}`} className="text-lg font-semibold leading-snug">{T("collect.ib.plan_title", { customer: item.customer_name, n: parts.length })}</h3>
          <p className="text-ink-muted">
            {item.invoice_number} · {T("collect.ib.still_owed")} <span className="tnum font-semibold text-ink">{money(item.outstanding_paise)}</span> · {T("collect.ib.opened", { date: formatDate(item.opened_on, lang) })}
          </p>
        </div>
        <StatusPill status="pending" label={T("collect.ib.plan")} />
      </header>

      <ol className="mt-3 divide-y divide-line rounded-lg border border-line">
        {parts.map((p, i) => (
          <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
            <span>{T("collect.ib.plan_part", { n: i + 1, date: formatDate(p.date, lang) })}</span>
            <span className="tnum font-semibold">{money(p.amount_paise)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-lg bg-info-soft p-3">{T("collect.ib.plan_effect")}</p>
      <p className="mt-2 text-sm text-ink-muted">{T("collect.ib.plan_paused")}</p>

      <div className={`mt-4 grid gap-2 min-[400px]:grid-cols-2 ${sentReply ? "hidden" : ""}`}>
        <button type="button" className={btn("primary")} disabled={busy} onClick={() => call(url, { action: "approve_plan" }, { success: T("collect.ib.plan_approved") })}>
          {busy ? T("collect.saving") : T("collect.ib.plan_approve")}
        </button>
        <button type="button" className={btn("secondary")} disabled={busy} onClick={() => setDeclining(true)}>
          {T("collect.ib.plan_decline")}
        </button>
      </div>
      <StatusLine msg={msg} />

      {sentReply && (
        <div className="mt-3 rounded-lg border border-line p-3">
          <p className="font-semibold">{T("collect.ib.send_reply")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {digits && (
              <a className={btn("secondary")} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${digits}?text=${encodeURIComponent(sentReply)}`}>
                {T("collect.fu.via_whatsapp")}
                <span className="sr-only"> {T("collect.new_tab")}</span>
              </a>
            )}
            {item.customer_email && (
              <a className={btn("secondary")} href={`mailto:${item.customer_email}?subject=${encodeURIComponent(item.invoice_number)}&body=${encodeURIComponent(sentReply)}`}>
                {T("collect.fu.via_email")}
              </a>
            )}
            <a className={btn("ghost")} href="/inbox">{T("collect.ib.done")}</a>
          </div>
        </div>
      )}

      <Sheet open={declining} onClose={() => { setDeclining(false); setErr(null); }} lang={lang} title={T("collect.ib.plan_decline")}>
        <form onSubmit={decline}>
          <label className="label" htmlFor={`pr-${item.id}`}>{T("collect.ib.plan_reply")}</label>
          <textarea id={`pr-${item.id}`} className="field" rows={4} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
          <p className="mt-2 text-ink-muted">{T("collect.ib.plan_decline_effect")}</p>
          <StatusLine msg={err} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" className={btn("secondary")} onClick={() => setDeclining(false)}>{T("btn.cancel")}</button>
            <button type="submit" className={btn("primary")} disabled={busy}>{busy ? T("collect.saving") : T("collect.ib.plan_decline")}</button>
          </div>
        </form>
      </Sheet>
    </article>
  );
}
