"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { makeT } from "@/components/ui/i18n";

const KEY = "fullpay.tour";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

// A 2-minute guided story over the real screens (demo only). Progress lives in this browser only.
export default function DemoTour({ lang, links, role }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const path = usePathname();
  const [step, setStep] = useState(null);
  useEffect(() => {
    const v = read();
    setStep(v === "off" ? null : Number.isInteger(Number(v)) && v !== null ? Number(v) : 0);
    const open = () => { write("0"); setStep(0); };
    window.addEventListener("fullpay:tour", open);
    return () => window.removeEventListener("fullpay:tour", open);
  }, []);
  const STEPS = [
    { k: "dash", href: "/dashboard" },
    { k: "follow", href: "/followups" },
    { k: "pay", href: links?.pay_token ? `/pay/${links.pay_token}` : null, tab: true },
    { k: "bank", href: "/payments" },
    { k: "maker", as: "accountant", next: "/payments" },
    { k: "approve", as: "owner", next: "/approvals" },
    { k: "verify", href: links?.verify_prefix ? `/v/${links.verify_prefix}` : null, tab: true },
    { k: "analytics", href: "/analytics" },
    { k: "import", href: "/invoices" },
    { k: "end" },
  ];
  if (step == null || step >= STEPS.length) return null;
  const s = STEPS[step];
  const go = (n) => { const v = Math.max(0, Math.min(STEPS.length - 1, n)); write(String(v)); setStep(v); };
  const close = () => { write("off"); setStep(null); };
  const btn = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold no-underline";
  const here = s.href && path === s.href;
  return (
    <aside aria-label={T("pages.tour.label")}
      className="fixed right-3 z-40 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-accent/40 bg-surface p-4 shadow-xl print:hidden"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-accent">{T("pages.tour.step", { n: step + 1, of: STEPS.length })}</p>
        <button type="button" onClick={close} className="min-h-10 rounded-lg px-2 text-sm text-ink-muted hover:bg-surface-2">{T("pages.tour.hide")}</button>
      </div>
      <h2 className="mt-1 text-lg font-bold leading-snug">{T(`pages.tour.${s.k}.title`)}</h2>
      <p className="mt-1 text-ink-muted">{T(`pages.tour.${s.k}.body`)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {step > 0 && <button type="button" onClick={() => go(step - 1)} className={`${btn} border border-line hover:bg-surface-2`}>{T("pages.tour.back")}</button>}
        {s.as && role !== s.as ? (
          <form method="post" action="/api/auth/demo" onSubmit={() => write(String(step + 1))}>
            <input type="hidden" name="as" value={s.as} />
            <input type="hidden" name="next" value={s.next} />
            <button type="submit" className={`${btn} bg-accent text-on-accent hover:bg-accent-strong`}>{T(`pages.tour.${s.k}.cta`)}</button>
          </form>
        ) : s.href && !here ? (
          <Link href={s.href} target={s.tab ? "_blank" : undefined} onClick={() => { if (!s.tab) write(String(step)); }}
            className={`${btn} bg-accent text-on-accent hover:bg-accent-strong`}>
            {T(s.tab ? "pages.tour.open_tab" : "pages.tour.go")}
          </Link>
        ) : null}
        {step < STEPS.length - 1
          ? <button type="button" onClick={() => go(step + 1)} className={`${btn} border border-line hover:bg-surface-2`}>{T("pages.tour.next")}</button>
          : <button type="button" onClick={close} className={`${btn} border border-line hover:bg-surface-2`}>{T("pages.tour.done")}</button>}
      </div>
    </aside>
  );
}

export function TourButton({ label }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("fullpay:tour"))}
      className="hidden min-h-10 rounded-full border border-accent/40 px-3 text-sm font-semibold text-accent hover:bg-accent-soft md:inline-flex md:items-center">
      {label}
    </button>
  );
}
