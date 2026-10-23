"use client";
import { useState } from "react";
import { fmtINR } from "@/lib/money";
import { addDays, daysBetween, formatDate } from "@/lib/time";
import { Sheet, StatusLine, btn, errorText, tr } from "./client";

// "Customer promised to pay on [date]". States its forecast effect before confirming (K16).
// onSubmit(date) -> { ok, error } ; invoices: [{ id, number, outstanding_paise }]
export default function PromiseSheet({ open, onClose, lang, asOf, maxDays = 14, weeksN = 13, invoices, expectedWeek = {}, onSubmit, title }) {
  const T = tr(lang);
  const [date, setDate] = useState(addDays(asOf, 7));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const min = addDays(asOf, 1);
  const max = addDays(asOf, maxDays);
  const valid = date >= min && date <= max;
  const amount = invoices.reduce((a, i) => a + Math.max(0, i.outstanding_paise), 0);
  const toWeek = valid ? Math.floor(daysBetween(asOf, date) / 7) : null;
  const fromWeeks = [...new Set(invoices.map((i) => expectedWeek[i.id]).filter((w) => w != null))];
  const fromLabel = (w) => (w >= weeksN ? T("collect.promise.after_window", { n: weeksN }) : T("collect.promise.week_n", { n: w + 1 }));

  let effect = null;
  if (valid) {
    const vars = { amount: fmtINR(amount, { paise: false }), to: toWeek + 1 };
    if (fromWeeks.length === 1 && fromWeeks[0] === toWeek) effect = T("collect.promise.effect_same", vars);
    else if (fromWeeks.length === 1) effect = T("collect.promise.effect_move", { ...vars, from: fromLabel(fromWeeks[0]) });
    else effect = T("collect.promise.effect_into", vars);
  }

  async function submit(e) {
    e.preventDefault();
    if (!valid) return setMsg({ tone: "error", text: T("collect.promise.range", { min: formatDate(min, lang), max: formatDate(max, lang) }) });
    setBusy(true);
    const r = await onSubmit(date);
    setBusy(false);
    if (r.ok) onClose();
    else setMsg({ tone: "error", text: errorText(lang, r.error) });
  }

  return (
    <Sheet open={open} onClose={onClose} lang={lang} title={title ?? T("collect.promise.title")}>
      <form onSubmit={submit} noValidate>
        <p className="mb-3 text-ink-muted">{invoices.map((i) => i.number).join(", ")}</p>
        <label className="label" htmlFor="promise-date">
          {T("collect.promise.date")}
        </label>
        <input id="promise-date" type="date" className="field" value={date} min={min} max={max} onChange={(e) => setDate(e.target.value)} aria-invalid={!valid} aria-describedby="promise-help" required />
        <p id="promise-help" className="mt-1 text-sm text-ink-muted">
          {T("collect.promise.range", { min: formatDate(min, lang), max: formatDate(max, lang) })}
        </p>
        {effect && (
          <div className="mt-4 rounded-xl bg-info-soft p-4 text-ink">
            <p className="font-semibold">{effect}</p>
            <p className="mt-1">{T("collect.promise.resume")}</p>
          </div>
        )}
        <StatusLine msg={msg} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" className={btn("secondary")} onClick={onClose}>
            {T("btn.cancel")}
          </button>
          <button type="submit" className={btn("primary")} disabled={busy || !valid}>
            {busy ? T("collect.saving") : T("collect.promise.save")}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
