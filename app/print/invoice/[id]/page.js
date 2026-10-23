import PrintFrame, { H } from "@/components/print/PrintFrame";
import { loadPrint, toolbarStrings } from "@/components/print/shared";
import Qr from "@/components/public/Qr";
import { inr, day } from "@/components/public/lang";
import { invoicePrint } from "@/lib/services/letters";
import { COMPOSITION_HEADING } from "@/lib/gst";
import { t as translate } from "@/lib/i18n";

export const metadata = { title: "Invoice", robots: { index: false } };

const TITLE = { tax_invoice: "print.tax_invoice", bill_of_supply: "print.bill_of_supply", plain: "print.invoice" };
const qty = (milli) => (milli / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const pct = (bps) => `${(bps / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

export default async function InvoicePrint({ params }) {
  const { view: v, lang, verifyUrl } = await loadPrint(params, invoicePrint);
  const t = (k, vars) => translate(k, "en", vars);
  const { business: b, customer: c, invoice: inv } = v;
  const taxed = inv.doc_type === "tax_invoice";
  const owed = Math.max(0, inv.outstanding_paise);
  const draft = inv.status === "draft";
  const recordUrl = verifyUrl(v.record_hash);
  const extra = taxed && !draft ? (
    <a href={`/api/print/einvoice/${inv.id}`} download className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-semibold text-ink no-underline hover:bg-surface-2" title={translate("public.print.einvoice_tip", lang)}>
      {translate("public.print.einvoice_download", lang)}
    </a>
  ) : null;

  return (
    <PrintFrame
      lang={lang}
      recordHash={v.record_hash}
      verifyUrl={recordUrl}
      watermark={draft ? t("public.print.draft_mark") : inv.display_status === "paid" ? t("status.paid").toUpperCase() : null}
      toolbar={{ s: toolbarStrings(lang), extra: extra && <span className="flex flex-col">{extra}<span className="text-ink-muted">{translate("public.print.einvoice_tip", lang)}</span></span> }}
    >
      <header className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1>{b.name}</h1>
          <p>{b.address}</p>
          <p>{t("field.state")}: {v.labels.business_state}{b.pin ? ` · PIN ${b.pin}` : ""}</p>
          {b.registration !== "unregistered" && b.gstin && <p><strong>GSTIN:</strong> <span className="pf-mono">{b.gstin}</span></p>}
          {b.udyam && b.udyam_number && <p><strong>{t("print.udyam")}:</strong> {b.udyam_number}</p>}
          <p className="pf-small">{[b.phone, b.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="pf-box shrink-0 text-right" style={{ minWidth: "62mm" }}>
          <p style={{ fontSize: "14pt", fontWeight: 800, margin: 0 }}><H k={TITLE[inv.doc_type]} lang={lang} /></p>
          {inv.doc_type === "bill_of_supply" && <p className="pf-small font-semibold">{COMPOSITION_HEADING}</p>}
          <p className="pf-small"><H k="print.original" lang={lang} /></p>
        </div>
      </header>

      {v.einvoice && <p className="pf-strong-box mt-3">{t("print.einvoice_note")}</p>}

      <table className="pf-table mt-3">
        <tbody>
          <tr>
            <th><H k="print.invoice_no" lang={lang} /></th>
            <td className="pf-mono" style={{ fontSize: "9pt" }}>{inv.number ?? t("public.print.not_numbered")}</td>
            <th><H k="print.invoice_date" lang={lang} /></th>
            <td>{day(inv.issue_date)}</td>
          </tr>
          <tr>
            <th><H k="print.place_of_supply" lang={lang} /></th>
            <td>{v.labels.pos}</td>
            <th><H k="print.due_date" lang={lang} /></th>
            <td>{day(inv.due_date)}</td>
          </tr>
          <tr>
            <th><H k="print.reverse_charge" lang={lang} /></th>
            <td>{inv.reverse_charge ? t("common.yes") : t("common.no")}</td>
            <th>{t("public.print.supply_type")}</th>
            <td>{taxed ? (v.interstate ? t("public.print.inter_state") : t("public.print.intra_state")) : "—"}</td>
          </tr>
        </tbody>
      </table>

      <div className="pf-grid2 mt-3">
        <div className="pf-box">
          <h3 style={{ marginTop: 0 }}><H k="print.billed_to" lang={lang} /></h3>
          <p className="font-semibold">{c.name}</p>
          {c.address && <p>{c.address}</p>}
          <p>{t("field.state")}: {v.labels.customer_state}</p>
          <p>{c.gstin ? <>GSTIN: <span className="pf-mono">{c.gstin}</span></> : t("public.print.unregistered_buyer")}</p>
        </div>
        <div className="pf-box">
          <h3 style={{ marginTop: 0 }}><H k="print.ship_to" lang={lang} /></h3>
          <p>{inv.ship_to && inv.ship_to.trim() !== (c.address ?? "").trim() ? inv.ship_to : t("public.print.same_address")}</p>
          {inv.delivery_date && <p className="pf-small">{t("public.print.delivered_on", { date: day(inv.delivery_date) })}</p>}
        </div>
      </div>

      <table className="pf-table mt-3">
        <thead>
          <tr>
            <th>{t("print.sno")}</th>
            <th>{t("field.description")}</th>
            <th>HSN/SAC</th>
            <th className="r">{t("field.qty")}</th>
            <th>{t("field.unit")}</th>
            <th className="r">{t("field.rate")}</th>
            {v.show_discount && <th className="r">{t("public.print.discount")}</th>}
            <th className="r">{t("print.taxable_value")}</th>
            {taxed && (v.interstate ? <th className="r">IGST</th> : <><th className="r">CGST</th><th className="r">SGST</th></>)}
            <th className="r">{t("print.total")}</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.id}>
              <td>{it.position}</td>
              <td>{it.description}</td>
              <td className="pf-mono">{it.hsn_sac ?? "—"}</td>
              <td className="r">{qty(it.qty_milli)}</td>
              <td>{it.unit}</td>
              <td className="r">{inr(it.rate_paise)}</td>
              {v.show_discount && <td className="r">{inr(it.discount_paise)}</td>}
              <td className="r">{inr(it.taxable_paise)}</td>
              {taxed &&
                (v.interstate ? (
                  <td className="r">{pct(it.gst_bps)}<br />{inr(it.igst_paise)}</td>
                ) : (
                  <>
                    <td className="r">{pct(it.gst_bps / 2)}<br />{inr(it.cgst_paise)}</td>
                    <td className="r">{pct(it.gst_bps / 2)}<br />{inr(it.sgst_paise)}</td>
                  </>
                ))}
              <td className="r">{inr(it.taxable_paise + it.cgst_paise + it.sgst_paise + it.igst_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="pf-small font-semibold"><H k="print.in_words" lang={lang} /></p>
          <p className="font-semibold">{v.words}</p>
          {inv.notes && <p className="pf-small">{inv.notes}</p>}
        </div>
        <table className="pf-table" style={{ width: "72mm" }}>
          <tbody>
            {taxed && <tr><th>{t("print.taxable_value")}</th><td className="r">{inr(inv.taxable_paise)}</td></tr>}
            {taxed && !v.interstate && <tr><th>CGST</th><td className="r">{inr(inv.cgst_paise)}</td></tr>}
            {taxed && !v.interstate && <tr><th>SGST</th><td className="r">{inr(inv.sgst_paise)}</td></tr>}
            {taxed && v.interstate && <tr><th>IGST</th><td className="r">{inr(inv.igst_paise)}</td></tr>}
            {!taxed && <tr><th>{t("public.print.value")}</th><td className="r">{inr(inv.total_paise - inv.round_off_paise)}</td></tr>}
            <tr><th>{t("public.print.round_off")}</th><td className="r">{inr(inv.round_off_paise)}</td></tr>
            <tr><th style={{ fontSize: "10pt" }}>{t("public.print.grand_total")}</th><td className="r" style={{ fontSize: "10pt", fontWeight: 700 }}>{inr(inv.total_paise)}</td></tr>
            {inv.paid_paise + inv.credited_paise > 0 && <tr><th>{t("print.outstanding")}</th><td className="r">{inr(owed)}</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="pf-section mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h3 style={{ marginTop: 0 }}><H k="print.bank_details" lang={lang} /></h3>
          {b.bank && (
            <p>
              {b.bank.account_name} · {b.bank.name}<br />
              {t("public.print.account_ending", { last4: b.bank.account_last4 })} · IFSC <span className="pf-mono">{b.bank.ifsc}</span>
            </p>
          )}
          {b.vpa && <p>UPI: <span className="pf-mono">{b.vpa}</span></p>}
          <p className="pf-small">{t("public.print.genuine_line")}</p>
        </div>
        {inv.upi && !draft && (
          <figure className="text-center">
            <Qr text={inv.upi} size="32mm" label={t("public.print.scan_pay", { amount: inr(owed) })} />
            <figcaption className="pf-small font-semibold">{t("public.print.scan_pay", { amount: inr(owed) })}</figcaption>
          </figure>
        )}
        <div className="text-right" style={{ minWidth: "55mm" }}>
          <p>{t("print.for_business", { business: b.name })}</p>
          <div style={{ height: "16mm" }} />
          <p className="font-semibold" style={{ borderTop: "1px solid #111827", paddingTop: "1mm" }}><H k="print.signature" lang={lang} /></p>
        </div>
      </section>
    </PrintFrame>
  );
}
