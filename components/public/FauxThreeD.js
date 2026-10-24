import Icon from "./Icon";

// Faux-3D card stack: pure CSS perspective + transforms, no animation library and no JS at all (this file ships
// zero extra client bytes — it's a plain server component). Visualises the invoice -> reminder -> paid ladder that
// the surrounding copy describes; purely decorative, so it's aria-hidden and the real content lives in the prose.
const CARDS = [
  { icon: "clock", key: "flow_sent", tone: "info" },
  { icon: "bell", key: "flow_reminded", tone: "warning" },
  { icon: "check", key: "flow_paid", tone: "success" },
];

const CSS = `
.ftd-stage {
  position: relative;
  width: 100%;
  max-width: 22rem;
  margin: 0 auto;
  aspect-ratio: 4 / 3;
  perspective: 1200px;
  overflow: hidden;
}
.ftd-scene {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}
.ftd-card {
  --tx: 0%;
  --ty: 0%;
  --tz: 0px;
  --rz: 0deg;
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(80%, 15rem);
  height: 5.5rem;
  margin: -2.75rem 0 0 max(-40%, -7.5rem);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1.25rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: 0 1.5rem 2.5rem -0.75rem rgb(15 20 31 / 0.35);
  font-weight: 600;
  transform: translate3d(var(--tx), var(--ty), var(--tz)) rotateZ(var(--rz));
  animation: ftd-float 7s ease-in-out infinite;
}
.ftd-card-1 { --tx: -14%; --ty: -18%; --tz: -70px; --rz: -7deg; z-index: 1; opacity: 0.75; animation-delay: 0s; }
.ftd-card-2 { --tx: 0%;   --ty: 0%;   --tz: 0px;   --rz: 2deg;  z-index: 2; animation-delay: 0.6s; }
.ftd-card-3 { --tx: 14%;  --ty: 18%;  --tz: 70px;  --rz: 9deg;  z-index: 3; animation-delay: 1.2s; }
.ftd-chip {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}
.ftd-tone-info .ftd-chip { background: var(--info-soft); color: var(--info); }
.ftd-tone-warning .ftd-chip { background: var(--warning-soft); color: var(--warning); }
.ftd-tone-success .ftd-chip { background: var(--success-soft); color: var(--success); }
@keyframes ftd-float {
  0%, 100% { transform: translate3d(var(--tx), var(--ty), var(--tz)) rotateZ(var(--rz)) translateY(0); }
  50%      { transform: translate3d(var(--tx), var(--ty), var(--tz)) rotateZ(var(--rz)) translateY(-0.5rem); }
}
/* Belt-and-suspenders: the site already disables all animation under this media query, but this component
   should still be correct and self-contained if it's ever reused somewhere without that global rule. */
@media (prefers-reduced-motion: reduce) {
  .ftd-card { animation: none; }
}
`;

export default function FauxThreeD({ t }) {
  return (
    <div className="ftd-stage" aria-hidden="true">
      <style>{CSS}</style>
      <div className="ftd-scene">
        {CARDS.map((c, i) => (
          <div key={c.key} className={`ftd-card ftd-card-${i + 1} ftd-tone-${c.tone}`}>
            <span className="ftd-chip"><Icon name={c.icon} className="h-5 w-5" /></span>
            <span>{t(`public.landing.${c.key}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
