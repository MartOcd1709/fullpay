"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";

// Bottom sheet on phones, side panel on laptops, built on the native <dialog> (focus trap, Esc, inert page for free).
export function Sheet({ open, onClose, title, children, footer, closeLabel = "Close", wide = false }) {
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
      className={wide ? "sheet sheet-wide" : "sheet"}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose?.()}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col sm:h-full sm:max-h-none">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
            <h2 id="sheet-title" className="text-lg font-semibold leading-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface-2">
              <Icon name="close" className="h-6 w-6" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer && <footer className="flex flex-wrap gap-3 border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export default Sheet;
