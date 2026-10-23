"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";

// K3: everyone shares one demo world. Say so, show the demo date, and let a visitor move it or start over.
export default function DemoBanner({ labels, date, minutes }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [recent, setRecent] = useState(false);

  async function advance() {
    setBusy("advance");
    try {
      await api("/api/demo/advance", { body: { days: 1 } });
      toast(labels.advanced);
      router.refresh();
    } catch (e) {
      toast(e.code === "network" ? labels.network : e.message, "error");
    }
    setBusy(null);
  }

  async function reset(force) {
    setBusy("reset");
    try {
      await api("/api/demo/reset", { body: force ? { confirm: true } : {} });
      setConfirm(false);
      setRecent(false);
      toast(labels.reset_done);
      router.refresh();
    } catch (e) {
      if (e.code === "recently_reset") setRecent(true);
      else toast(e.code === "network" ? labels.network : e.message, "error");
    }
    setBusy(null);
  }

  return (
    <div className="border-b border-warning/30 bg-warning-soft text-ink print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1 sm:px-6">
        <p className="flex min-h-12 flex-1 basis-56 items-center gap-2 font-medium">
          <Icon name="calendar" className="h-5 w-5 text-warning" />
          <span>
            <strong>{labels.shared}</strong> · {labels.date} <strong className="tnum">{date}</strong>
            {minutes != null && <span className="text-ink-muted"> · {labels.reset_ago}</span>}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={advance} disabled={!!busy} className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-line bg-surface px-3 font-semibold hover:bg-surface-2 disabled:opacity-60">
            <Icon name="plus" className="h-4 w-4" />
            {busy === "advance" ? labels.working : labels.plus_day}
          </button>
          <Link href="/settings#demo" className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-accent no-underline hover:bg-accent-soft">
            {labels.more}
          </Link>
          <button type="button" onClick={() => setConfirm(true)} disabled={!!busy} className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-error hover:bg-error-soft disabled:opacity-60">
            {labels.reset}
          </button>
        </div>
      </div>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={labels.reset_title}
        closeLabel={labels.close}
        footer={
          <>
            <button type="button" onClick={() => reset(recent)} disabled={busy === "reset"} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-error px-5 font-semibold text-on-accent disabled:opacity-60">
              {busy === "reset" ? labels.resetting : recent ? labels.reset_anyway : labels.reset}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-line px-5 font-semibold">
              {labels.cancel}
            </button>
          </>
        }
      >
        <p>{labels.reset_body}</p>
        {recent && <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 font-medium text-warning">{labels.reset_recent}</p>}
      </Sheet>
    </div>
  );
}
