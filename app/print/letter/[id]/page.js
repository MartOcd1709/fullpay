import PrintFrame, { H } from "@/components/print/PrintFrame";
import InterestTable from "@/components/print/InterestTable";
import LetterInterestToggle from "@/components/print/LetterInterestToggle";
import { loadPrint, toolbarStrings } from "@/components/print/shared";
import Qr from "@/components/public/Qr";
import { inr, day } from "@/components/public/lang";
import { letterView } from "@/lib/services/letters";
import { upiString } from "@/lib/upi";
import { daysBetween } from "@/lib/time";
import { t as translate } from "@/lib/i18n";

export const metadata = { title: "Payment Demand Letter", robots: { index: false } };

export default async function LetterPrint({ params }) {
  const { view: v, lang, verifyUrl } = await loadPrint(params, letterView);
  const t = (k, vars) => translate(k, "en", vars);
  const L = (k, vars) => translate(k, lang, vars);
  const { business: b, customer: c, invoice: inv } = v;

  if (!v.available) {
    return (
      <PrintFrame lang={lang} toolbar={{ s: toolbarStrings(lang) }}>
        <div className="no-print" lang={lang} style={{ fontSize: "12pt" }}>
          <h1>{L("letter.title")}</h1>
          <p className="mt-2">{L("public.letter.not_yet", { number: inv.number ?? "—", date: day(v.available_on, lang) })}</p>
        </div>
      </PrintFrame>
    );
  }

  const contact = [b.owner_name, b.phone, b.email].filter(Boolean).join(", ");
  const showInterest = v.eligible && v.interest && v.interest_paise > 0;
  const gstTotal = v.gst?.total_paise ?? 0;
  const payUpi = b.vpa && v.requested_paise > 0 ? upiString({ pa: b.vpa, pn: b.name, am_paise: v.requested_paise, tn: inv.number }) : null;
  const toggle = showInterest ? (
    <LetterInterestToggle id={inv.id} checked={v.include} s={{ label: L("public.letter.add_interest"), error: L("error.generic") }} />
  ) : null;
  const sinceNote = v.today_owed_paise !== v.owed_paise ? <p className="w-full font-medium text-warning">{L("public.letter.since", { owed: inr(v.today_owed_paise) })}</p> : null;

  return (
    <PrintFrame lang={lang} recordHash={v.record_hash} verifyUrl={verifyUrl(v.record_hash)} toolbar={{ s: toolbarStrings(lang), extra: <>{toggle}{sinceNote}{!v.eligible && <p className="w-full text-ink-muted">{L("public.letter.no_msmed")}</p>}</> }}>
      <header className="flex items-start justify-between gap-6" style={{ borderBottom: "2px solid #111827", paddingBottom: "3mm" }}>
        <div className="min-w-0">
          <p style={{ fontSize: "14pt", fontWeight: 700, margin: 0 }}>{b.name}</p>
          <p>{b.address} · {v.labels.business_state}{b.pin ? ` · ${b.pin}` : ""}</p>
          {b.gstin && b.registration !== "unregistered" && <p>GSTIN <span className="pf-mono">{b.gstin}</span></p>}
          {b.udyam && b.udyam_number && (
            <p>{t("public.letter.udyam_line", { udyam: b.udyam_number, cls: t(`public.class_${b.udyam_class}`) })}{b.udyam_registered_on ? ` · ${t("public.letter.registered_on", { date: day(b.udyam_registered_on) })}` : ""}</p>
          )}
        </div>
        <p className="pf-small text-right">{[b.phone, b.email].filter(Boolean).join(" · ")}</p>
      </header>

      <h1 className="mt-4 text-center"><H k="letter.title" lang={lang} /></h1>
      <p className="pf-strong-box mt-2">{t("letter.disclaimer", { business: b.name })}</p>

      <div className="mt-3 flex justify-between gap-4">
        <div>
          <p className="pf-small font-semibold">{t("letter.to")}</p>
          <p className="font-semibold">{c.name}</p>
          {c.address && <p>{c.address}</p>}
          {c.gstin && <p>GSTIN <span className="pf-mono">{c.gstin}</span></p>}
        </div>
        <div className="text-right">
          <p><strong>{t("letter.date")}:</strong> {day(v.date)}</p>
          <p className="pf-small">{t("public.print.record", { hash: v.record_hash.slice(0, 16) })}</p>
        </div>
      </div>

      <p className="mt-3 font-semibold">{t("letter.subject")}</p>
      <p>{t("letter.intro", { customer: c.name, business: b.name })}</p>

      <h2><H k="letter.schedule" lang={lang} /></h2>
      <table className="pf-table">
        <thead>
          <tr>
            <th>{t("print.invoice_no")}</th>
            <th>{t("print.invoice_date")}</th>
            <th>{t("letter.acceptance_date")}</th>
            <th>{t("print.due_date")}</th>
            <th className="r">{t("field.amount")}</th>
            <th className="r">{t("letter.part_paid")}</th>
            <th className="r">{t("letter.balance")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pf-mono">{inv.number}</td>
            <td>{day(inv.issue_date)}</td>
            <td>{day(v.acceptance_date)}</td>
            <td>{day(inv.due_date)}<span className="pf-small block">{t("public.letter.days_late", { n: Math.max(0, daysBetween(inv.due_date, v.date)) })}</span></td>
            <td className="r">{inr(inv.total_paise)}</td>
            <td className="r">{inr(v.received.reduce((s, a) => s + a.amount_paise, 0) + v.credits.reduce((s, x) => s + x.amount_paise, 0))}</td>
            <td className="r font-bold">{inr(v.owed_paise)}</td>
          </tr>
          {v.received.map((a) => (
            <tr key={`a${a.id}`}>
              <td colSpan={5} className="pf-small">{t("public.letter.received_row", { amount: inr(a.amount_paise), date: day(a.allocated_on), ref: a.reference ?? "—" })}</td>
              <td className="r pf-small">{inr(a.amount_paise)}</td>
              <td />
            </tr>
          ))}
          {v.credits.map((x) => (
            <tr key={`c${x.id}`}>
              <td colSpan={5} className="pf-small">{t("public.letter.credit_row", { number: x.number, date: day(x.issue_date), reason: x.reason ?? "" })}</td>
              <td className="r pf-small">{inr(x.amount_paise)}</td>
              <td />
            </tr>
          ))}
          <tr>
            <th colSpan={6}>{t("letter.total_due")}</th>
            <td className="r font-bold">{inr(v.owed_paise)}</td>
          </tr>
        </tbody>
      </table>

      <p className="pf-strong-box mt-3" style={{ fontSize: "11pt" }}>
        {t("public.letter.pay_by", { amount: inr(v.requested_paise), date: day(v.deadline) })}
      </p>

      <section className="pf-section mt-3 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h2 style={{ marginTop: 0 }}><H k="letter.how_to_pay" lang={lang} /></h2>
          {b.bank && (
            <p>
              {t("public.letter.bank", { name: b.bank.account_name, bank: b.bank.name, last4: b.bank.account_last4 })} · IFSC <span className="pf-mono">{b.bank.ifsc}</span>
            </p>
          )}
          {b.vpa && <p>UPI: <span className="pf-mono">{b.vpa}</span></p>}
          <p>{t("public.letter.quote_ref", { number: inv.number })}</p>
          <p>{t("letter.dispute_contact", { contact })}</p>
        </div>
        {payUpi && (
          <figure className="text-center">
            <Qr text={payUpi} size="32mm" label={t("public.print.scan_pay", { amount: inr(v.requested_paise) })} />
            <figcaption className="pf-small font-semibold">{t("public.print.scan_pay", { amount: inr(v.requested_paise) })}</figcaption>
          </figure>
        )}
      </section>

      {showInterest && (
        <section className="mt-2">
          <h2><H k="letter.interest_heading" lang={lang} /></h2>
          <p>{t("letter.msmed_line", { business: b.name, cls: t(`public.class_${b.udyam_class}`), udyam: b.udyam_number })}</p>
          <p className="font-semibold">{t("public.int.computed_to", { date: day(v.date), amount: inr(v.interest_paise) })}</p>
          <InterestTable interest={v.interest} gst={v.gst} asOfLabel={day(v.date)} />
          <p className="mt-2">
            {v.include
              ? t("public.letter.requested_with", { date: day(v.deadline), p: inr(v.owed_paise), x: inr(v.interest_paise), y: inr(gstTotal), total: inr(v.requested_paise) })
              : `${t("public.letter.requested", { date: day(v.deadline), amount: inr(v.requested_paise) })} ${t("public.letter.not_added")}`}
          </p>
        </section>
      )}

      <p className="mt-4">{t("letter.confirm_receipt")}</p>
      <p>{t("letter.closing")}</p>
      <div className="mt-2" style={{ width: "70mm" }}>
        <p>{t("letter.signature", { business: b.name })}</p>
        <div style={{ height: "14mm" }} />
        <p className="font-semibold" style={{ borderTop: "1px solid #111827", paddingTop: "1mm" }}>{b.owner_name ?? t("print.signature")}<span className="pf-small block font-normal">{t("print.signature")}</span></p>
      </div>

      {showInterest && (
        <section className="pf-small mt-4" style={{ borderTop: "1px solid #9ca3af", paddingTop: "2mm" }}>
          {v.gst && <p>¹ {t("public.int.gst_footnote")}</p>}
          <p>² {v.footnote}</p>
          <p>³ {t("public.int.conventions_more")}</p>
        </section>
      )}
    </PrintFrame>
  );
}
