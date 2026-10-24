"use client";

import { useEffect, useRef } from "react";
import Logo from "@/components/ui/Logo";

// Mouse-move parallax on the brand mark. The float animation (CSS, .hero-float) and this parallax each own a
// separate nested element: a CSS animation on `transform` beats an inline style on the same property/element
// (animations sit above normal author rules, including inline, in the cascade), so writing both to one node
// would make the float fight and win every frame instead of the two effects composing.
export default function HeroVisual({ className = "" }) {
  const wrapRef = useRef(null);
  const markRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const mark = markRef.current;
    if (!wrap || !mark) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = requestAnimationFrame(tick);

    function onMove(e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const r = wrap.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / r.width - 0.5) * 18;
      targetY = ((e.clientY - r.top) / r.height - 0.5) * 18;
    }
    function onLeave() {
      targetX = 0;
      targetY = 0;
    }
    function tick() {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      mark.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    }

    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    return () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative flex items-center justify-center ${className}`}>
      <div className="hero-float">
        <div ref={markRef} className="will-change-transform">
          <Logo variant="mark" className="hero-mark h-48 w-48 sm:h-56 sm:w-56 lg:h-72 lg:w-72" alt="" />
        </div>
      </div>
    </div>
  );
}
