import PrintFrame, { H } from "@/components/print/PrintFrame";
import InterestTable from "@/components/print/InterestTable";
import { loadPrint, toolbarStrings } from "@/components/print/shared";
import { eventName } from "@/components/public/VerifyResult";
import { inr, day, stamp } from "@/components/public/lang";
import { bundleView } from "@/lib/services/letters";
import { t as translate } from "@/lib/i18n";

export const metadata = { title: "Evidence pack", robots: { index: false } };

const MARK = { yes: "✓", no: "✗", hand: "☐", maybe: "?" };

function detail(e, t) {
  const p = e.payload ?? {};
  switch (e.type) {
    case "invoice_created": return t("public.bundle.d_created", { total: inr(p.total_paise), due: day(p.due_date), vpa: p.payee_vpa ?? "—", last4: p.bank_last4 ?? "—" });
    case "rung_advanced": return t(`rung.${p.to}`);
    case "rung_skipped": return t(`rung.${p.rung}`);
    case "letter_generated": return t("public.bundle.d_letter", { interest: inr(p.interest_paise ?? 0), date: day(p.deadline_date) });
    case "payment_confirmed": return t("public.bundle.d_payment", { amount: inr(p.amount_paise ?? 0), date: day(p.paid_on) });
    case "claim_submitted": return t("public.bundle.d_claim", { amount: inr(p.amount ?? 0), ref: p.ref ?? "—", date: day(p.date) });
    case "dispute_opened": return `“${p.reason ?? ""}”`;
    case "promise_made":
    case "promise_broken":
    case "plan_broken": return day(p.date);
    case "plan_proposed":
    case "plan_approved": return (p.parts ?? []).map((x) => `${day(x.date)} ${inr(x.amount_paise)}`).join(" · ");
    case "plan_declined": return p.reply ? `“${p.reply}”` : "";
    case "invoice_adjusted": return t("public.bundle.d_credit", { number: p.credit_note_no ?? "—", amount: inr(p.amount_paise ?? 0) });
    case "balance_confirmed": return t("public.bundle.d_balance", { amount: inr(p.amount_paise ?? 0), date: day(p.on) });
    case "early_offer_made": return t("public.bundle.d_offer", { amount: inr(p.discount_paise ?? 0), date: day(p.pay_by) });
    case "early_offer_taken": return t("public.bundle.d_offer_taken", { amount: inr(p.discount_paise ?? 0), number: p.credit_note_no ?? "—" });
    case "reminder_sent":
    case "receipt_sent": return [p.rung && t(`rung.${p.rung}`), p.channel].filter(Boolean).join(" · ");
    default: return "";
  }
}

export default async function BundlePrint({ params }) {
  const { view: v, lang, verifyUrl } = await loadPrint(params, bundleView);
  const t = (k, vars) => translate(k, "en", vars);
  const { business: b, customer: c, invoice: inv, gates } = v;
  const received = inv.allocations.reduce((s, a) => s + a.amount_paise, 0);
  const credited = inv.credit_notes.reduce((s, x) => s + x.amount_paise, 0);
  const owed = Math.max(0, inv.outstanding_paise);
  const early = inv.status !== "draft" && v.as_of < v.odr_from;
  const terms = inv.credit_days ?? 15;
  const gateRows = [
    [gates.micro_small ? "yes" : "no", t("public.bundle.g_micro", { cls: t(`public.class_${b.udyam_class ?? "small"}`) })],
    [gates.before_supply === null ? "maybe" : gates.before_supply ? "yes" : "no", gates.before_supply === null ? t("public.bundle.g_before_unknown") : t("public.bundle.g_before", { date: day(gates.registered_on) })],
    [gates.trader === null ? "maybe" : gates.trader ? "no" : "yes", gates.trader === null ? t("public.bundle.g_trader_unknown") : t("public.bundle.g_trader")],
    [gates.limitation_days > 0 ? "yes" : "no", t("public.bundle.g_limitation", { n: Math.max(0, gates.limitation_days), date: day(gates.limitation_until) })],
  ];
  const checklist = [
    ["a", "yes", "1"],
    ["b", "yes", "1"],
    ["c", "hand", "10"],
    ["d", "yes", "4"],
    ["e", "yes", "5"],
    ["f", v.interest ? "yes" : "maybe", "6"],
    ["g", "hand", "—"],
    ["h", "maybe", "—"],
  ];
  const sections = ["parties", "checklist", "gates", "facts", "payments", "amount", "timeline", "replies", "messages", "undertaking"];

  return (
    <PrintFrame lang={lang} recordHash={v.record_hash} verifyUrl={verifyUrl(v.record_hash)} toolbar={{ s: toolbarStrings(lang) }}>
      <header style={{ borderBottom: "2px solid #111827", paddingBottom: "3mm" }}>
        <h1><H k="public.bundle.title" lang={lang} /></h1>
        <p>{t("bundle.cover", { business: b.name, date: day(v.as_of) })}</p>
        <p className="font-semibold">{t("public.bundle.portal_line")}</p>
        <p className="pf-strong-box mt-2">{t("public.bundle.hedge")}</p>
        {early && <p className="pf-box mt-2">{t("public.bundle.early", { date: day(v.odr_from) })}</p>}
        {!v.eligible && <p className="pf-box mt-2">{t("odr.not_eligible")}</p>}
      </header>

      <h2>{t("public.bundle.contents")}</h2>
      <ol className="pf-small" style={{ listStyle: "decimal", paddingLeft: "6mm", columns: 2 }}>
        {sections.map((s) => <li key={s}>{t(`public.bundle.s_${s}`)}</li>)}
      </ol>

      <h2>1. <H k="public.bundle.s_parties" lang={lang} /></h2>
      <div className="pf-grid2">
        <div className="pf-box">
          <h3 style={{ marginTop: 0 }}>{t("public.bundle.seller")}</h3>
          <p className="font-semibold">{b.name}</p>
          <p>{b.address} · {v.labels.business_state}</p>
          {b.gstin && <p>GSTIN <span className="pf-mono">{b.gstin}</span></p>}
          {b.udyam_number && <p>{t("public.letter.udyam_line", { udyam: b.udyam_number, cls: t(`public.class_${b.udyam_class ?? "small"}`) })}</p>}
          <p className="pf-small">{[b.owner_name, b.phone, b.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="pf-box">
          <h3 style={{ marginTop: 0 }}>{t("public.bundle.buyer")}</h3>
          <p className="font-semibold">{c.name}</p>
          {c.address && <p>{c.address}</p>}
          <p>{v.labels.customer_state}</p>
          <p>{c.gstin ? <>GSTIN <span className="pf-mono">{c.gstin}</span></> : t("public.print.unregistered_buyer")}</p>
          <p className="pf-small">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      </div>

      <h2>2. <H k="bundle.checklist" lang={lang} /></h2>
      <table className="pf-table">
        <thead><tr><th>{t("public.bundle.item")}</th><th>{t("field.status")}</th><th>{t("public.bundle.where")}</th></tr></thead>
        <tbody>
          {checklist.map(([k, st, where]) => (
            <tr key={k}>
              <td>({k}) {t(`public.bundle.c_${k}`)}</td>
              <td style={{ whiteSpace: "nowrap" }}>{MARK[st]} {t(`public.bundle.st_${k}`)}</td>
              <td>{where === "—" ? "—" : t("public.bundle.see", { n: where })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. <H k="public.bundle.s_gates" lang={lang} /></h2>
      <ul>
        {gateRows.map(([st, text], i) => (
          <li key={i} className="flex gap-2"><span className="font-bold" aria-hidden="true">{MARK[st]}</span><span><strong>{t(`public.bundle.mark_${st}`)}:</strong> {text}</span></li>
        ))}
      </ul>
      <p className="pf-small">{t("public.bundle.gates_note")}</p>

      <h2 className="pf-page-break">4. <H k="public.bundle.s_facts" lang={lang} /></h2>
      <table className="pf-table">
        <thead>
          <tr><th>{t("print.invoice_no")}</th><th>{t("print.invoice_date")}</th><th>{t("letter.acceptance_date")}</th><th>{t("print.due_date")}</th><th className="r">{t("field.amount")}</th><th className="r">{t("letter.balance")}</th></tr>
        </thead>
        <tbody>
          <tr>
            <td className="pf-mono">{inv.number ?? "—"}</td><td>{day(inv.issue_date)}</td><td>{day(v.acceptance_date)}</td><td>{day(inv.due_date)}</td>
            <td className="r">{inr(inv.total_paise)}</td><td className="r font-bold">{inr(owed)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2">{t("public.bundle.days_calc", { accepted: day(v.acceptance_date), terms, due: day(inv.due_date), today: day(v.as_of), n: v.days_overdue })}</p>
      <table className="pf-table mt-2">
        <thead><tr><th>{t("field.description")}</th><th>HSN/SAC</th><th className="r">{t("field.qty")}</th><th className="r">{t("print.taxable_value")}</th><th className="r">GST</th></tr></thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.id}>
              <td>{it.description}</td><td className="pf-mono">{it.hsn_sac ?? "—"}</td>
              <td className="r">{(it.qty_milli / 1000).toLocaleString("en-IN")} {it.unit}</td>
              <td className="r">{inr(it.taxable_paise)}</td><td className="r">{inr(it.cgst_paise + it.sgst_paise + it.igst_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pf-small">{t("public.bundle.invoice_attached", { number: inv.number ?? "—" })}</p>

      <h2>5. <H k="public.bundle.s_payments" lang={lang} /></h2>
      {inv.allocations.length + inv.credit_notes.length === 0 ? (
        <p>{t("public.bundle.no_payments")}</p>
      ) : (
        <table className="pf-table">
          <thead><tr><th>{t("letter.date")}</th><th>{t("public.bundle.kind")}</th><th>{t("public.bundle.reference")}</th><th className="r">{t("field.amount")}</th></tr></thead>
          <tbody>
            {inv.allocations.map((a) => (
              <tr key={`a${a.id}`}><td>{day(a.allocated_on)}</td><td>{t("public.bundle.k_payment")}</td><td className="pf-mono">{a.reference ?? "—"}</td><td className="r">{inr(a.amount_paise)}</td></tr>
            ))}
            {inv.credit_notes.map((x) => (
              <tr key={`c${x.id}`}><td>{day(x.issue_date)}</td><td>{t("public.bundle.k_credit")}</td><td className="pf-mono">{x.number}</td><td className="r">{inr(x.amount_paise)}</td></tr>
            ))}
            <tr><th colSpan={3}>{t("public.bundle.total_received")}</th><td className="r font-bold">{inr(received + credited)}</td></tr>
          </tbody>
        </table>
      )}

      <h2>6. <H k="public.bundle.s_amount" lang={lang} /></h2>
      <p className="font-semibold">{t("public.bundle.owed_line", { amount: inr(owed), date: day(v.as_of) })}</p>
      {v.interest ? (
        <>
          <p>{t("letter.msmed_line", { business: b.name, cls: t(`public.class_${b.udyam_class ?? "small"}`), udyam: b.udyam_number ?? "—" })}</p>
          <InterestTable interest={v.interest} gst={v.gst} asOfLabel={day(v.as_of)} />
          <p className="pf-small mt-1">{v.footnote}</p>
          <p className="pf-small">{t("public.int.conventions_more")}</p>
          {v.gst && <p className="pf-small">{t("public.int.gst_footnote")}</p>}
        </>
      ) : (
        <p>{v.eligible ? t("public.bundle.no_interest") : t("public.letter.no_msmed")}</p>
      )}

      <h2 className="pf-page-break">7. <H k="public.bundle.s_timeline" lang={lang} /></h2>
      <p className="pf-small">{t("bundle.chain_hint")}</p>
      <table className="pf-table">
        <thead><tr><th>{t("public.bundle.time")}</th><th>{t("public.bundle.event")}</th><th>{t("public.bundle.actor")}</th><th>{t("public.bundle.record")}</th></tr></thead>
        <tbody>
          {inv.timeline.map((e) => (
            <tr key={e.id}>
              <td style={{ whiteSpace: "nowrap" }}>{stamp(e.ts)}</td>
              <td><strong>{eventName(t, e.type)}</strong>{detail(e, t) && <span className="block">{detail(e, t)}</span>}</td>
              <td>{t(`public.actor.${e.actor}`)}</td>
              <td className="pf-mono">{e.entry_hash.slice(0, 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>8. <H k="public.bundle.s_replies" lang={lang} /></h2>
      {inv.inbox.length === 0 ? (
        <p>{t("public.bundle.no_replies")}</p>
      ) : (
        inv.inbox.map((i) => (
          <div key={i.id} className="pf-box pf-section mt-2">
            <p><strong>{t(`public.bundle.inbox_${i.kind}`)}</strong> · {day(i.opened_on)} · {t(`public.bundle.inbox_${i.status}`)}{i.resolved_on ? ` ${day(i.resolved_on)}` : ""}</p>
            {i.reason && <p>“{i.reason}”</p>}
            {i.resolution && <p className="pf-small">{t("public.bundle.resolution", { action: t(`public.bundle.res_${i.resolution}`) })}{i.accepted ? ` · ${t("public.bundle.accepted_span")}` : ""}</p>}
            {i.reply && <p className="pf-small">{t("public.bundle.reply", { text: i.reply })}</p>}
          </div>
        ))
      )}

      <h2>9. <H k="bundle.reminders" lang={lang} /></h2>
      {v.outbox.length === 0 ? (
        <p>{t("public.bundle.no_messages")}</p>
      ) : (
        <table className="pf-table">
          <thead><tr><th>{t("public.bundle.time")}</th><th>{t("public.bundle.stage")}</th><th>{t("public.bundle.channel")}</th><th>{t("field.status")}</th></tr></thead>
          <tbody>
            {v.outbox.map((o) => (
              <tr key={o.id}><td>{stamp(o.sent_at ?? o.created_at)}</td><td>{t(`rung.${o.rung}`)}{o.subject && <span className="pf-small block">{o.subject}</span>}</td><td>{o.channel}</td><td>{o.status}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="pf-section">10. <H k="public.bundle.s_undertaking" lang={lang} /></h2>
      <div className="pf-box pf-section">
        <p>{t("public.bundle.undertaking", { owner: b.owner_name ?? "—", business: b.name })}</p>
        <div className="pf-grid2 mt-3">
          <p style={{ borderTop: "1px solid #111827", paddingTop: "1mm", marginTop: "12mm" }}>{t("public.bundle.sign_here")}</p>
          <p style={{ borderTop: "1px solid #111827", paddingTop: "1mm", marginTop: "12mm" }}>{t("public.bundle.date_place")}</p>
        </div>
      </div>

      <h2 className="pf-section"><H k="bundle.chain_page" lang={lang} /></h2>
      <p>
        {v.chain.ok ? t("public.bundle.chain_ok", { n: v.chain.count }) : t("public.bundle.chain_bad", { n: v.chain.count })}
      </p>
    </PrintFrame>
  );
}
