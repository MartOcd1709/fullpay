import Link from "next/link";
import Shell from "@/components/public/Shell";
import { getLang, tr, inr, day } from "@/components/public/lang";
import { computeInterest, conventionFootnote } from "@/lib/interest";
import { rupeesToPaise } from "@/lib/money";
import { isISODate, addDays } from "@/lib/time";
import { run } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const T = tr(await getLang());
  return { title: T("calc.title") };
}

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

// Public MSMED Act s.16 interest calculator: the same engine as the letters, with the RBI Bank Rate as it changed.
export default async function Calculator({ searchParams }) {
  const lang = await getLang();
  const T = tr(lang);
  const sp = await searchParams;
  const { cfg, asOf } = await run(async (_c, ctx) => ({ cfg: ctx.cfg, asOf: ctx.asOf }));
  const f = { amount: one(sp?.amount).slice(0, 20), due: one(sp?.due).slice(0, 10), on: one(sp?.on).slice(0, 10) || asOf, part: one(sp?.part).slice(0, 20), part_on: one(sp?.part_on).slice(0, 10) };
  let result = null, error = null;
  if (f.amount || f.due) {
    try {
      const principal_paise = rupeesToPaise(f.amount);
      if (!(principal_paise > 0) || principal_paise > 1_000_000_000_00) throw new Error("amount");
      if (!isISODate(f.due) || !isISODate(f.on)) throw new Error("date");
      const allocations = [];
      if (f.part) {
        const p = rupeesToPaise(f.part);
        if (!(p > 0) || !isISODate(f.part_on)) throw new Error("part");
        allocations.push({ date: f.part_on, amount_paise: p });
      }
      result = f.on > f.due
        ? computeInterest({ principal_paise, due_date: f.due, as_of: f.on, series: cfg.rbi_bank_rate.series, multiplier: cfg.msmed?.s16_multiplier ?? 3, allocations,
            appropriation: cfg.msmed?.appropriation ?? "interest_first", day_count: cfg.msmed?.day_count ?? "actual/365" })
        : { segments: [], total_interest_paise: 0 };
    } catch (e) {
      error = T(`calc.err.${["amount", "date", "part"].includes(e.message) ? e.message : "date"}`);
    }
  }
  const field = "field mt-1";
  return (
    <Shell lang={lang} wide>
      <section className="py-4">
        <h1 className="text-3xl font-bold leading-tight">{T("calc.title")}</h1>
        <p className="mt-2 max-w-3xl text-ink-muted">{T("calc.intro")}</p>
      </section>
      <form method="get" className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={T("calc.title")}>
        <label className="grid"><span className="font-semibold">{T("calc.amount")}</span><input name="amount" inputMode="decimal" required className={field} defaultValue={f.amount} placeholder="118000" /></label>
        <label className="grid"><span className="font-semibold">{T("calc.due")}</span><input name="due" type="date" required className={field} defaultValue={f.due || addDays(asOf, -60)} /></label>
        <label className="grid"><span className="font-semibold">{T("calc.on")}</span><input name="on" type="date" required className={field} defaultValue={f.on} /></label>
        <label className="grid"><span className="font-semibold">{T("calc.part")}</span><input name="part" inputMode="decimal" className={field} defaultValue={f.part} placeholder={T("calc.optional")} /></label>
        <label className="grid"><span className="font-semibold">{T("calc.part_on")}</span><input name="part_on" type="date" className={field} defaultValue={f.part_on} /></label>
        <div className="flex items-end"><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong">{T("calc.go")}</button></div>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl bg-error-soft p-3 font-medium text-error">{error}</p>}
      {result && (
        <section aria-labelledby="calc-r" className="mt-6 rounded-xl border border-accent/30 bg-accent-soft p-4">
          <h2 id="calc-r" className="text-lg font-bold">{result.segments.length ? T("calc.result", { amount: inr(result.total_interest_paise) }) : T("calc.none")}</h2>
          {result.segments.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-ink-muted"><tr>{["period", "days", "on", "rate", "interest"].map((k) => <th key={k} scope="col" className="whitespace-nowrap px-2 py-2">{T(`calc.col.${k}`)}</th>)}</tr></thead>
                <tbody>
                  {result.segments.map((s, i) => (
                    <tr key={i} className="border-t border-line tnum">
                      <td className="whitespace-nowrap px-2 py-2">{day(s.from, lang)} – {day(s.to, lang)}</td>
                      <td className="px-2 py-2">{s.days}</td>
                      <td className="whitespace-nowrap px-2 py-2">{inr(s.base_paise)}</td>
                      <td className="whitespace-nowrap px-2 py-2">{T("calc.rate", { rate: (s.rate_bps / 100).toFixed(2), bank: (s.bank_rate_bps / 100).toFixed(2) })}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-semibold">{inr(s.interest_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.segments.length > 0 && <p className="mt-3 text-sm text-ink-muted">{conventionFootnote(result, lang)}</p>}
        </section>
      )}
      <section className="mt-6 grid gap-2 pb-8 text-ink-muted">
        <p>{T("calc.who")}</p>
        <p>{T("calc.rates", { source: cfg.rbi_bank_rate.source })}</p>
        <p className="text-sm">{T("calc.disclaimer")} <Link href="/">{T("calc.app")}</Link></p>
      </section>
    </Shell>
  );
}
