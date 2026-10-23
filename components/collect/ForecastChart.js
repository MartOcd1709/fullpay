// 13-week closing-cash bars with the safety-buffer line, drawn by hand in SVG. Server component.
// x positions are percentages and y positions pixels, so text stays its real size from 360px to a laptop.
import { t } from "@/lib/i18n";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

const H = 280;
const TOP = 18;
const BOTTOM = 40;
const STEPS_L = [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100]; // lakh

function ticks(min, max) {
  const spanL = (max - min) / 1e7;
  const step = (STEPS_L.find((s) => spanL / s <= 5) ?? 100) * 1e7;
  const out = [];
  for (let v = Math.floor(min / step) * step; v <= max + 1; v += step) out.push(v);
  return out;
}

const tickLabel = (v, lang) => {
  const l = Math.abs(v) / 1e7;
  const n = Number.isInteger(l) ? String(l) : String(Math.round(l * 100) / 100);
  return `${v < 0 ? "−" : ""}${t("collect.fc.tick", lang, { n })}`;
};

export default function ForecastChart({ weeks, buffer, firstShort, lang }) {
  const vals = weeks.map((w) => w.closing_paise);
  const lo = Math.min(0, buffer, ...vals);
  const hi = Math.max(buffer, ...vals);
  const tk = ticks(lo, hi * 1.08);
  const min = tk[0];
  const max = tk.at(-1) > hi ? tk.at(-1) : hi * 1.08;
  const plotH = H - TOP - BOTTOM;
  const y = (v) => TOP + ((max - v) / (max - min)) * plotH;
  const slot = 100 / weeks.length;
  const zero = y(0);
  const summary = t("collect.fc.chart_alt", lang, {
    n: weeks.length,
    low: fmtINR(Math.min(...vals), { paise: false }),
    buffer: fmtINR(buffer, { paise: false }),
    week: firstShort == null ? "—" : firstShort + 1,
  });

  return (
    <figure className="m-0">
      <div className="flex gap-1">
        <div className="relative w-14 shrink-0 sm:w-16" style={{ height: H }} aria-hidden="true">
          {tk.map((v) => (
            <span key={v} className="tnum absolute right-1 -translate-y-1/2 whitespace-nowrap text-xs text-ink-muted sm:text-sm" style={{ top: y(v) }}>
              {tickLabel(v, lang)}
            </span>
          ))}
          <span className="absolute bottom-0 right-1 text-xs font-semibold text-ink-muted sm:text-sm">{t("collect.fc.axis_week", lang)}</span>
        </div>
        <svg role="img" aria-label={summary} width="100%" height={H} className="min-w-0 flex-1 overflow-visible">
          <title>{summary}</title>
          <defs>
            <pattern id="fc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--error)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--error-soft)" strokeWidth="2" />
            </pattern>
          </defs>
          {tk.map((v) => (
            <line key={v} x1="0" x2="100%" y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          ))}
          <line x1="0" x2="100%" y1={zero} y2={zero} stroke="var(--ink-muted)" strokeWidth="1.5" />
          {weeks.map((w, i) => {
            const v = w.closing_paise;
            const top = Math.min(y(v), zero);
            const h = Math.max(2, Math.abs(y(v) - zero));
            const below = w.below_buffer;
            return (
              <g key={w.index}>
                <rect x={`${i * slot + slot * 0.18}%`} width={`${slot * 0.64}%`} y={top} height={h} rx="3" fill={below ? "url(#fc-hatch)" : "var(--accent)"}>
                  <title>
                    {t("collect.fc.bar_tip", lang, { n: w.index + 1, from: formatDate(w.start, lang), to: formatDate(w.end, lang), amount: fmtINR(v, { paise: false }) })}
                  </title>
                </rect>
                <text x={`${i * slot + slot / 2}%`} y={H - BOTTOM + 20} textAnchor="middle" fontSize="13" fontWeight={i === firstShort ? 700 : 400} fill={i === firstShort ? "var(--error)" : "var(--ink-muted)"}>
                  {w.index + 1}
                </text>
                {i === firstShort && (
                  <text x={`${i * slot + slot / 2}%`} y={H - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--error)">
                    ⚠
                  </text>
                )}
              </g>
            );
          })}
          <line x1="0" x2="100%" y1={y(buffer)} y2={y(buffer)} stroke="var(--warning)" strokeWidth="2" strokeDasharray="6 4" />
        </svg>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded-sm bg-accent" />
          {t("collect.fc.legend_cash", lang)}
        </span>
        <span className="inline-flex items-center gap-2">
          <svg aria-hidden="true" width="14" height="14">
            <rect width="14" height="14" rx="2" fill="url(#fc-hatch)" />
          </svg>
          {t("collect.fc.legend_below", lang)}
        </span>
        <span className="inline-flex items-center gap-2">
          <svg aria-hidden="true" width="24" height="6">
            <line x1="0" x2="24" y1="3" y2="3" stroke="var(--warning)" strokeWidth="2" strokeDasharray="6 4" />
          </svg>
          {t("collect.fc.legend_buffer", lang, { amount: fmtINR(buffer, { paise: false }) })}
        </span>
      </figcaption>
    </figure>
  );
}
