"use client";
import { useState } from "react";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import { Sheet, StatusLine, Term, btn, errorText, toPaise, tr, useAction } from "./client";

const waDigits = (phone) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d.length >= 11 ? d : null;
};

// One dispute or "already paid" claim with its resolve actions (inbox.resolve).
export default function InboxCard({ item, lang, asOf }) {
  const T = tr(lang);
  const { call, busy, msg } = useAction(lang);
  const [sheet, setSheet] = useState(null); // 'credit' | 'reject' | 'edit' | 'paid'
  const [err, setErr] = useState(null);
  const [cnAmount, setCnAmount] = useState("");
  const [cnReason, setCnReason] = useState(item.reason ?? "");
  const [reply, setReply] = useState("");
  const within = item.kind === "dispute" && item.objection_days != null && item.objection_days <= 15;
  const [edit, setEdit] = useState({
    acceptance_date: within ? asOf : item.acceptance_date ?? "",
    credit_days: item.credit_days ?? 15,
    notes: "",
  });
  const [sentReply, setSentReply] = useState(null);
  const isClaim = item.kind === "claim";
  const url = `/api/inbox/${item.id}/resolve`;
  const owed = fmtINR(item.outstanding_paise, { paise: item.outstanding_paise % 100 !== 0 });
  const close = () => {
    setSheet(null);
    setErr(null);
  };

  async function submit(body, success) {
    const r = await call(url, body, { success, refresh: body.action !== "reject" });
    if (r.ok) close();
    else setErr({ tone: "error", text: errorText(lang, r.error) });
    return r;
  }

  const digits = waDigits(item.customer_phone);

  return (
    <article className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`ib-${item.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`ib-${item.id}`} className="text-lg font-semibold leading-snug">
            {T(isClaim ? "collect.ib.says_paid" : "collect.ib.says_wrong", { customer: item.customer_name })}
          </h3>
          <p className="text-ink-muted">
            {item.invoice_number} · {T("collect.ib.still_owed")} <span className="tnum font-semibold text-ink">{owed}</span> · {T("collect.ib.opened", { date: formatDate(item.opened_on, lang) })}
          </p>
        </div>
        <StatusPill status={isClaim ? "pending" : "disputed"} label={T(isClaim ? "collect.ib.claim" : "collect.ib.dispute")} />
      </header>

      <blockquote className="mt-3 border-l-4 border-accent bg-accent-soft px-4 py-3 text-ink">
        <p className="whitespace-pre-wrap">“{item.reason}”</p>
      </blockquote>

      {isClaim && (
        <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">{T("field.amount")}</dt>
            <dd className="tnum font-semibold">{item.claim_amount_paise != null ? fmtINR(item.claim_amount_paise) : "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{T("field.paid_on")}</dt>
            <dd>{item.claim_paid_on ? formatDate(item.claim_paid_on, lang) : "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-ink-muted">
              <Term k="field.reference" lang={lang} />
            </dt>
            <dd className="select-all break-all font-mono">{item.claim_reference ?? "—"}</dd>
          </div>
        </dl>
      )}
      {isClaim && <p className="mt-2 text-ink-muted">{T("collect.ib.claim_check")}</p>}

      {!isClaim && (
        <p className={`mt-3 rounded-lg px-3 py-2 ${within ? "bg-warning-soft text-ink" : "bg-surface-2 text-ink-muted"}`}>
          {within
            ? T("collect.ib.s2b_within")
            : T("collect.ib.s2b_outside", { n: item.objection_days, date: formatDate(item.acceptance_date ?? item.issue_date, lang) })}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-muted">{T("collect.ib.paused")}</p>

      <div className={`mt-4 grid gap-2 min-[400px]:grid-cols-2 lg:grid-cols-4 ${sentReply ? "hidden" : ""}`}>
        {!isClaim && (
          <button type="button" className={btn("primary")} onClick={() => setSheet("credit")} disabled={busy || item.outstanding_paise <= 0}>
            {T("collect.ib.credit")}
          </button>
        )}
        <button type="button" className={btn(isClaim ? "primary" : "secondary")} onClick={() => setSheet("paid")} disabled={busy}>
          {T(isClaim ? "collect.ib.claim_ok" : "collect.ib.mark_paid")}
        </button>
        <button type="button" className={btn("secondary")} onClick={() => setSheet("reject")} disabled={busy}>
          {T("collect.ib.reject")}
        </button>
        {!isClaim && (
          <button type="button" className={btn("secondary")} onClick={() => setSheet("edit")} disabled={busy}>
            {T("collect.ib.edit")}
          </button>
        )}
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
            <a className={btn("ghost")} href="/inbox">
              {T("collect.ib.done")}
            </a>
          </div>
        </div>
      )}

      <Sheet open={sheet === "credit"} onClose={close} lang={lang} title={T("collect.ib.credit")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = toPaise(cnAmount);
            if (!p) return setErr({ tone: "error", text: T("collect.err.invalid_amount") });
            submit({ action: "accept_credit_note", amount_paise: p, reason: cnReason.trim() || undefined }, T("collect.ib.credit_done"));
          }}
        >
          <label className="label" htmlFor={`cn-amt-${item.id}`}>
            {T("collect.ib.credit_amount", { max: owed })}
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-lg font-semibold">₹</span>
            <input id={`cn-amt-${item.id}`} className="field tnum" inputMode="decimal" autoComplete="off" value={cnAmount} onChange={(e) => setCnAmount(e.target.value)} required />
          </div>
          <label className="label mt-4" htmlFor={`cn-why-${item.id}`}>
            {T("collect.ib.credit_reason")}
          </label>
          <input id={`cn-why-${item.id}`} className="field" maxLength={300} value={cnReason} onChange={(e) => setCnReason(e.target.value)} />
          <p className="mt-3 rounded-lg bg-info-soft p-3">{T("collect.ib.credit_effect")}</p>
          <StatusLine msg={err} />
          <Actions T={T} busy={busy} onCancel={close} label={T("collect.ib.credit_save")} />
        </form>
      </Sheet>

      <Sheet open={sheet === "paid"} onClose={close} lang={lang} title={T(isClaim ? "collect.ib.claim_ok_q" : "collect.ib.mark_paid_q", { amount: owed })}>
        <p>{T(isClaim ? "collect.ib.claim_ok_effect" : "collect.ib.mark_paid_effect")}</p>
        <StatusLine msg={err} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" className={btn("secondary")} onClick={close}>
            {T("btn.cancel")}
          </button>
          <button type="button" className={btn("primary")} disabled={busy} onClick={() => submit({ action: "mark_paid" }, T("collect.ib.paid_done"))}>
            {busy ? T("collect.saving") : T("btn.confirm")}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "reject"} onClose={close} lang={lang} title={T("collect.ib.reject")}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reply.trim()) return setErr({ tone: "error", text: T("collect.err.reply_required") });
            const r = await submit({ action: "reject", reply: reply.trim() }, T("collect.ib.rejected"));
            if (r.ok) setSentReply(reply.trim());
          }}
        >
          <label className="label" htmlFor={`rp-${item.id}`}>
            {T("collect.ib.reply_label")}
          </label>
          <textarea id={`rp-${item.id}`} className="field" rows={5} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} required />
          <p className="mt-2 text-ink-muted">{T("collect.ib.reject_effect")}</p>
          <StatusLine msg={err} />
          <Actions T={T} busy={busy} onCancel={close} label={T("collect.ib.reject_save")} />
        </form>
      </Sheet>

      <Sheet open={sheet === "edit"} onClose={close} lang={lang} title={T("collect.ib.edit")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const changes = { acceptance_date: edit.acceptance_date, credit_days: Number(edit.credit_days) };
            if (edit.notes.trim()) changes.notes = edit.notes.trim();
            submit({ action: "edit", changes }, T("collect.ib.edited"));
          }}
        >
          {within && <p className="mb-3 rounded-lg bg-warning-soft p-3">{T("collect.ib.s2b_prefill")}</p>}
          <label className="label" htmlFor={`ad-${item.id}`}>
            <Term k="collect.ib.acceptance" lang={lang} />
          </label>
          <input id={`ad-${item.id}`} type="date" className="field" value={edit.acceptance_date} max={asOf} onChange={(e) => setEdit({ ...edit, acceptance_date: e.target.value })} required />
          <label className="label mt-4" htmlFor={`cd-${item.id}`}>
            <Term k="field.credit_days" lang={lang} />
          </label>
          <input id={`cd-${item.id}`} type="number" min={0} max={45} inputMode="numeric" className="field" value={edit.credit_days} onChange={(e) => setEdit({ ...edit, credit_days: e.target.value })} required />
          <p className="mt-1 text-sm text-ink-muted">{T("collect.ib.credit_cap")}</p>
          <label className="label mt-4" htmlFor={`nt-${item.id}`}>
            {T("collect.ib.edit_note")}
          </label>
          <input id={`nt-${item.id}`} className="field" maxLength={300} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
          <p className="mt-3 rounded-lg bg-info-soft p-3">{T("collect.ib.edit_effect")}</p>
          <StatusLine msg={err} />
          <Actions T={T} busy={busy} onCancel={close} label={T("btn.save")} />
        </form>
      </Sheet>
    </article>
  );
}

function Actions({ T, busy, onCancel, label }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button type="button" className={btn("secondary")} onClick={onCancel}>
        {T("btn.cancel")}
      </button>
      <button type="submit" className={btn("primary")} disabled={busy}>
        {busy ? T("collect.saving") : label}
      </button>
    </div>
  );
}
