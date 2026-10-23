"use client";
import { useState } from "react";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import { StatusLine, btn, tr, useAction } from "./client";
import PromiseSheet from "./PromiseSheet";

const waDigits = (phone) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d.length >= 11 ? d : null;
};

const late = (T, days) => (days > 0 ? T("collect.days_overdue", { n: days }) : days === 0 ? T("collect.due_today") : T("collect.due_in", { n: -days }));

const ICON = {
  whatsapp: "M3 21l1.65-4.8A8.5 8.5 0 1 1 7.8 19.4L3 21zM9 8.5c0 3.5 3 6.5 6.5 6.5l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 8.5z",
  email: "M3 6h18v12H3zM3 7l9 6 9-6",
  sms: "M4 4h16v12H8l-4 4zM8 9h8M8 12h5",
};
const Icon = ({ d }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={ICON[d]} />
  </svg>
);

// One outbox row: the ready message, one-tap send in the owner's own apps, Mark as sent, Snooze, Promise, Retry.
export default function FollowupCard({ row, lang, asOf, weeksN, expectedWeek, maxDays }) {
  const T = tr(lang);
  const { call, busy, msg, setMsg } = useAction(lang);
  const [channel, setChannel] = useState(row.channel);
  const [opened, setOpened] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const failed = row.status === "failed";
  const queued = row.status === "queued";

  const phone = row.customer_phone;
  const email = row.recipient && row.recipient.includes("@") ? row.recipient : row.customer_email;
  const digits = waDigits(phone);
  const subject = row.subject || T("collect.fu.default_subject", { numbers: row.invoices.map((i) => i.number).join(", ") });
  const links = {
    whatsapp: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(row.body)}` : null,
    email: email ? `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(row.body)}` : null,
    sms: phone ? `sms:${String(phone).replace(/[^\d+]/g, "")}?body=${encodeURIComponent(row.sms || row.body)}` : null,
  };
  const tap = (ch) => {
    setChannel(ch);
    setOpened(true);
    setMsg(null);
  };
  const lines = row.body.split("\n");
  const long = lines.length > 6;

  return (
    <article className={`rounded-xl border bg-surface p-4 sm:p-5 ${failed ? "border-error" : "border-line"}`} aria-labelledby={`fu-${row.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`fu-${row.id}`} className="text-lg font-semibold leading-snug">
            {row.customer_name}
          </h3>
          <p className="text-ink-muted">{T(row.rung === "invoice_sent" ? "collect.rung_invoice" : `rung.${row.rung}`)}</p>
        </div>
        <StatusPill status={failed ? "failed" : row.status} label={T(`collect.ob.${row.status}`)} />
      </header>

      <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
        {row.invoices.map((i) => (
          <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
            <span className="font-semibold">{i.number}</span>
            <span className="tnum font-semibold">{fmtINR(i.outstanding_paise, { paise: i.outstanding_paise % 100 !== 0 })}</span>
            <span className={`w-full text-sm ${i.days_overdue > 0 ? "text-error" : "text-ink-muted"}`}>
              {late(T, i.days_overdue)} · {T("collect.due_on", { date: formatDate(i.due_date, lang) })}
            </span>
          </li>
        ))}
      </ul>
      {row.invoices.length > 1 && (
        <p className="mt-2 text-right font-semibold">
          {T("collect.total")}: <span className="tnum">{fmtINR(row.amount_paise, { paise: false })}</span>
        </p>
      )}

      {failed && (
        <div role="alert" className="mt-3 rounded-lg bg-error-soft px-3 py-2 text-error">
          <p className="font-semibold">{T("collect.fu.failed_why", { n: row.attempts })}</p>
          {row.error && <p className="mt-1 break-words font-mono text-sm">{row.error}</p>}
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1 text-sm font-semibold text-ink-muted">{T("collect.fu.message")}</p>
        <div lang={row.lang} className={`whitespace-pre-wrap rounded-lg bg-surface-2 p-3 ${long && !showAll ? "line-clamp-6" : ""}`}>
          {row.body}
        </div>
        {long && (
          <button type="button" className={btn("ghost", "mt-1 px-2")} aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
            {showAll ? T("collect.show_less") : T("collect.show_all")}
          </button>
        )}
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-base sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-sm text-ink-muted">{T("field.phone")}</dt>
          <dd className="select-all break-all font-mono">{phone || T("collect.fu.no_phone")}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-ink-muted">{T("field.email")}</dt>
          <dd className="select-all break-all font-mono">{email || T("collect.fu.no_email")}</dd>
        </div>
      </dl>

      {queued ? (
        <p className="mt-4 rounded-lg bg-info-soft p-3">{T("collect.fu.auto_note")}</p>
      ) : (
        <>
      <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 lg:grid-cols-4">
        {["whatsapp", "email", "sms"].map((ch) =>
          links[ch] ? (
            <a
              key={ch}
              href={links[ch]}
              target={ch === "whatsapp" ? "_blank" : undefined}
              rel={ch === "whatsapp" ? "noopener noreferrer" : undefined}
              onClick={() => tap(ch)}
              className={btn(channel === ch && opened ? "primary" : "secondary")}
            >
              <Icon d={ch} />
              {T(`collect.fu.via_${ch}`)}
              {ch === "whatsapp" && <span className="sr-only"> {T("collect.new_tab")}</span>}
            </a>
          ) : (
            <span key={ch} className={btn("secondary", "cursor-not-allowed opacity-60")} aria-disabled="true">
              <Icon d={ch} />
              {T(`collect.fu.via_${ch}`)}
            </span>
          ),
        )}
        <button
          type="button"
          className={btn(opened ? "primary" : "secondary", opened ? "" : "border-accent text-accent")}
          disabled={busy}
          onClick={() => call(`/api/outbox/${row.id}/mark-sent`, { channel }, { success: T("collect.fu.logged", { channel: T(`collect.chan.${channel}`) }) })}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 9.5 17 19 7" />
          </svg>
          {busy ? T("collect.saving") : T("btn.mark_sent")}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{opened ? T("collect.fu.after_tap", { channel: T(`collect.chan.${channel}`) }) : T("collect.fu.tap_hint")}</p>

        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        {failed && (
          <button type="button" className={btn("primary")} disabled={busy} onClick={() => call(`/api/outbox/${row.id}/retry`, {}, { success: (r) => T(r.status === "sent" ? "collect.fu.resent" : "collect.fu.retry_failed") })}>
            {T("btn.retry")}
          </button>
        )}
        <button type="button" className={btn("secondary")} aria-expanded={snoozeOpen} onClick={() => setSnoozeOpen((s) => !s)}>
          {T("btn.snooze")}
        </button>
        <button type="button" className={btn("secondary")} onClick={() => setPromiseOpen(true)}>
          {T("btn.promise")}
        </button>
      </div>
      {snoozeOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={T("btn.snooze")}>
          <span className="text-ink-muted">{T("collect.fu.snooze_for")}</span>
          {[1, 3, 7].map((d) => (
            <button
              key={d}
              type="button"
              className={btn("secondary")}
              disabled={busy}
              onClick={() => call(`/api/followups/${row.id}/snooze`, { days: d }, { success: (r) => T("collect.fu.snoozed", { date: formatDate(r.snoozed_until, lang) }) })}
            >
              {T("common.days", { n: d })}
            </button>
          ))}
        </div>
      )}
      <StatusLine msg={msg} />

      <PromiseSheet
        open={promiseOpen}
        onClose={() => setPromiseOpen(false)}
        lang={lang}
        asOf={asOf}
        maxDays={maxDays}
        weeksN={weeksN}
        invoices={row.invoices}
        expectedWeek={expectedWeek}
        onSubmit={async (date) => {
          return call("/api/promises", { invoice_ids: row.invoices.map((i) => i.id), promised_date: date }, { success: T("collect.promise.saved", { date: formatDate(date, lang) }) });
        }}
      />
    </article>
  );
}
