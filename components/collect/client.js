"use client";
// Client helpers for the collections screens: tap-to-open term popovers, a POST helper with the error contract,
// a native <dialog> sheet, and an announced status line.
import { useEffect, useRef, useState } from "react";
import UiTerm from "@/components/ui/Term";
import { useRouter } from "next/navigation";
import { t, tHint } from "@/lib/i18n";
import en from "@/lib/i18n/en.json";

export const tr = (lang) => (key, vars) => t(key, lang, vars);

// Plain word with the accounting term one tap away (not hover-only): the shared kit's Term fed from i18n label/hint.
export function Term({ k, lang, label, hint, meaning, className = "" }) {
  return <UiTerm label={label ?? t(k, lang)} term={hint ?? tHint(k, lang)} meaning={meaning} more={t("collect.term_what", lang)} className={className} />;
}

export function errorText(lang, error) {
  const key = `collect.err.${error?.code}`;
  if (error?.code && en[key]) return t(key, lang);
  return error?.message || t("error.generic", lang);
}

// POST JSON, then refresh the server-rendered page. Returns { ok, data, error }.
export function useAction(lang) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { tone: 'success'|'error', text }
  async function call(url, body, { success, refresh = true } = {}) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const text = errorText(lang, data.error);
        setMsg({ tone: "error", text });
        return { ok: false, error: data.error ?? { code: "http_" + res.status, message: text } };
      }
      if (success) setMsg({ tone: "success", text: typeof success === "function" ? success(data) : success });
      if (refresh) router.refresh();
      return { ok: true, data };
    } catch {
      const text = t("error.network", lang);
      setMsg({ tone: "error", text });
      return { ok: false, error: { code: "network", message: text } };
    } finally {
      setBusy(false);
    }
  }
  return { call, busy, msg, setMsg };
}

export function StatusLine({ msg }) {
  return (
    <p role="status" aria-live="polite" className={`min-h-0 ${msg ? "mt-3 rounded-lg px-3 py-2 font-semibold" : ""} ${msg?.tone === "error" ? "bg-error-soft text-error" : msg ? "bg-success-soft text-success" : ""}`}>
      {msg?.text}
    </p>
  );
}

// Native modal dialog: focus trap, Esc to close and inert background come from the browser.
export function Sheet({ open, onClose, title, children, lang }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 -mt-2 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label={t("collect.close", lang)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

export const BTN = {
  base: "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  danger: "bg-error text-on-accent hover:opacity-90",
  ghost: "text-accent hover:bg-accent-soft",
};
export const btn = (variant = "primary", extra = "") => `${BTN.base} ${BTN[variant]} ${extra}`;

// Rupees typed by the owner -> integer paise (null if invalid). Accepts "1,18,000.50".
export function toPaise(text) {
  const s = String(text ?? "").replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [r, p = ""] = s.split(".");
  const v = Number(r) * 100 + Number((p + "00").slice(0, 2));
  return Number.isSafeInteger(v) && v > 0 ? v : null;
}
