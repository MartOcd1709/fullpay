"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import Sheet from "./Sheet";

const short = (h) => (h ? `${h.slice(0, 4)}…${h.slice(-4)}` : "");

// The invoice's record, newest first (K14, K15). Every row is a sealed entry in the hash chain; tap its stamp to see the
// full hash, the entry it links to, and a QR for the public verify page. Future rungs show as hollow milestones.
// All text arrives already translated from the server (model built by components/ui/server/timeline.js).
export function Timeline({ model }) {
  const { events = [], future = [], next, pause, chain, labels } = model;
  const [open, setOpen] = useState(null);
  return (
    <section aria-label={labels.title}>
      <ChainStrip chain={chain} labels={labels} />
      {next && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-3 font-medium text-info">
          <Icon name="clock" className="mt-0.5 h-5 w-5" />
          <span>{next}</span>
        </p>
      )}
      <ol className="mt-4">
        {future.map((f) => (
          <li key={f.rung} className="relative flex gap-3 pb-5">
            <Rail />
            <span aria-hidden="true" className="relative z-10 mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-ink-muted bg-surface" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-muted">
                <span className="sr-only">{labels.upcoming}: </span>
                {f.title}
              </p>
              <p className="text-ink-muted">{f.when}</p>
            </div>
          </li>
        ))}
        {pause && (
          <li className="relative flex gap-3 pb-5">
            <span aria-hidden="true" className="relative z-10 ml-[0.4rem] w-2 shrink-0 rounded bg-[repeating-linear-gradient(45deg,var(--info)_0_4px,transparent_4px_8px)]" />
            <div className="min-w-0 flex-1 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-info">
              <p className="font-semibold">{pause.title}</p>
              {pause.detail && <p>{pause.detail}</p>}
              {pause.href && (
                <Link href={pause.href} className="mt-1 inline-flex min-h-12 items-center font-semibold text-info underline">
                  {pause.hrefLabel}
                </Link>
              )}
            </div>
          </li>
        )}
        {events.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-5">
            {i < events.length - 1 && <Rail />}
            <span
              aria-hidden="true"
              className={`relative z-10 mt-1 flex shrink-0 items-center justify-center rounded-full ${e.milestone ? "h-5 w-5 bg-accent text-on-accent" : "ml-1 h-3 w-3 bg-ink-muted"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold">
                  <Icon name={e.icon} className="mr-1.5 inline h-[1.125rem] w-[1.125rem] align-[-0.2em] text-ink-muted" />
                  {e.title}
                </p>
                <p className="text-ink-muted">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-sm font-semibold">{e.actor}</span> {e.when}
                </p>
              </div>
              {e.detail && <p className="mt-0.5 text-ink-muted" lang={e.detailLang}>{e.detail}</p>}
              <button
                type="button"
                onClick={() => setOpen(e)}
                className="mono -ml-2 mt-1 inline-flex min-h-12 items-center gap-1 rounded-xl px-2 text-sm text-accent hover:bg-accent-soft"
                aria-label={`${labels.stamp} ${short(e.hash)}: ${labels.open_stamp}`}
              >
                <Icon name="hash" className="h-4 w-4" />
                {short(e.hash)}
                <Icon name="chevron" className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!events.length && <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-ink-muted">{labels.empty}</p>}
      <HashSheet entry={open} onClose={() => setOpen(null)} labels={labels} />
    </section>
  );
}

function Rail() {
  return <span aria-hidden="true" className="absolute bottom-0 left-[0.6rem] top-6 w-0.5 bg-line" />;
}

function ChainStrip({ chain, labels }) {
  if (!chain) return null;
  const ok = chain.ok;
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 font-semibold ${ok ? "border-success/30 bg-success-soft text-success" : "border-error/40 bg-error-soft text-error"}`}
    >
      <Icon name={ok ? "shieldCheck" : "shieldAlert"} className="h-5 w-5" />
      <span>{chain.text}</span>
      {chain.verifyHref && (
        <Link href={chain.verifyHref} className="ml-auto inline-flex min-h-12 items-center gap-1 underline">
          {labels.verify_page}
          <Icon name="external" className="h-4 w-4" />
        </Link>
      )}
    </p>
  );
}

function HashSheet({ entry, onClose, labels }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const href = entry ? `/verify/${entry.hash}` : "";
  useEffect(() => {
    setCopied(false);
    setQr("");
    if (!entry) return;
    let live = true;
    import("qrcode")
      .then((m) => (m.default ?? m).toString(`${window.location.origin}${href}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }))
      .then((svg) => live && setQr(svg))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [entry, href]);
  return (
    <Sheet open={!!entry} onClose={onClose} title={labels.stamp} closeLabel={labels.close}>
      {entry && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">{entry.title}</p>
            <p className="text-ink-muted">{entry.when}</p>
          </div>
          <div>
            <p className="font-semibold">{labels.full_hash}</p>
            <p className="mono mt-1 rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed">
              {entry.hash.slice(0, 32)}
              <br />
              {entry.hash.slice(32)}
            </p>
            <button
              type="button"
              className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 font-semibold hover:bg-surface-2"
              onClick={() => navigator.clipboard?.writeText(entry.hash).then(() => setCopied(true), () => {})}
            >
              <Icon name="copy" className="h-5 w-5" />
              {copied ? labels.copied : labels.copy}
            </button>
          </div>
          <p>
            {labels.links_to} <span className="mono">#{short(entry.prevHash)}</span> {labels.links_to_after}
          </p>
          <p className="text-ink-muted">{labels.stamp_explain}</p>
          {qr ? (
            <div className="mx-auto w-44 rounded-xl border border-line bg-white p-2" role="img" aria-label={labels.qr_label} dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="skeleton mx-auto h-44 w-44" aria-hidden="true" />
          )}
          <Link href={href} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-on-accent no-underline hover:bg-accent-strong">
            {labels.verify_page}
            <Icon name="external" className="h-5 w-5" />
          </Link>
        </div>
      )}
    </Sheet>
  );
}

export default Timeline;
