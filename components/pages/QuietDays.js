"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

// Festival calendar: the built-in festivals (read only) and the owner's own quiet days, when no reminders go out.
export default function QuietDays({ lang, festivals, quietDays }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [days, setDays] = useState(quietDays ?? []);
  const [draft, setDraft] = useState({ from: "", to: "", label: "" });
  const [busy, setBusy] = useState(false);
  async function save(next) {
    setBusy(true);
    try {
      const r = await api("/api/settings", { method: "PATCH", body: { calendar: { quiet_days: next } } });
      setDays(next);
      toast(r?.approval_pending ? T("pages.appr.sent") : T("settings.saved"));
      router.refresh();
    } catch (x) { toast(x.message, "error"); }
    finally { setBusy(false); }
  }
  const add = () => { if (!draft.from) return; save([...days, { from: draft.from, to: draft.to || draft.from, label: draft.label.trim() || null }]); setDraft({ from: "", to: "", label: "" }); };
  return (
    <div className="grid gap-3">
      <p className="text-ink-muted">{T("pages.quiet.intro")}</p>
      <ul className="grid gap-2">
        {festivals.map((f) => (
          <li key={f.key} className="rounded-lg border border-line p-3">
            <strong>{T(`festival.${f.key}.name`)}</strong> · {T.date(f.date)}
            <span className="block text-sm text-ink-muted">{T("pages.quiet.festival_line", { from: T.date(f.quiet_from), to: T.date(f.quiet_to), days: f.drive_days ?? 15 })}</span>
          </li>
        ))}
        {days.map((d, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
            <span className="min-w-0 flex-1"><strong>{d.label ?? T("pages.quiet.unnamed")}</strong> · {T.date(d.from)}{d.to && d.to !== d.from ? ` – ${T.date(d.to)}` : ""}</span>
            <Button variant="secondary" disabled={busy} onClick={() => save(days.filter((_, j) => j !== i))}>{T("pages.quiet.remove")}</Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <label className="grid gap-1"><span className="font-semibold">{T("pages.quiet.from")}</span><input type="date" className="field" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
        <label className="grid gap-1"><span className="font-semibold">{T("pages.quiet.to")}</span><input type="date" className="field" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
        <label className="grid gap-1"><span className="font-semibold">{T("pages.quiet.label")}</span><input className="field" maxLength={40} placeholder={T("pages.quiet.placeholder")} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
        <Button disabled={busy || !draft.from} onClick={add}>{T("pages.quiet.add")}</Button>
      </div>
    </div>
  );
}
