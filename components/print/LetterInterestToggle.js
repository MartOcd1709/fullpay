"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Owner's tick: add the s.16 interest (and GST on it) to the amount requested. Saved on the invoice and logged on the record.
export default function LetterInterestToggle({ id, checked, s }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(e) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/print/letter/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ include_interest: e.target.checked }) });
      if (!res.ok) setError(s.error);
      router.refresh();
    } catch {
      setError(s.error);
    }
    setBusy(false);
  }
  return (
    <div className="flex flex-col">
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4">
        <input type="checkbox" defaultChecked={checked} disabled={busy} onChange={change} />
        <span className="font-semibold">{s.label}</span>
      </label>
      {error && <span role="alert" className="text-error">{error}</span>}
    </div>
  );
}
