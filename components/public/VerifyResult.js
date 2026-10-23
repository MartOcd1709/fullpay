import Link from "next/link";
import Shell from "./Shell";
import Icon from "./Icon";
import CopyButton from "./CopyButton";
import { getLang, tr, stamp } from "./lang";
import { run } from "@/lib/services/context";
import { verifyRecord } from "@/lib/services/letters";

const LOOK = {
  intact: ["border-success bg-success-soft text-success", "shieldCheck"],
  altered: ["border-error bg-error-soft text-error", "shieldAlert"],
  not_found: ["border-warning bg-warning-soft text-warning", "shieldQuestion"],
  invalid: ["border-warning bg-warning-soft text-warning", "shieldQuestion"],
  error: ["border-warning bg-warning-soft text-warning", "shieldQuestion"],
};

// One big answer for /verify/[hash] and /v/[prefix]. Shows only type, invoice number, time, hash, chain position and payee.
export default async function VerifyResult({ code }) {
  const lang = await getLang();
  const t = tr(lang);
  let r;
  try {
    r = await run((c, ctx) => verifyRecord(c, ctx, code));
  } catch {
    r = { status: "error" };
  }
  const [cls, icon] = LOOK[r.status];
  const ev = r.event;
  const eventLabel = ev ? eventName(t, ev.type) : "";
  return (
    <Shell lang={lang} footer={<VerifyHow t={t} />}>
      <h1 className="sr-only">{t("verify.title")}</h1>
      <section role="status" className={`rounded-xl border-2 p-5 ${cls}`}>
        <p className="flex items-center gap-3 text-2xl font-bold">
          <Icon name={icon} className="h-9 w-9" />
          {t(`public.verify.${r.status}`)}
        </p>
        <p className="mt-2 font-medium">{t(`public.verify.${r.status}_body`)}</p>
        <p className="mt-1 text-ink-muted">{t("public.verify.checked_now")}</p>
      </section>

      {ev && (
        <section aria-labelledby="what" className="mt-4 rounded-xl border border-line bg-surface p-5">
          <h2 id="what" className="text-lg font-semibold">{t("public.verify.details")}</h2>
          <dl className="mt-3 space-y-3">
            <Item label={t("public.verify.what")} value={eventLabel} />
            {ev.invoice_number && <Item label={t("field.invoice_number")} value={ev.invoice_number} mono />}
            <Item label={t("public.verify.recorded")} value={stamp(ev.ts, lang)} />
            <Item label={t("public.verify.position")} value={t("public.verify.position_value", { n: r.checked_through })} />
            <div>
              <dt className="font-semibold">{t("public.verify.hash")}</dt>
              <dd className="mt-1 font-mono leading-relaxed">
                <span className="block">{ev.hash.slice(0, 32)}</span>
                <span className="block">{ev.hash.slice(32)}</span>
              </dd>
              <dd className="mt-2"><CopyButton text={ev.hash} label={t("public.verify.copy")} done={t("common.copied")} /></dd>
            </div>
          </dl>
        </section>
      )}

      {r.payee && (
        <section aria-labelledby="payto" className="mt-4 rounded-xl border-2 border-accent bg-surface p-5">
          <h2 id="payto" className="flex items-center gap-2 text-lg font-semibold text-accent"><Icon name="bank" className="h-6 w-6" />{t("verify.pay_only_to")}</h2>
          <p className="text-ink-muted">{t("verify.recorded_at")}</p>
          <dl className="mt-3 space-y-2">
            {r.payee.vpa && <Item label={t("public.pay.upi_id")} value={r.payee.vpa} mono />}
            {r.payee.bank_last4 && <Item label={t("public.verify.bank")} value={t("public.verify.ending", { last4: r.payee.bank_last4 })} />}
          </dl>
          <p className="mt-3 flex gap-2 rounded-xl bg-warning-soft px-3 py-2 font-medium text-warning">
            <Icon name="alert" className="mt-0.5 h-5 w-5" />
            <span>{t("verify.payee_warning")}</span>
          </p>
        </section>
      )}

      {(r.status === "invalid" || r.status === "not_found" || r.status === "error") && (
        <div className="mt-4">
          <Link href="/verify" className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold text-ink no-underline hover:bg-surface-2">{t("public.verify.try_another")}</Link>
        </div>
      )}
    </Shell>
  );
}

// Event type -> plain words; unknown types (added by other modules later) fall back to the type with spaces.
export function eventName(t, type) {
  const key = `public.event.${type}`;
  const label = t(key);
  return label === key ? type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : label;
}

function Item({ label, value, mono }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className={`mt-0.5 break-all ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export function VerifyHow({ t }) {
  return (
    <details>
      <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-ink">{t("public.verify.how_title")}</summary>
      <p className="mt-1">{t("verify.what_is")}</p>
      <p className="mt-1">{t("public.verify.how_body")}</p>
    </details>
  );
}
