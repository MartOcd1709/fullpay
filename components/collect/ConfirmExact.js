"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Money from "@/components/ui/Money";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

// One action for the bulk of a busy statement: every exact match (95%+, nothing flagged). Two-step, so it is never a slip.
export function ConfirmExact({ lang, n, paise, role }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api("/api/payments/confirm-exact", { body: {} });
      toast(r.queued ? T("pages.bulk.queued", { n: r.queued }) : T("pages.bulk.done", { n: r.confirmed, s: r.skipped }));
      setSure(false);
      router.refresh();
    } catch (x) {
      toast(x.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-success/40 bg-success-soft p-4">
      <p className="min-w-0 flex-1">
        <strong>{T("pages.bulk.ready", { n })}</strong> <Money paise={paise} className="font-bold" />
        <span className="block text-ink-muted">{T(role === "accountant" ? "pages.bulk.hint_acct" : "pages.bulk.hint")}</span>
      </p>
      {!sure ? (
        <Button onClick={() => setSure(true)}>{T(role === "accountant" ? "pages.bulk.send" : "pages.bulk.confirm", { n })}</Button>
      ) : (
        <span className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={go}>{T("pages.bulk.yes", { n })}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setSure(false)}>{T("pages.cust.cancel")}</Button>
        </span>
      )}
    </div>
  );
}
