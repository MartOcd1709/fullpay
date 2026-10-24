"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const YEAR = 60 * 60 * 24 * 365;

// Light/dark switch: cookie-only, no business config (this is a personal display preference, not a business setting).
// Thumb position and icon (sun/moon) are pure CSS (see .theme-toggle-* rules in globals.css), so the slide is always
// correct even before hydration — this component's own state is only for aria-checked and the hover/press feel.
export default function ThemeToggle({ label = "Toggle colour theme" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(undefined); // unknown until mounted: avoids a hydration mismatch with the system default

  useEffect(() => {
    setDark(getComputedStyle(document.documentElement).colorScheme === "dark");
  }, []);

  function toggle() {
    if (busy) return;
    setBusy(true);
    const isDark = getComputedStyle(document.documentElement).colorScheme === "dark";
    document.cookie = `theme=${isDark ? "light" : "dark"}; path=/; max-age=${YEAR}; samesite=lax`;
    setDark(!isDark);
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      aria-label={label}
      title={label}
      className="theme-toggle inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl hover:bg-surface-2"
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="icon-sun" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="icon-moon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
