"use client";

import { useEffect, useState } from "react";

// toast("Saved") from anywhere; one polite live region announces it without moving focus (WCAG 4.1.3).
export function toast(message, tone = "success") {
  window.dispatchEvent(new CustomEvent("fullpay:toast", { detail: { message, tone, id: Math.random() } }));
}

const STYLE = { success: "bg-success text-on-accent", error: "bg-error text-on-accent", info: "bg-ink text-on-accent" };

export function ToastRegion() {
  const [item, setItem] = useState(null);
  useEffect(() => {
    let timer;
    const on = (e) => {
      setItem(e.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setItem(null), 5000);
    };
    window.addEventListener("fullpay:toast", on);
    return () => {
      window.removeEventListener("fullpay:toast", on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
      {item && (
        <p key={item.id} className={`toast-enter pointer-events-auto max-w-md rounded-xl px-4 py-3 font-semibold shadow-lg ${STYLE[item.tone] ?? STYLE.info}`}>
          {item.message}
        </p>
      )}
    </div>
  );
}

export default ToastRegion;
