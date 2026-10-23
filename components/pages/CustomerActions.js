"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import CustomerForm from "@/components/ui/CustomerForm";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

export function AddCustomer({ lang }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{T("pages.cust.add")}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={T("pages.cust.add")} closeLabel={T("pages.cust.cancel")}>
        <CustomerForm
          lang={lang}
          submitLabel={T("pages.cust.add")}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            toast(T("pages.cust.done"));
            router.refresh();
          }}
        />
      </Sheet>
    </>
  );
}

export function EditCustomer({ lang, customer, label }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{label}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} closeLabel={T("pages.cust.cancel")}>
        <CustomerForm
          lang={lang}
          initial={customer}
          submitLabel={label}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            toast(T("pages.cust.done"));
            router.refresh();
          }}
        />
      </Sheet>
    </>
  );
}

export function OptOutToggle({ lang, id, optOut }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function flip() {
    setBusy(true);
    try {
      await api(`/api/customers/${id}/optout`, { body: { opt_out: !optOut } });
      toast(T("pages.cust.done"));
      router.refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" onClick={flip} disabled={busy} aria-pressed={optOut}>
      {optOut ? T("pages.cust.optin") : T("pages.cust.optout")}
    </Button>
  );
}

export function Anonymize({ lang, id }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/customers/${id}/anonymize`);
      toast(T("pages.cust.done"));
      setAsking(false);
      router.refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }
  if (!asking) return <Button variant="secondary" onClick={() => setAsking(true)}>{T("pages.cust.anonymize_btn")}</Button>;
  return (
    <div role="alertdialog" aria-labelledby={`anon-${id}`} className="rounded-xl border border-warning bg-warning-soft p-4">
      <p id={`anon-${id}`} className="mb-3">{T("pages.cust.anonymize_confirm")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={confirm} disabled={busy}>{T("pages.cust.confirm")}</Button>
        <Button variant="secondary" onClick={() => setAsking(false)} disabled={busy}>{T("pages.cust.cancel")}</Button>
      </div>
    </div>
  );
}
