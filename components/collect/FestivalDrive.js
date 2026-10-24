"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import Money from "@/components/ui/Money";
import Icon from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

// The settlement drive before a festival: a card, then a sheet to review who gets the warm message and send it.
export function FestivalDrive({ lang, view, role }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const ready = view.customers.filter((c) => c.state === "ready");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set(ready.map((c) => c.id)));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(lang === "hi" && view.previews?.hi ? "hi" : "en");
  const name = T(`festival.${view.drive.key}.name`);
  const eve = T(`festival.${view.drive.key}.eve`);
  const total = ready.filter((c) => picked.has(c.id)).reduce((a, c) => a + c.owed_paise, 0);
  async function send() {
    setBusy(true);
    try {
      const r = await api("/api/festival", { body: { customer_ids: [...picked] } });
      await api("/api/outbox/flush", { body: {} }).catch(() => null);
      toast(T("pages.fest.sent", { e: r.emailed, w: r.whatsapp }));
      setOpen(false);
      router.refresh();
    } catch (x) {
      toast(x.message, "error");
    } finally {
      setBusy(false);
    }
  }
  const sentAlready = view.customers.filter((c) => c.state === "sent").length;
  return (
    <section aria-labelledby="fest-h" className="mb-6 rounded-xl border border-warning/40 bg-warning-soft p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="rounded-full bg-surface p-2 text-warning"><Icon name="sparkle" className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="fest-h" className="text-lg font-bold">{T("pages.fest.title", { name, days: view.drive.days_left, date: T.date(view.drive.date) })}</h2>
          <p className="mt-1">{ready.length ? T("pages.fest.body", { eve, n: ready.length }) : T("pages.fest.done", { n: sentAlready })}</p>
          {ready.length > 0 && <p className="mt-1 font-semibold">{T("pages.fest.owed")} <Money paise={view.owed_paise} /></p>}
        </div>
        {ready.length > 0 && role !== "viewer" && <Button onClick={() => setOpen(true)}>{T("pages.fest.review")}</Button>}
      </div>
      <Sheet wide open={open} onClose={() => setOpen(false)} title={T("pages.fest.sheet_title", { name })} closeLabel={T("pages.cust.cancel")}>
        <div className="grid gap-4">
          <p className="text-ink-muted">{T("pages.fest.sheet_intro", { eve, date: T.date(view.drive.settle_by) })}</p>
          <ul className="grid gap-2">
            {view.customers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2">
                <input type="checkbox" className="h-5 w-5" aria-label={c.name} disabled={c.state !== "ready"} checked={picked.has(c.id)}
                  onChange={() => setPicked((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                <span className="min-w-[10rem] flex-1 font-semibold">{c.name}</span>
                <span className="text-sm text-ink-muted">{T(`app.lang_${c.lang}`)} · {T(`pages.fest.ch.${c.channel}`)}</span>
                <Money paise={c.owed_paise} className="font-semibold" />
                {c.state !== "ready" && <span className="w-full text-sm text-ink-muted">{T(`pages.fest.state.${c.state}`)}</span>}
              </li>
            ))}
          </ul>
          {view.previews && (
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{T("pages.fest.preview")}</span>
                {["en", "hi"].filter((l) => view.previews[l]).map((l) => (
                  <button key={l} type="button" aria-pressed={tab === l} onClick={() => setTab(l)}
                    className={`min-h-10 rounded-full px-3 text-sm font-semibold ${tab === l ? "bg-accent text-on-accent" : "border border-line"}`}>{T(`app.lang_${l}`)}</button>
                ))}
              </div>
              <p className="font-semibold" lang={tab}>{view.previews[tab]?.subject}</p>
              <pre lang={tab} translate="no" className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{view.previews[tab]?.body}</pre>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || !picked.size} onClick={send}>{T("pages.fest.send", { n: picked.size })}</Button>
            <span className="text-ink-muted"><Money paise={total} /></span>
          </div>
          <p className="text-sm text-ink-muted">{T("pages.fest.rules")}</p>
        </div>
      </Sheet>
    </section>
  );
}

export function QuietBanner({ lang, quiet }) {
  const T = makeT(lang);
  return (
    <p role="note" className="mb-6 rounded-xl border border-info/40 bg-info-soft p-3">
      <strong>{quiet.label ?? T(`festival.${quiet.key}.name`)}: {T("pages.fest.quiet")}</strong> {T("pages.fest.quiet_until", { date: T.date(quiet.resumes) })}
    </p>
  );
}
