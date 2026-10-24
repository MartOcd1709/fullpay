"use client";

import { useState } from "react";

// "Yes, this amount is right" on the customer's link. Strings come from the server page (already in the visitor's language).
export default function BalanceConfirm({ token, s, confirmed }) {
  const [done, setDone] = useState(confirmed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function yes() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/pay/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm_balance" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? s.error);
      setDone(true);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="bal-h" className="mt-4 rounded-xl border border-line bg-surface p-5">
      <h2 id="bal-h" className="text-lg font-semibold">{s.title}</h2>
      {done ? (
        <p role="status" className="mt-2 font-semibold text-success">{s.done}</p>
      ) : (
        <>
          <p className="mt-2">{s.body}</p>
          <button type="button" disabled={busy} onClick={yes}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-success/50 bg-success-soft px-5 font-semibold text-success hover:opacity-90 md:w-auto">
            {s.yes}
          </button>
          <p className="mt-2 text-sm text-ink-muted">{s.no}</p>
          {err && <p role="alert" className="mt-2 text-error">{err}</p>}
        </>
      )}
    </section>
  );
}
