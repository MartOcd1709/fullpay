"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Money from "@/components/ui/Money";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

const when = (ts, lang) =>
  new Date(ts).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

// The owner's queue: decide one, or tick several and approve together. Accountants see the same list read-only.
export function ApprovalQueue({ lang, rows, canDecide, myUid }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const decidable = rows.filter((r) => canDecide && r.requested_by !== myUid);

  async function decide(ids, approve) {
    setBusy(true);
    try {
      const list = ids.length === 1
        ? [(await api(`/api/approvals/${ids[0]}`, { body: { approve } })).approval]
        : (await api("/api/approvals/bulk", { body: { ids, approve } })).results;
      const failed = list.filter((r) => r.status === "failed" || r.status === "skipped").length;
      toast(failed ? T("pages.appr.some_failed", { n: failed }) : approve ? T("pages.appr.approved", { n: ids.length }) : T("pages.appr.rejected", { n: ids.length }), failed ? "error" : "success");
      setPicked(new Set());
      router.refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const total = rows.filter((r) => picked.has(r.id)).reduce((a, r) => a + (r.amount_paise ?? 0), 0);

  return (
    <div className="grid gap-3">
      {decidable.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <label className="inline-flex min-h-12 items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5"
              checked={picked.size === decidable.length}
              onChange={(e) => setPicked(e.target.checked ? new Set(decidable.map((r) => r.id)) : new Set())} />
            {T("pages.appr.select_all", { n: decidable.length })}
          </label>
          {picked.size > 0 && (
            <>
              <span className="text-ink-muted">{T("pages.appr.selected", { n: picked.size })} · <Money paise={total} /></span>
              <Button disabled={busy} onClick={() => decide([...picked], true)}>{T("pages.appr.approve_n", { n: picked.size })}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => decide([...picked], false)}>{T("pages.appr.reject")}</Button>
            </>
          )}
        </div>
      )}
      <ul className="grid gap-3" aria-label={T("pages.appr.title")}>
        {rows.map((r) => {
          const mine = r.requested_by === myUid;
          const can = canDecide && !mine;
          return (
            <li key={r.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-4">
              {can && decidable.length > 1 && (
                <input type="checkbox" className="mt-1 h-5 w-5" aria-label={r.summary} checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold" lang="en">{r.summary}</p>{/* the stored record of what was prepared, in English; the type below is translated */}
                <p className="mt-1 text-ink-muted">
                  {T(`pages.appr.kind.${r.kind}`)} · {T("pages.appr.by", { name: r.requested_by_name ?? "—" })} · {when(r.created_at, lang)}
                </p>
              </div>
              {r.amount_paise != null && <Money paise={r.amount_paise} className="font-bold" />}
              {can ? (
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button disabled={busy} onClick={() => decide([r.id], true)}>{T("pages.appr.approve")}</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => decide([r.id], false)}>{T("pages.appr.reject")}</Button>
                </div>
              ) : (
                <span className="w-full text-ink-muted sm:w-auto">{mine && canDecide ? T("pages.appr.own") : T("pages.appr.waiting")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ApprovalQueue;
