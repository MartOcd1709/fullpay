"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BTN = "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-60";
const REASONS = ["wrong_amount", "wrong_quantity", "returned", "already_paid", "other"];

// The customer's three answers (already paid / something's wrong / pay on a date) and, in the demo, a simulated UPI payment.
export default function PayActions({ token, s, defaults, can }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});
  const [errors, setErrors] = useState({});
  const [reason, setReason] = useState("wrong_amount");

  async function send(kind, body) {
    setBusy(kind);
    setErrors((e) => ({ ...e, [kind]: "" }));
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrors((e) => ({ ...e, [kind]: s[`public.pay.err_${data?.error?.code}`] ?? data?.error?.message ?? s["error.generic"] }));
      } else {
        setDone((d) => ({ ...d, [kind]: true }));
        router.refresh();
      }
    } catch {
      setErrors((e) => ({ ...e, [kind]: s["error.network"] }));
    }
    setBusy(null);
  }

  const submit = (kind, build) => (event) => {
    event.preventDefault();
    send(kind, build(new FormData(event.currentTarget)));
  };

  const Err = ({ kind }) => (errors[kind] ? <p role="alert" className="mt-3 rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{errors[kind]}</p> : null);
  const Done = ({ text }) => <p role="status" className="rounded-xl bg-success-soft px-3 py-2 font-medium text-success">{text}</p>;
  const Submit = ({ kind }) => (
    <button type="submit" disabled={busy !== null} className={`${BTN} mt-4 w-full bg-accent text-on-accent hover:bg-accent-strong sm:w-auto`}>
      {busy === kind ? s["public.pay.sending"] : s["pay.submit"]}
    </button>
  );

  return (
    <div className="mt-4 space-y-3">
      {can.simulate && (
        <section aria-labelledby="sim" className="rounded-xl border border-dashed border-accent bg-accent-soft p-5">
          <h2 id="sim" className="text-lg font-semibold text-accent">{s["public.pay.sim_title"]}</h2>
          <p className="mt-1">{s["public.pay.sim_body"]}</p>
          {done.simulate ? (
            <div className="mt-3"><Done text={s["public.pay.sim_done"]} /></div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" disabled={busy !== null} onClick={() => send("simulate", { action: "simulate" })} className={`${BTN} bg-accent text-on-accent hover:bg-accent-strong`}>
                {busy === "simulate" ? s["public.pay.sending"] : s["public.pay.sim_full"]}
              </button>
              {can.tds && (
                <button type="button" disabled={busy !== null} onClick={() => send("simulate", { action: "simulate", tds: true })} className={`${BTN} border border-line bg-surface text-ink hover:bg-surface-2`}>
                  {s["public.pay.sim_tds"]}
                </button>
              )}
            </div>
          )}
          <Err kind="simulate" />
        </section>
      )}

      {can.claim && (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 py-3 text-lg font-semibold">{s["pay.already_paid"]}</summary>
          <div className="border-t border-line px-5 py-4">
            {done.claim ? (
              <Done text={s["public.pay.claim_done"]} />
            ) : (
              <form onSubmit={submit("claim", (f) => ({ action: "claim", reference: f.get("reference"), date: f.get("date"), amount: f.get("amount") }))}>
                <p className="text-ink-muted">{s["public.pay.pauses"]}</p>
                <label htmlFor="ref" className="label mt-3">{s["public.pay.ref"]}</label>
                <input id="ref" name="reference" required maxLength={100} className="field" aria-describedby="ref-hint" autoComplete="off" />
                <p id="ref-hint" className="mt-1 text-ink-muted">{s["public.pay.ref_hint"]}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="paid-on" className="label">{s["public.pay.paid_on"]}</label>
                    <input id="paid-on" name="date" type="date" required max={defaults.asOf} defaultValue={defaults.asOf} className="field" />
                  </div>
                  <div>
                    <label htmlFor="amount" className="label">{s["public.pay.amount_paid"]}</label>
                    <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-accent">
                      <span aria-hidden="true" className="pl-3 font-semibold text-ink-muted">₹</span>
                      <input id="amount" name="amount" required inputMode="decimal" pattern="[0-9,]*(\.[0-9]{0,2})?" defaultValue={defaults.amount} className="w-full rounded-xl bg-transparent px-2 py-2.5 text-ink outline-none" />
                    </div>
                  </div>
                </div>
                <Submit kind="claim" />
                <Err kind="claim" />
              </form>
            )}
          </div>
        </details>
      )}

      {can.dispute && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 py-3 text-lg font-semibold">{s["pay.something_wrong"]}</summary>
          <div className="border-t border-line px-5 py-4">
            {done.dispute ? (
              <Done text={s["public.pay.dispute_done"]} />
            ) : (
              <form onSubmit={submit("dispute", (f) => ({ action: "dispute", reason_code: f.get("reason_code"), details: f.get("details") || undefined }))}>
                <p className="text-ink-muted">{s["public.pay.pauses"]}</p>
                <fieldset className="mt-3">
                  <legend className="label">{s["public.pay.reason_legend"]}</legend>
                  <div className="space-y-1">
                    {REASONS.map((r) => (
                      <label key={r} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                        <input type="radio" name="reason_code" value={r} checked={reason === r} onChange={() => setReason(r)} />
                        <span>{s[`public.pay.r_${r}`]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor="details" className="label mt-3">
                  {s["public.pay.details"]} {reason !== "other" && <span className="font-normal text-ink-muted">({s["common.optional"]})</span>}
                </label>
                <textarea id="details" name="details" maxLength={900} required={reason === "other"} className="field" aria-describedby="details-hint" />
                <p id="details-hint" className="mt-1 text-ink-muted">{s["public.pay.details_hint"]}</p>
                <Submit kind="dispute" />
                <Err kind="dispute" />
              </form>
            )}
          </div>
        </details>
      )}

      {can.promise && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 py-3 text-lg font-semibold">{s["public.pay.promise_title"]}</summary>
          <div className="border-t border-line px-5 py-4">
            {done.promise ? (
              <Done text={s["public.pay.promise_done"]} />
            ) : (
              <form onSubmit={submit("promise", (f) => ({ action: "promise", date: f.get("date") }))}>
                <label htmlFor="promise" className="label">{s["pay.promise"]}</label>
                <input id="promise" name="date" type="date" required min={defaults.asOf} max={defaults.promiseMax} className="field" aria-describedby="promise-hint" />
                <p id="promise-hint" className="mt-1 text-ink-muted">{s["public.pay.promise_hint"]}</p>
                <Submit kind="promise" />
                <Err kind="promise" />
              </form>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
