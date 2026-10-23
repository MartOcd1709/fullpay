import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Money from "@/components/ui/Money";
import { ErrorState } from "@/components/ui/States";
import { Grade } from "@/components/pages/Grade";
import { getT } from "@/components/ui/server/lang";
import { fmtINR } from "@/lib/money";
import { run } from "@/lib/services/context";
import * as analytics from "@/lib/services/analytics";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("pages.an.title") };
}

// Validated pair (dataviz validator: CVD ΔE 27.6, both ≥ 3:1 on white). Identity also carried by legend + table.
const C_BILLED = "#c56a12";
const C_COLLECTED = "#3d5cc4";

function Tile({ label, value, sub, hint }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4" title={hint}>
      <p className="font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tnum">{value}</p>
      {sub && <p className="mt-1 text-ink-muted">{sub}</p>}
    </div>
  );
}

const pct = (n) => (n == null ? "—" : `${n}%`);

export default async function AnalyticsPage() {
  const T = await getT();
  let d;
  try {
    d = await run((c, ctx) => analytics.overview(c, ctx));
  } catch (err) {
    console.error("[analytics]", err);
    return (
      <>
        <PageHeader title={T("pages.an.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/analytics" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const loc = T.lang === "hi" ? "hi-IN" : "en-IN";
  const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString(loc, { month: "short", timeZone: "UTC" });
  const cur = d.months.at(-1);
  const full = d.months.slice(0, -1);
  const last = full.at(-1);
  const prev3 = full.at(-4) ?? full[0];
  const dsoDelta = cur?.dso_days != null && prev3?.dso_days != null ? cur.dso_days - prev3.dso_days : null;
  const max = Math.max(1, ...d.months.flatMap((m) => [m.billed_paise, m.collected_paise]));
  const lakh = (p) => fmtINR(p, { paise: false });

  return (
    <>
      <PageHeader title={T("pages.an.title")} subtitle={T("pages.an.intro", { date: T.date(d.as_of) })} />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={T("pages.an.kpis")}>
        <Tile label={T("pages.an.dso")} hint={T("pages.an.dso_hint")}
          value={cur?.dso_days == null ? "—" : T("pages.an.days", { n: cur.dso_days })}
          sub={dsoDelta == null ? null : T(dsoDelta > 0 ? "pages.an.dso_up" : "pages.an.dso_down", { n: Math.abs(dsoDelta), month: monthName(prev3.month) })} />
        <Tile label={T("pages.an.cei")} hint={T("pages.an.cei_hint")} value={pct(last?.cei_pct)} sub={last ? T("pages.an.in_month", { month: monthName(last.month) }) : null} />
        <Tile label={T("pages.an.on_time")} hint={T("pages.an.on_time_hint")} value={pct(last?.on_time_pct)} sub={last ? T("pages.an.in_month", { month: monthName(last.month) }) : null} />
        <Tile label={T("pages.an.recovered")} hint={T("pages.an.recovered_hint")} value={<Money paise={d.recovered.paise} />}
          sub={T("pages.an.recovered_sub", { n: d.recovered.invoices })} />
      </section>

      <section className="mb-6 rounded-xl border border-line bg-surface p-4" aria-labelledby="an-chart-h">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="an-chart-h" className="text-lg font-bold">{T("pages.an.chart_h")}</h2>
          <ul className="flex gap-4 text-sm" aria-label={T("pages.an.legend")}>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: C_BILLED }} />{T("pages.an.billed")}</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ background: C_COLLECTED }} />{T("pages.an.collected")}</li>
          </ul>
        </div>
        <div className="mt-4 grid grid-cols-6 items-end gap-2 border-b border-line" style={{ height: "12rem" }} aria-hidden="true">
          {d.months.map((m) => (
            <div key={m.month} className="flex h-full items-end justify-center gap-[2px]">
              {[[m.billed_paise, C_BILLED, "pages.an.billed"], [m.collected_paise, C_COLLECTED, "pages.an.collected"]].map(([v, col, k]) => (
                <div key={k} title={`${monthName(m.month)} · ${T(k)}: ${lakh(v)}`}
                  className="w-1/3 max-w-8 rounded-t-[4px] hover:opacity-80"
                  style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%`, background: col }} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-6 gap-2 text-center text-sm text-ink-muted" aria-hidden="true">
          {d.months.map((m, i) => <span key={m.month}>{monthName(m.month)}{i === d.months.length - 1 ? ` ${T("pages.an.so_far")}` : ""}</span>)}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-accent">{T("pages.an.table")}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="text-sm text-ink-muted">
                <tr>{["month", "billed", "collected", "receivable", "dso", "cei", "on_time"].map((k) => <th key={k} scope="col" className="px-2 py-2">{T(`pages.an.col.${k}`)}</th>)}</tr>
              </thead>
              <tbody>
                {d.months.map((m) => (
                  <tr key={m.month} className="border-t border-line tnum">
                    <th scope="row" className="px-2 py-2 font-semibold">{monthName(m.month)} {m.month.slice(0, 4)}</th>
                    <td className="px-2 py-2"><Money paise={m.billed_paise} /></td>
                    <td className="px-2 py-2"><Money paise={m.collected_paise} /></td>
                    <td className="px-2 py-2"><Money paise={m.receivable_paise} /></td>
                    <td className="px-2 py-2">{m.dso_days ?? "—"}</td>
                    <td className="px-2 py-2">{pct(m.cei_pct)}</td>
                    <td className="px-2 py-2">{pct(m.on_time_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="mb-3 text-lg font-bold">{T("pages.an.risk_h")}</h2>
          {d.at_risk.length === 0 ? <p className="text-ink-muted">{T("pages.an.risk_none")}</p> : (
            <ul className="grid gap-2">
              {d.at_risk.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
                  <Grade grade={c.grade} T={T} />
                  <Link href={`/customers/${c.id}`} className="min-w-[10rem] flex-1 font-semibold">{c.name}</Link>
                  <Money paise={c.total_owed_paise} className="font-bold" />
                  <p className="w-full text-ink-muted">{T("pages.an.risk_line", { pct: Math.round(c.pct_on_time ?? 0), days: Math.round(c.avg_late_days ?? 0) })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">{T("pages.an.promises_h")}</h2>
          <dl className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface p-3 text-center">
            {["kept", "broken", "open"].map((k) => (
              <div key={k}><dt className="text-ink-muted">{T(`pages.an.prom.${k}`)}</dt><dd className="text-2xl font-bold tnum">{d.promises[k]}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-ink-muted">{T("pages.an.method")}</p>
        </div>
      </section>
    </>
  );
}
