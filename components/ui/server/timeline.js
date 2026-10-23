import { addDays, daysBetween } from "@/lib/time";
import { RUNGS } from "@/lib/ladder";

const MILESTONES = new Set(["invoice_created", "rung_advanced", "letter_generated", "bundle_ready", "payment_confirmed", "dispute_opened", "promise_made"]);
const ICON = {
  invoice_created: "send", rung_advanced: "bell", rung_skipped: "chevron", letter_generated: "letter", bundle_ready: "scale",
  bundle_generated: "print", payment_confirmed: "rupee", payment_imported: "bank", promise_made: "handshake", promise_kept: "handshake",
  promise_broken: "handshakeOff", dispute_opened: "dispute", dispute_accepted: "check", dispute_resolved: "check",
  invoice_adjusted: "letter", claim_submitted: "rupee", message_queued: "mail", message_sent: "mail", message_failed: "mailX",
  marked_sent_manual: "tick", snoozed: "snooze", notice_shown: "user", invoice_edited: "draft", tds_recorded: "rupee",
};
const RUNG_ICON = { heads_up: "bell", due_date: "calendar", overdue_gentle: "mail", overdue_firm: "phone", demand_letter: "letter", odr_guidance: "scale" };

const has = (T, key) => T(key) !== key;

function eventText(T, e) {
  const p = e.payload ?? {};
  const rung = (r) => (r ? T(`core.rung.${r}`) : "");
  const money = (x) => (Number.isSafeInteger(x) ? T.money(x) : "");
  const key = `core.ev.${e.type}`;
  const title = has(T, key)
    ? T(key, { rung: rung(p.to ?? p.rung), number: p.number ?? "", date: T.date(p.date ?? p.until ?? p.paid_on), channel: T(`core.channel.${p.channel ?? "email"}`) })
    : e.type.replace(/_/g, " ");
  let detail = "";
  switch (e.type) {
    case "invoice_created":
      detail = T("core.evd.payee", { total: money(p.total_paise), vpa: p.payee_vpa ?? p.payee?.vpa ?? "—", last4: p.bank_last4 ?? p.payee?.bank_last4 ?? "—" });
      break;
    case "letter_generated":
      detail = p.interest_paise > 0 ? T("core.evd.letter", { interest: money(p.interest_paise), date: T.date(p.deadline_date) }) : T("core.evd.letter_plain", { date: T.date(p.deadline_date) });
      break;
    case "payment_confirmed":
      detail = T("core.evd.payment", { amount: money(p.amount_paise), date: T.date(p.paid_on) });
      break;
    case "promise_made":
      detail = p.amount ? T("core.evd.promise_amount", { amount: money(p.amount) }) : "";
      break;
    case "dispute_opened":
      detail = p.reason ? `“${p.reason}”` : "";
      break;
    case "claim_submitted":
      detail = T("core.evd.claim", { ref: p.ref ?? "—", amount: money(p.amount), date: T.date(p.date) });
      break;
    case "invoice_adjusted":
      detail = T("core.evd.adjusted", { no: p.credit_note_no ?? "—", amount: money(p.amount_paise) });
      break;
    case "message_failed":
      detail = p.error ? String(p.error) : "";
      break;
    default:
      detail = "";
  }
  return { title, detail };
}

// Everything the <Timeline> client component shows, already translated. inv = invoices.get() result.
export function timelineModel({ inv, cfg, asOf, T, chain }) {
  const events = [...(inv.timeline ?? [])].reverse().map((e) => {
    const { title, detail } = eventText(T, e);
    const icon = e.type === "rung_advanced" ? RUNG_ICON[e.payload?.to] ?? "bell" : ICON[e.type] ?? "info";
    return {
      id: e.id,
      title,
      detail,
      icon,
      milestone: MILESTONES.has(e.type),
      actor: T(`core.actor.${e.actor}`),
      when: T.dateTime(e.ts),
      hash: e.entry_hash,
      prevHash: e.prev_hash,
    };
  });

  const open = ["sent", "part_paid", "disputed"].includes(inv.status) && inv.outstanding_paise > 0;
  const offsets = cfg.ladder?.offsets ?? {};
  const auto = new Set(cfg.ladder?.auto_rungs ?? []);
  const current = RUNGS.indexOf(inv.rung);
  const future = open
    ? RUNGS.slice(current + 1).map((r) => {
        const date = addDays(inv.due_date, offsets[r] ?? 0);
        const late = daysBetween(date, asOf) > 0;
        return {
          rung: r,
          date,
          auto: auto.has(r),
          title: T(`core.rung.${r}`),
          when: late ? T("core.tl.due_now", { date: T.date(date) }) : T("core.tl.due_on", { date: T.date(date), rel: T.rel(date, asOf) }),
        };
      }).reverse()
    : [];
  const nextRung = future.at(-1);

  let pause = null;
  const promise = (inv.promises ?? []).find((p) => p.status === "open");
  if (inv.paused_by === "promise" && promise) pause = { title: T("core.tl.paused_promise", { date: T.date(promise.promised_date) }), detail: T("core.tl.resume_self") };
  else if (inv.paused_by === "dispute") pause = { title: T("core.tl.paused_dispute"), detail: T("core.tl.paused_dispute_detail"), href: "/inbox", hrefLabel: T("core.tl.open_inbox") };
  else if (inv.paused_by === "claim") pause = { title: T("core.tl.paused_claim"), detail: T("core.tl.paused_claim_detail"), href: "/inbox", hrefLabel: T("core.tl.open_inbox") };
  else if (inv.snoozed_until && inv.snoozed_until >= asOf) pause = { title: T("core.tl.snoozed", { date: T.date(inv.snoozed_until) }), detail: T("core.tl.resume_self") };

  const next =
    nextRung && !pause && inv.status !== "disputed"
      ? T(nextRung.auto && !inv.customer_opt_out ? "core.tl.next_auto" : "core.tl.next_you", {
          rung: nextRung.title,
          date: T.date(nextRung.date),
          rel: daysBetween(nextRung.date, asOf) > 0 ? T("core.tl.now") : T.rel(nextRung.date, asOf),
        })
      : null;

  return {
    events,
    future,
    next,
    pause,
    chain: chain
      ? {
          ok: chain.ok,
          text: chain.ok ? T("core.tl.chain_ok", { n: events.length }) : T("core.tl.chain_broken", { id: chain.breakAtId ?? "?" }),
          verifyHref: events[0] ? `/verify/${events[0].hash}` : null,
        }
      : null,
    labels: {
      title: T("core.tl.title"),
      upcoming: T("core.tl.upcoming"),
      empty: T("core.tl.empty"),
      stamp: T("core.tl.stamp"),
      open_stamp: T("core.tl.open_stamp"),
      full_hash: T("core.tl.full_hash"),
      copy: T("core.tl.copy"),
      copied: T("core.tl.copied"),
      links_to: T("core.tl.links_to"),
      links_to_after: T("core.tl.links_to_after"),
      stamp_explain: T("core.tl.stamp_explain"),
      qr_label: T("core.tl.qr_label"),
      verify_page: T("core.tl.verify_page"),
      close: T("core.close"),
    },
  };
}
