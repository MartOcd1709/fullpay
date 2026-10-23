"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { addDays, daysBetween, formatDate } from "@/lib/time";
import { fmtINR } from "@/lib/money";

const BTN = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold no-underline disabled:cursor-not-allowed disabled:opacity-60";
const PRIMARY = `${BTN} bg-accent text-on-accent hover:bg-accent-strong`;
const SECONDARY = `${BTN} border border-line bg-surface text-ink hover:bg-surface-2`;

// Owner actions on one bill: send a draft, record a promise to pay (with its forecast effect, K16), snooze, copy the pay link.
export default function InvoiceActions({ inv, asOf, expected, payUrl, L }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(addDays(asOf, 7));
  const [amount, setAmount] = useState("");
  const [snooze, setSnooze] = useState(addDays(asOf, 2));
  const [copied, setCopied] = useState(false);

  const open = inv.status === "sent" || inv.status === "part_paid";
  const close = () => {
    setSheet(null);
    setError("");
  };
  async function call(path, body, done) {
    setBusy(true);
    setError("");
    try {
      const out = await api(path, { body });
      close();
      toast(done(out));
      router.refresh();
    } catch (e) {
      setError(e.code === "network" ? L.network : e.message);
    }
    setBusy(false);
  }

  const weekOf = (d) => Math.floor(daysBetween(asOf, d) / 7) + 1;
  const weekText = (w) => (w > 13 ? L.after_window : L.week_n.replace("{n}", w));
  const effect = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
    const from = weekOf(expected);
    const to = weekOf(date);
    const vars = { amount: fmtINR(inv.outstanding_paise, { paise: inv.outstanding_paise % 100 !== 0 }), from: weekText(from), to: weekText(to) };
    return (from === to ? L.effect_same : L.effect_move).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  };

  const promiseOpen = (inv.promises ?? []).find((p) => p.status === "open");
  const promiseBroken = (inv.promises ?? []).some((p) => p.status === "broken");
  const snoozed = inv.snoozed_until && inv.snoozed_until >= asOf;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {inv.status === "draft" && (
          <>
            <button type="button" className={PRIMARY} onClick={() => setSheet("send")}>
              <Icon name="send" />
              {L.send}
            </button>
            <Link href={`/invoices/new?draft=${inv.id}`} className={SECONDARY}>
              <Icon name="draft" />
              {L.edit}
            </Link>
          </>
        )}
        {open && !promiseOpen && (
          <button type="button" className={PRIMARY} onClick={() => setSheet("promise")} disabled={promiseBroken}>
            <Icon name="handshake" />
            {L.promise}
          </button>
        )}
        {open && (
          <button type="button" className={SECONDARY} onClick={() => setSheet("snooze")}>
            <Icon name="snooze" />
            {snoozed ? L.change_snooze : L.snooze}
          </button>
        )}
        {inv.status === "disputed" && (
          <Link href="/inbox" className={PRIMARY}>
            <Icon name="dispute" />
            {L.answer_dispute}
          </Link>
        )}
      </div>
      {promiseBroken && open && !promiseOpen && <p className="text-ink-muted">{L.promise_broken_before}</p>}
      {promiseOpen && <p className="font-medium text-info">{L.promise_open.replace("{date}", formatDate(promiseOpen.promised_date, L.lang))}</p>}

      {payUrl && (
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="font-semibold">{L.pay_link}</p>
          <p className="mono mt-1 text-sm">{payUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={SECONDARY} onClick={() => navigator.clipboard?.writeText(payUrl).then(() => setCopied(true), () => {})}>
              <Icon name="copy" />
              {copied ? L.copied : L.copy}
            </button>
            <a href={payUrl} target="_blank" rel="noreferrer" className={SECONDARY}>
              <Icon name="external" />
              {L.open_pay}
            </a>
          </div>
        </div>
      )}

      <Sheet
        open={sheet === "send"}
        onClose={close}
        title={L.send_title}
        closeLabel={L.close}
        footer={
          <>
            <button type="button" className={`${PRIMARY} flex-1`} disabled={busy} onClick={() => call(`/api/invoices/${inv.id}/send`, {}, (o) => L.sent_as.replace("{number}", o.invoice.number))}>
              {busy ? L.working : L.send_confirm}
            </button>
            <button type="button" className={`${SECONDARY} flex-1`} onClick={close}>{L.cancel}</button>
          </>
        }
      >
        <p>{L.send_body}</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{error}</p>}
      </Sheet>

      <Sheet
        open={sheet === "promise"}
        onClose={close}
        title={L.promise_title}
        closeLabel={L.close}
        footer={
          <>
            <button
              type="button"
              className={`${PRIMARY} flex-1`}
              disabled={busy}
              onClick={() => {
                const rupees = amount.trim();
                const paise = rupees ? Math.round(Number(rupees.replace(/,/g, "")) * 100) : null;
                if (rupees && !(paise > 0)) return setError(L.amount_invalid);
                call(`/api/invoices/${inv.id}/promise`, { date, ...(paise ? { amount_paise: paise } : {}) }, () => L.promise_saved);
              }}
            >
              {busy ? L.working : L.promise_confirm}
            </button>
            <button type="button" className={`${SECONDARY} flex-1`} onClick={close}>{L.cancel}</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field id="promise-date" label={L.promise_date} hint={L.promise_limit}>
            <Input id="promise-date" type="date" value={date} min={addDays(asOf, 1)} max={addDays(asOf, 14)} onChange={(e) => setDate(e.target.value)} hint={L.promise_limit} />
          </Field>
          <Field id="promise-amount" label={L.promise_amount} hint={L.promise_amount_hint}>
            <Input id="promise-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹" hint={L.promise_amount_hint} />
          </Field>
          <p className="flex gap-2 rounded-xl border border-info/30 bg-info-soft px-3 py-3 font-medium text-info" aria-live="polite">
            <Icon name="trend" className="mt-0.5 h-5 w-5" />
            <span>{effect()}</span>
          </p>
          {error && <p role="alert" className="rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{error}</p>}
        </div>
      </Sheet>

      <Sheet
        open={sheet === "snooze"}
        onClose={close}
        title={L.snooze_title}
        closeLabel={L.close}
        footer={
          <>
            <button type="button" className={`${PRIMARY} flex-1`} disabled={busy} onClick={() => call(`/api/invoices/${inv.id}/snooze`, { until: snooze }, () => L.snoozed_toast.replace("{date}", formatDate(snooze, L.lang)))}>
              {busy ? L.working : L.snooze_confirm}
            </button>
            {snoozed && (
              <button type="button" className={`${SECONDARY} flex-1`} disabled={busy} onClick={() => call(`/api/invoices/${inv.id}/snooze`, { until: null }, () => L.unsnoozed)}>
                {L.unsnooze}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <p>{L.snooze_body}</p>
          <div className="flex flex-wrap gap-2">
            {[2, 7, 14].map((n) => (
              <button key={n} type="button" aria-pressed={snooze === addDays(asOf, n)} className={`${SECONDARY} ${snooze === addDays(asOf, n) ? "border-accent ring-2 ring-accent" : ""}`} onClick={() => setSnooze(addDays(asOf, n))}>
                {L.plus_days.replace("{n}", n)}
              </button>
            ))}
          </div>
          <Field id="snooze-date" label={L.snooze_until}>
            <Input id="snooze-date" type="date" value={snooze} min={addDays(asOf, 1)} max={addDays(asOf, 30)} onChange={(e) => setSnooze(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{error}</p>}
        </div>
      </Sheet>
    </div>
  );
}
