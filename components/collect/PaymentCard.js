"use client";
import { useState } from "react";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import { Sheet, StatusLine, Term, btn, errorText, toPaise, tr, useAction } from "./client";

const money = (p) => fmtINR(p, { paise: p % 100 !== 0 });
const rupees = (p) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

const FLAG_TONE = { early_discount: "success", part: "warning", multi: "info", overpaid: "warning", unmatched: "error" };
export const confidenceWord = (c) => (c >= 90 ? "sure" : c >= 60 ? "likely" : "check");
const CONF_TONE = { sure: "success", likely: "info", check: "warning" };

export function FlagChips({ p, lang }) {
  const T = tr(lang);
  if (p.is_tds_entry) return <StatusPill status="info" label={T("collect.pay.flag.tds_entry")} />;
  const flags = p.flags ?? [];
  const chips = flags.length ? flags : ["exact"];
  return (
    <span className="flex flex-wrap gap-2">
      {chips.map((f) => (
        <StatusPill key={f} status={f === "exact" ? "success" : /^tds_/.test(f) ? "warning" : FLAG_TONE[f] ?? "neutral"} label={T(/^tds_/.test(f) ? "collect.pay.flag.tds" : `collect.pay.flag.${f}`)} />
      ))}
      {p.source === "claim" && <StatusPill status="info" label={T("collect.pay.flag.claim")} />}
    </span>
  );
}

// A pending credit: its match, confidence and reason, an editable allocation, and the owner's Confirm (nothing is paid without it).
export function PendingPayment({ p, lang, invoices }) {
  const T = tr(lang);
  const { call, busy, msg, setMsg } = useAction(lang);
  const [alloc, setAlloc] = useState(() => p.proposals.map((x) => ({ invoice_id: x.invoice_id, number: x.number, amount: rupees(x.amount_paise) })));
  const [addId, setAddId] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reply, setReply] = useState("");
  const word = confidenceWord(p.match_confidence ?? 0);
  const tds = p.tds;
  const parsed = alloc.map((a) => ({ invoice_id: a.invoice_id, amount_paise: toPaise(a.amount) }));
  const allocTotal = parsed.reduce((s, a) => s + (a.amount_paise ?? 0), 0);
  const invalid = parsed.some((a) => !a.amount_paise) || allocTotal > p.amount_paise || !parsed.length;
  const leftover = p.amount_paise - allocTotal;
  const changed = parsed.length !== p.proposals.length || parsed.some((a, i) => a.invoice_id !== p.proposals[i]?.invoice_id || a.amount_paise !== p.proposals[i]?.amount_paise);

  async function confirm(withTds) {
    const r = await call(`/api/payments/${p.id}/confirm`, changed ? { allocations: parsed } : {}, { refresh: !withTds, success: T("collect.pay.confirmed") });
    if (r.ok && withTds) await call(`/api/payments/${p.id}/tds`, {}, { success: T("collect.pay.tds_done", { amount: money(tds.amount_paise) }) });
  }

  const candidates = invoices.filter((i) => !alloc.some((a) => a.invoice_id === i.id) && (p.customer_id == null || i.customer_id === p.customer_id || p.flags?.includes("unmatched")));

  return (
    <article className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`pay-${p.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`pay-${p.id}`} className="text-lg font-semibold">
            <span className="tnum text-2xl">{money(p.amount_paise)}</span>
            <span className="ml-2 font-normal text-ink-muted">{formatDate(p.paid_on, lang)}</span>
          </h3>
          <p className="font-semibold">{p.customer_name ?? T("collect.pay.unknown_payer")}</p>
        </div>
        <FlagChips p={p} lang={lang} />
      </header>
      {p.narration && <p translate="no" className="mt-2 break-words font-mono text-sm text-ink-muted">{p.narration}</p>}
      {p.reference && (
        <p className="mt-1 text-sm text-ink-muted">
          {T("field.reference")}: <span className="select-all break-all font-mono">{p.reference}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-ink-muted">
          <Term k="collect.pay.how_sure" lang={lang} />
        </span>
        <StatusPill status={CONF_TONE[word]} label={`${T(`collect.pay.conf_${word}`)} · ${p.match_confidence ?? 0}%`} />
      </div>
      <p className="mt-2">
        <span className="font-semibold">{T("payments.reason")}: </span>
        {Array.isArray(p.match_reason_parts) ? p.match_reason_parts.map((x) => T(`match.${x.k}`, x.v)).join("") : p.match_reason}
      </p>

      {tds && (
        <div className="mt-3 rounded-lg bg-warning-soft p-3 text-ink" role="note">
          <p className="font-semibold">{T("collect.pay.tds_line", { pct: tds.pct, amount: money(tds.amount_paise) })}</p>
          <p className="mt-1">{T("collect.pay.tds_ask")}</p>
          {tds.label && <p lang="en" translate="no" className="mt-1 text-sm text-ink-muted">{tds.label}</p>}
        </div>
      )}
      {p.flags?.includes("overpaid") && <p className="mt-3 rounded-lg bg-warning-soft p-3">{T("collect.pay.over_note")}</p>}
      {p.flags?.includes("unmatched") && <p className="mt-3 rounded-lg bg-error-soft p-3 text-ink">{T("collect.pay.unmatched_note")}</p>}

      <fieldset className="mt-4">
        <legend className="font-semibold">{T("payments.allocate")}</legend>
        {alloc.length === 0 && <p className="text-ink-muted">{T("collect.pay.no_alloc")}</p>}
        <ul className="mt-2 space-y-2">
          {alloc.map((a, i) => (
            <li key={a.invoice_id} className="flex flex-wrap items-center gap-2">
              <label className="min-w-0 flex-1 basis-40 font-semibold" htmlFor={`al-${p.id}-${a.invoice_id}`}>
                {a.number}
              </label>
              <span aria-hidden="true">₹</span>
              <input
                id={`al-${p.id}-${a.invoice_id}`}
                className="field tnum w-36 flex-none"
                inputMode="decimal"
                value={a.amount}
                onChange={(e) => setAlloc(alloc.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
              />
              <button type="button" className={btn("ghost", "px-3")} onClick={() => setAlloc(alloc.filter((_, j) => j !== i))} aria-label={T("collect.pay.remove", { number: a.number })}>
                {T("collect.pay.remove_short")}
              </button>
            </li>
          ))}
        </ul>
        {candidates.length > 0 && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <label className="label text-sm" htmlFor={`add-${p.id}`}>
                {T("collect.pay.add_invoice")}
              </label>
              <select id={`add-${p.id}`} className="field" value={addId} onChange={(e) => setAddId(e.target.value)}>
                <option value="">—</option>
                {candidates.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · {i.customer_name} · {money(i.outstanding_paise)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={btn("secondary")}
              disabled={!addId}
              onClick={() => {
                const inv = invoices.find((x) => String(x.id) === addId);
                const room = Math.max(0, p.amount_paise - allocTotal);
                setAlloc([...alloc, { invoice_id: inv.id, number: inv.number, amount: rupees(Math.min(room || inv.outstanding_paise, inv.outstanding_paise)) }]);
                setAddId("");
              }}
            >
              {T("collect.pay.add")}
            </button>
          </div>
        )}
        <p className={`mt-2 ${allocTotal > p.amount_paise ? "font-semibold text-error" : "text-ink-muted"}`}>
          {allocTotal > p.amount_paise ? T("collect.pay.over_alloc") : leftover > 0 && alloc.length ? T("collect.pay.leftover", { amount: money(leftover) }) : null}
        </p>
      </fieldset>

      <p className="mt-3 flex items-center gap-2 font-semibold text-ink">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {T("collect.pay.locked")}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {tds && alloc.length === 1 && !changed ? (
          <>
            <button type="button" className={btn("primary")} disabled={busy || invalid} onClick={() => confirm(true)}>
              {T("collect.pay.confirm_tds", { amount: money(tds.amount_paise) })}
            </button>
            <button type="button" className={btn("secondary")} disabled={busy || invalid} onClick={() => confirm(false)}>
              {T("collect.pay.confirm_cash")}
            </button>
          </>
        ) : (
          <button type="button" className={btn("primary")} disabled={busy || invalid} onClick={() => confirm(false)}>
            {busy ? T("collect.saving") : T("collect.pay.confirm", { amount: money(allocTotal) })}
          </button>
        )}
        <button type="button" className={btn("secondary")} disabled={busy} onClick={() => setRejectOpen(true)}>
          {T("collect.pay.reject")}
        </button>
      </div>
      <StatusLine msg={msg} />

      <Sheet open={rejectOpen} onClose={() => setRejectOpen(false)} lang={lang} title={T("collect.pay.reject_q")}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call(`/api/payments/${p.id}/reject`, reply.trim() ? { reply: reply.trim() } : {}, { success: T("collect.pay.rejected") });
            if (r.ok) setRejectOpen(false);
            else setMsg({ tone: "error", text: errorText(lang, r.error) });
          }}
        >
          <p>{T("collect.pay.reject_effect")}</p>
          <label className="label mt-3" htmlFor={`rj-${p.id}`}>
            {T("collect.pay.reject_note")} <span className="font-normal text-ink-muted">({T("common.optional")})</span>
          </label>
          <textarea id={`rj-${p.id}`} className="field" rows={3} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" className={btn("secondary")} onClick={() => setRejectOpen(false)}>
              {T("btn.cancel")}
            </button>
            <button type="submit" className={btn("danger")} disabled={busy}>
              {T("collect.pay.reject")}
            </button>
          </div>
        </form>
      </Sheet>
    </article>
  );
}

// Confirmed TDS-short payment whose shortfall is not yet recorded: one button records it as TDS (not cash). K7.
export function RecordTds({ p, lang }) {
  const T = tr(lang);
  const { call, busy, msg } = useAction(lang);
  return (
    <div className="mt-2">
      <button type="button" className={btn("primary")} disabled={busy} onClick={() => call(`/api/payments/${p.id}/tds`, {}, { success: T("collect.pay.tds_done", { amount: money(p.tds.amount_paise) }) })}>
        {T("collect.pay.record_tds", { amount: money(p.tds.amount_paise) })}
      </button>
      <StatusLine msg={msg} />
    </div>
  );
}
