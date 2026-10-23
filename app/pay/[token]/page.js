import Link from "next/link";
import Shell from "@/components/public/Shell";
import Icon from "@/components/public/Icon";
import Chip from "@/components/public/Chip";
import Qr from "@/components/public/Qr";
import PayActions from "@/components/public/PayActions";
import { getLang, tr, inr, lakh, day } from "@/components/public/lang";
import { run } from "@/lib/services/context";
import { payPage } from "@/lib/services/letters";
import { daysBetween } from "@/lib/time";

export const metadata = { title: "Your invoice", robots: { index: false } };

const ACTION_KEYS = [
  "pay.already_paid", "pay.something_wrong", "pay.submit", "pay.reason", "pay.promise", "common.optional", "error.generic", "error.network",
  "public.pay.ref", "public.pay.ref_hint", "public.pay.paid_on", "public.pay.amount_paid", "public.pay.claim_done", "public.pay.dispute_done",
  "public.pay.promise_done", "public.pay.promise_hint", "public.pay.promise_title", "public.pay.details", "public.pay.details_hint",
  "public.pay.r_wrong_amount", "public.pay.r_wrong_quantity", "public.pay.r_returned", "public.pay.r_already_paid", "public.pay.r_other",
  "public.pay.reason_legend", "public.pay.sending", "public.pay.sim_title", "public.pay.sim_body", "public.pay.sim_full", "public.pay.sim_tds",
  "public.pay.sim_done", "public.pay.pauses",
  ...["invalid_amount", "invalid_date", "claim_open", "not_open", "promise_open", "promise_broken_before", "date_past", "date_too_far", "already_simulated", "reason_required", "validation", "link_expired", "not_found"].map((c) => `public.pay.err_${c}`),
];

export default async function PayPage({ params }) {
  const { token } = await params;
  let view;
  try {
    view = await run((c, ctx) => payPage(c, ctx, token));
  } catch {
    view = { state: "error", lang: "en" };
  }
  const lang = await getLang(view.lang);
  const t = tr(lang);

  if (view.state !== "ok") {
    const key = { missing: "missing", expired: "expired", error: "error" }[view.state];
    const contact = view.contact ? [view.contact.phone, view.contact.email].filter(Boolean).join(" · ") : "";
    return (
      <Shell lang={lang} brandHref={null}>
        <section className="rounded-xl border border-line bg-surface p-6 text-center">
          <span className="mx-auto inline-flex rounded-full bg-warning-soft p-3 text-warning"><Icon name={view.state === "expired" ? "clock" : "alert"} className="h-8 w-8" /></span>
          <h1 className="mt-3 text-2xl font-bold">{t(`public.pay.${key}_title`)}</h1>
          <p className="mx-auto mt-2 max-w-prose text-ink-muted">
            {view.state === "expired" ? t("pay.expired", { business: view.contact.name, contact }) : t(`public.pay.${key}_body`)}
          </p>
        </section>
      </Shell>
    );
  }

  const { business: b, invoice: inv, open } = view;
  const owed = inv.outstanding_paise;
  const settled = inv.display_status === "paid" || owed <= 0;
  const days = daysBetween(inv.due_date, view.as_of);
  const due = days > 0 ? t("public.pay.due_ago", { date: day(inv.due_date, lang), n: days }) : days === 0 ? t("public.pay.due_today") : t("public.pay.due_in", { date: day(inv.due_date, lang), n: -days });
  const contact = [b.contact?.phone, b.contact?.email].filter(Boolean).join(" · ");
  const sub = lakh(owed, lang);
  const s = Object.fromEntries(ACTION_KEYS.map((k) => [k, t(k, { business: b.name })]));
  s["public.pay.sim_tds"] = t("public.pay.sim_tds", { amount: inr(owed - view.tds_paise) });
  s["public.pay.sim_full"] = t("public.pay.sim_full", { amount: inr(owed) });
  const taxed = inv.doc_type === "tax_invoice";
  const verifyHref = view.record_hash ? `/v/${view.record_hash.slice(0, 16)}` : null;

  return (
    <Shell
      lang={lang}
      brandHref={null}
      footer={
        <div className="space-y-1">
          <p className="font-semibold text-ink">{t("public.pay.privacy_title")}</p>
          <p>{t("public.pay.privacy", { business: b.name, contact })}</p>
        </div>
      }
    >
      <section aria-labelledby="bill" className="rounded-xl border border-line bg-surface p-5">
        <p className="text-ink-muted">{t("pay.title", { business: b.name })}</p>
        <h1 id="bill" className="mt-1 text-xl font-bold">{t("public.pay.bill_no", { number: inv.number })}</h1>
        <div className="mt-4">
          <p className="text-ink-muted">{settled ? t("public.pay.settled_label") : t("public.pay.still_owed")}</p>
          <p className="tnum text-4xl font-bold leading-tight">{inr(owed)}</p>
          {sub && !settled && <p className="text-ink-muted">{sub}</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip status={inv.display_status}>{t(`status.${inv.display_status}`)}</Chip>
          {!settled && <span className="text-ink">{due}</span>}
        </div>
        {inv.total_paise !== owed && !settled && (
          <p className="mt-2 text-ink-muted">{t("public.pay.of_total", { total: inr(inv.total_paise) })}</p>
        )}
      </section>

      {settled && <Notice tone="success" icon="check">{t("pay.paid")}</Notice>}
      {open.dispute && <Notice tone="info" icon="pause">{t("public.pay.state_dispute", { business: b.name })}</Notice>}
      {open.claim && <Notice tone="info" icon="pause">{t("public.pay.state_claim", { business: b.name })}</Notice>}
      {open.promise_date && <Notice tone="info" icon="clock">{t("public.pay.state_promise", { date: day(open.promise_date, lang) })}</Notice>}
      {view.sim_pending && <Notice tone="info" icon="clock">{t("public.pay.state_sim", { business: b.name })}</Notice>}

      {!settled && view.upi && !open.dispute && (
        <section aria-labelledby="upi" className="mt-4 rounded-xl border border-line bg-surface p-5">
          <h2 id="upi" className="text-lg font-semibold">{t("pay.pay_upi")}</h2>
          <div className="mt-3 flex flex-col gap-5 md:flex-row-reverse md:items-center md:justify-end">
            <div className="flex-1">
              <a href={view.upi} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2 text-lg font-semibold text-on-accent no-underline hover:bg-accent-strong md:w-auto">
                <Icon name="qr" />
                {t("public.pay.pay_amount", { amount: inr(owed) })}
              </a>
              <p className="mt-2 text-ink-muted">{t("pay.scan")}</p>
              <p className="mt-1 text-ink-muted">{t("public.pay.upi_to", { vpa: b.vpa })}</p>
            </div>
            <figure className="self-center rounded-xl border border-line p-2 md:self-auto">
              <Qr text={view.upi} size="12rem" label={t("public.pay.qr_label", { amount: inr(owed) })} />
              <figcaption className="mt-1 text-center font-semibold">{inr(owed)}</figcaption>
            </figure>
          </div>
          {view.demo && (
            <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft px-3 py-2 font-medium text-warning">
              <Icon name="alert" className="mt-0.5 h-5 w-5" />
              <span>{t("public.pay.demo_no_money")}</span>
            </p>
          )}
        </section>
      )}

      {!settled && (
        <PayActions
          token={token}
          s={s}
          lang={lang}
          defaults={{ amount: (owed / 100).toFixed(2), asOf: view.as_of, promiseMax: view.promise_max }}
          can={{
            claim: !open.claim && !open.dispute,
            dispute: !open.dispute,
            promise: !open.promise_date && !open.dispute,
            simulate: view.demo && !view.sim_pending && !open.dispute && Boolean(view.upi),
            tds: view.tds_paise > 0 && view.tds_paise < owed,
          }}
        />
      )}

      <section aria-labelledby="genuine" className="mt-4 rounded-xl border-2 border-success bg-success-soft p-5">
        <h2 id="genuine" className="flex items-center gap-2 text-lg font-semibold text-success"><Icon name="shieldCheck" className="h-6 w-6" />{t("pay.genuine")}</h2>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="font-semibold">{t("verify.pay_only_to")}</dt>
            <dd className="break-all">{t("public.pay.upi_id")}: <span className="font-mono">{b.vpa}</span></dd>
            {b.bank && <dd>{t("public.pay.bank_line", { bank: b.bank.name, last4: b.bank.account_last4 })}</dd>}
          </div>
        </dl>
        <p className="mt-2">{t("public.pay.never_ask")}</p>
        {verifyHref && (
          <Link href={verifyHref} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-success bg-surface px-4 font-semibold text-success no-underline hover:bg-success-soft">
            {t("pay.verify_link")}
            <Icon name="arrow" />
          </Link>
        )}
      </section>

      <details className="mt-4 rounded-xl border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer items-center px-5 py-3 font-semibold">{t("public.pay.bill_lines")}</summary>
        <div className="border-t border-line px-5 py-4">
          <p className="text-ink-muted">{t("public.pay.issued", { date: day(inv.issue_date, lang), buyer: inv.buyer_name })}</p>
          <ul className="mt-3 divide-y divide-line">
            {inv.items.map((it) => {
              const tax = it.cgst_paise + it.sgst_paise + it.igst_paise;
              return (
                <li key={it.position} className="py-3">
                  <p className="font-semibold">{it.description}</p>
                  <p className="text-ink-muted">
                    {t("public.pay.line_qty", { qty: (it.qty_milli / 1000).toLocaleString("en-IN"), unit: it.unit, rate: inr(it.rate_paise) })}
                    {it.hsn_sac ? ` · HSN ${it.hsn_sac}` : ""}
                  </p>
                  <p className="tnum">
                    {inr(it.taxable_paise)}
                    {taxed && tax > 0 ? ` + ${t("public.pay.gst_at", { rate: it.gst_bps / 100 })} ${inr(tax)}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3">
            {taxed && <Row label={t("print.taxable_value")} value={inr(inv.taxable_paise)} />}
            {inv.cgst_paise > 0 && <Row label="CGST" value={inr(inv.cgst_paise)} />}
            {inv.sgst_paise > 0 && <Row label="SGST" value={inr(inv.sgst_paise)} />}
            {inv.igst_paise > 0 && <Row label="IGST" value={inr(inv.igst_paise)} />}
            {inv.round_off_paise !== 0 && <Row label={t("public.print.round_off")} value={inr(inv.round_off_paise)} />}
            <Row label={t("print.total")} value={inr(inv.total_paise)} strong />
          </dl>
        </div>
      </details>

      {view.s37 && (
        <details className="mt-4 rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center px-5 py-3 font-semibold">{t("public.pay.why_date")}</summary>
          <p className="border-t border-line px-5 py-4">
            {t(`public.pay.s37_${view.s37}`, { business: b.name, cls: t(`public.class_${view.udyam_class}`), date: day(inv.due_date, lang) })}
          </p>
        </details>
      )}
    </Shell>
  );
}

function Notice({ tone, icon, children }) {
  const cls = { success: "bg-success-soft text-success", info: "bg-info-soft text-info" }[tone];
  return (
    <p role="status" className={`mt-4 flex gap-2 rounded-xl px-4 py-3 font-medium ${cls}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5" />
      <span>{children}</span>
    </p>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-lg font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}
