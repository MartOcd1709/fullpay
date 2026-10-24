"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";
import { fmtINR } from "@/lib/money";

// A pay-early offer for one invoice: the suggestion (cheaper than borrowing) with a one-tap "make it", or the open offer
// with "withdraw". Money is shown in rupees; everything sent is in paise.
export function OfferButton({ lang, invoiceId, suggestion, open, role }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inr = (p) => fmtINR(p, { paise: p % 100 !== 0 });
  async function make() {
    setBusy(true);
    try {
      const r = await api(`/api/invoices/${invoiceId}/offer`, { body: { discount_paise: suggestion.discount_paise, pay_by: suggestion.pay_by } });
      toast(r?.approval_pending ? T("pages.appr.sent") : T("pages.offer.made"));
      router.refresh();
    } catch (x) { toast(x.message, "error"); } finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true);
    try { await api(`/api/offers/${open.id}/withdraw`, { body: {} }); toast(T("pages.offer.withdrawn")); router.refresh(); }
    catch (x) { toast(x.message, "error"); } finally { setBusy(false); }
  }
  const btn = "inline-flex min-h-11 items-center rounded-xl px-4 font-semibold";
  if (open) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-success-soft p-2 text-sm">
        <span className="min-w-0 flex-1 font-semibold text-success">{T("pages.offer.open", { amount: inr(open.discount_paise), date: T.date(open.pay_by) })}</span>
        {role !== "viewer" && <button type="button" disabled={busy} onClick={withdraw} className={`${btn} border border-line bg-surface hover:bg-surface-2`}>{T("pages.offer.withdraw")}</button>}
      </div>
    );
  }
  if (!suggestion) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-success/40 p-2 text-sm">
      <span className="min-w-0 flex-1">
        {T("pages.offer.suggest", { amount: inr(suggestion.discount_paise), date: T.date(suggestion.pay_by), days: suggestion.days_earlier, cost: inr(suggestion.borrow_cost_paise), rate: suggestion.rate_bps / 100 })}
      </span>
      {role !== "viewer" && <button type="button" disabled={busy} onClick={make} className={`${btn} bg-accent text-on-accent hover:bg-accent-strong`}>{T("pages.offer.make")}</button>}
    </div>
  );
}

export default OfferButton;
