import Link from "next/link";
import Shell from "@/components/public/Shell";
import { getLang, tr } from "@/components/public/lang";
import { run } from "@/lib/services/context";
import * as proof from "@/lib/services/proof";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const T = tr(await getLang());
  return { title: T("proof.title") };
}

// Public: the organiser pack's final checks, run now against this deployment's data (nothing here is precomputed).
export default async function ProofPage() {
  const lang = await getLang();
  const T = tr(lang);
  let d;
  try {
    d = await run((c, ctx) => proof.run(c, ctx, lang));
  } catch (err) {
    console.error("[proof]", err);
    return <Shell lang={lang}><p role="alert" className="py-8 text-error">{T("proof.failed")}</p></Shell>;
  }
  const ok = d.passed === d.total;
  return (
    <Shell lang={lang} wide>
      <section className="py-4">
        <h1 className="text-3xl font-bold leading-tight">{T("proof.title")}</h1>
        <p className="mt-2 max-w-3xl text-ink-muted">{T("proof.intro")}</p>
        <p className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-lg font-bold ${ok ? "bg-success-soft text-success" : "bg-error-soft text-error"}`} role="status">
          {ok ? "✓" : "✗"} {T("proof.summary", { passed: d.passed, total: d.total, ms: d.ms, date: d.as_of })}
        </p>
      </section>
      <div className="grid gap-6 pb-8">
        {d.sections.map((s) => (
          <section key={s.key} aria-labelledby={`p-${s.key}`} className="rounded-xl border border-line bg-surface p-4">
            <h2 id={`p-${s.key}`} className="text-lg font-bold">{T(`proof.s.${s.key}`)}</h2>
            <ul className="mt-3 grid gap-2">
              {s.rows.map((r, i) => (
                <li key={i} className="grid gap-1 rounded-lg border border-line p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto] sm:items-start sm:gap-3">
                  <span className="font-semibold">{T(`proof.k.${r.key}`, { ...r.vars, case: r.vars.case ? T(`proof.case.${r.vars.case}`) : undefined, rung: r.vars.rung ? T(`rung.${r.vars.rung}`) : undefined })}</span>
                  <span className="min-w-0 break-words"><span className="text-sm text-ink-muted">{T("proof.expected")}: </span><span className="tnum">{r.expected}</span></span>
                  <span className="min-w-0 break-words"><span className="text-sm text-ink-muted">{T("proof.actual")}: </span><span className="tnum">{r.actual}</span></span>
                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${r.pass ? "bg-success-soft text-success" : "bg-error-soft text-error"}`}>
                    {r.pass ? "✓" : "✗"} {T(r.pass ? "proof.pass" : "proof.fail")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-ink-muted">{T("proof.more")} <Link href="/status">{T("proof.status_link")}</Link></p>
      </div>
    </Shell>
  );
}
