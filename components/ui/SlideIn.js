"use client";

import { useEffect, useRef, useState } from "react";

// Reveals its children with a fade + slight slide once they scroll into view. Plain IntersectionObserver —
// no animation library. If IntersectionObserver isn't available, or this never hydrates (slow/failed JS), the
// <noscript> rule in app/layout.js is the fallback that forces content visible, so nothing is JS-gated.
// direction: "up" (default), "left" or "right". delay: ms, for staggering a list of these.
export default function SlideIn({ children, className = "", direction = "up", delay = 0, as: As = "div", ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const dirClass = direction === "left" ? "slide-in-left" : direction === "right" ? "slide-in-right" : "";
  return (
    <As
      ref={ref}
      className={`slide-in ${dirClass} ${visible ? "slide-in-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </As>
  );
}
