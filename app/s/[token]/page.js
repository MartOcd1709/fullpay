import Link from "next/link";
import Shell from "@/components/public/Shell";
import Chip from "@/components/public/Chip";
import Qr from "@/components/public/Qr";
import { getLang, tr, inr, day } from "@/components/public/lang";
import { run } from "@/lib/services/context";
import * as statement from "@/lib/services/statement";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statement", robots: { index: false } };

// The customer's statement of account: every open bill, the total, and one UPI QR for all of it. No login.
export default async function StatementPage({ params }) {
  const lang = await getLang();
  const t = tr(lang);
  const { token } = await params;
  const view = await run((c, ctx) => statement.byToken(c, ctx, token)).catch(() => null);
  if (!view) {
    return (
      <Shell lang={lang}>
        <section className="py-10 text-center"><h1 className="text-2xl font-bold">{t("stmt.missing")}</h1><p className="mt-2 text-ink-muted">{t("stmt.missing_body")}</p></section>
      </Shell>
    );
  }
  const b = view.business;
  return (
    <Shell lang={lang}>
      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="text-ink-muted">{t("stmt.from", { business: b.name })}</p>
        <h1 className="mt-1 text-2xl font-bold" translate="no">{view.customer.name}</h1>
        <p className="mt-3 text-ink-muted">{t("stmt.total_label", { date: day(view.as_of, lang) })}</p>
        <p className="text-3xl font-bold tnum">{inr(view.total_paise)}</p>
      </section>
      {view.invoices.length === 0 ? (
        <p className="mt-4 rounded-xl border border-success/40 bg-success-soft p-4 font-semibold text-success">{t("stmt.clear")}</p>
      ) : (
        <>
          <ul className="mt-4 grid gap-2" aria-label={t("stmt.bills")}>
            {view.invoices.map((r) => (
              <li key={r.number} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{r.number}</span>
                  <span className="block text-sm text-ink-muted">{t("stmt.due", { date: day(r.due_date, lang) })}</span>
                </span>
                <Chip status={r.display_status}>{t(`status.${r.display_status}`)}</Chip>
                <span className="tnum font-semibold">{inr(r.outstanding_paise)}</span>
                {r.pay_token && <Link href={`/pay/${r.pay_token}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line px-4 font-semibold no-underline hover:bg-surface-2 sm:w-auto">{t("stmt.open_bill")}</Link>}
              </li>
            ))}
          </ul>
          {view.upi && (
            <section aria-labelledby="stmt-upi" className="mt-4 rounded-xl border border-line bg-surface p-5">
              <h2 id="stmt-upi" className="text-lg font-semibold">{t("stmt.pay_all")}</h2>
              <div className="mt-3 flex flex-col gap-4 md:flex-row-reverse md:items-center md:justify-end">
                <div className="flex-1">
                  <a href={view.upi} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-5 text-lg font-semibold text-on-accent no-underline hover:bg-accent-strong md:w-auto">{t("stmt.pay_button", { amount: inr(view.total_paise) })}</a>
                  <p className="mt-2 text-ink-muted">{t("public.pay.upi_to", { vpa: b.vpa })}</p>
                  {view.invoices.some((r) => r.disputed) && <p className="mt-2 text-sm text-ink-muted">{t("stmt.disputed_left_out")}</p>}
                </div>
                <figure className="self-center rounded-xl border border-line p-2 md:self-auto">
                  <Qr text={view.upi} size="12rem" label={t("public.pay.qr_label", { amount: inr(view.total_paise) })} />
                  <figcaption className="mt-1 text-center font-semibold">{inr(view.total_paise)}</figcaption>
                </figure>
              </div>
            </section>
          )}
        </>
      )}
      <p className="mt-4 text-sm text-ink-muted">{t("stmt.contact", { phone: b.phone ?? "", email: b.email ?? "" })}</p>
    </Shell>
  );
}
