import Link from "next/link";
import Shell from "@/components/public/Shell";
import Icon from "@/components/public/Icon";
import FauxThreeD from "@/components/public/FauxThreeD";
import SlideIn from "@/components/ui/SlideIn";
import HeroVisual from "@/components/public/HeroVisual";
import MoneyRain from "@/components/public/MoneyRain";
import { getLang, tr, inr, lakh, day } from "@/components/public/lang";
import { run } from "@/lib/services/context";
import { demoLinks } from "@/lib/services/letters";
import { dashboard } from "@/lib/services/views";

export const metadata = { title: { absolute: "FullPay · get paid in full, on time" } };

const BTN = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2 font-semibold no-underline";
const DIFFS = [
  { icon: "scale", key: "interest" },
  { icon: "chat", key: "answer" },
  { icon: "shieldCheck", key: "verify" },
  { icon: "chart", key: "forecast" },
];

async function loadDemo() {
  if (process.env.DEMO_MODE !== "1") return null;
  try {
    return await run(async (c, ctx) => ({ links: await demoLinks(c), dash: await dashboard(c, ctx), asOf: ctx.asOf, business: ctx.cfg.business }));
  } catch {
    return { failed: true };
  }
}

export default async function Landing() {
  const lang = await getLang();
  const t = tr(lang);
  const demo = await loadDemo();
  const links = demo?.links;
  return (
    <Shell lang={lang} wide brandHref={null} footer={<p>{t("public.landing.honest")}</p>}>
      <section className="enter relative overflow-hidden py-3 sm:py-6 lg:py-8">
        <MoneyRain />
        <div className="hero-glow hidden lg:block" aria-hidden="true" />
        <div className="relative grid grid-cols-1 items-center gap-5 lg:grid-cols-12">
          <div className="self-center space-y-2 lg:col-span-7">
            <p className="font-semibold text-accent">{t("public.landing.kicker")}</p>
            <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{t("public.landing.h1")}</h1>
            <p className="max-w-xl text-base leading-snug text-ink-muted">{t("public.landing.problem")}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {demo ? (
                <form method="post" action="/api/auth/demo">
                  <button type="submit" className={`${BTN} hover-lift w-full bg-accent text-lg text-on-accent hover:bg-accent-strong sm:w-auto`}>
                    {t("public.landing.open_demo")}
                    <Icon name="arrow" />
                  </button>
                </form>
              ) : (
                <Link href="/login" className={`${BTN} hover-lift bg-accent text-lg text-on-accent hover:bg-accent-strong`}>{t("public.landing.sign_in")}</Link>
              )}
              {links?.pay_token && (
                <Link href={`/pay/${links.pay_token}`} className={`${BTN} hover-lift border border-line bg-surface text-ink hover:bg-surface-2`}>{t("public.landing.customer_view")}</Link>
              )}
              {links?.verify_prefix && (
                <Link href={`/v/${links.verify_prefix}`} className={`${BTN} hover-lift border border-line bg-surface text-ink hover:bg-surface-2`}>{t("public.landing.verify_letter")}</Link>
              )}
              <Link href="/status" className={`${BTN} hover-lift text-accent hover:bg-accent-soft`}>{t("public.landing.status")}</Link>
              <Link href="/proof" className={`${BTN} hover-lift text-accent hover:bg-accent-soft`}>{t("public.landing.proof")}</Link>
              <Link href="/calculator" className={`${BTN} hover-lift text-accent hover:bg-accent-soft`}>{t("public.landing.calculator")}</Link>
            </div>
            {demo && (
              <p className="text-ink-muted">
                <strong className="text-ink">{t("public.landing.cta_hint_bold")}</strong> {t("public.landing.cta_hint_rest")}
              </p>
            )}
            {demo && <p className="text-ink-muted">{t("public.landing.demo_note")}</p>}
          </div>
          <HeroVisual className="self-center lg:col-span-5" />
        </div>
      </section>

      <SlideIn as="section" aria-labelledby="flow" className="py-6">
        <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 id="flow" className="text-2xl font-bold">{t("public.landing.flow_title")}</h2>
            <p className="mt-3 max-w-prose text-ink-muted">{t("public.landing.flow_body")}</p>
          </div>
          <FauxThreeD t={t} />
        </div>
      </SlideIn>

      <SlideIn as="section" aria-labelledby="diff" className="py-6">
        <h2 id="diff" className="text-2xl font-bold">{t("public.landing.diff_title")}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {DIFFS.map((d, i) => (
            <li key={d.key}>
              <SlideIn delay={i * 80} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-accent-soft p-2 text-accent"><Icon name={d.icon} className="h-6 w-6" /></span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold leading-snug">{t(`public.landing.d_${d.key}`)}</h3>
                    <p className="mt-1 text-ink-muted">{t(`public.landing.d_${d.key}_body`)}</p>
                  </div>
                </div>
              </SlideIn>
            </li>
          ))}
        </ul>
      </SlideIn>

      {demo && !demo.failed && (
        <SlideIn as="section" aria-labelledby="demo" className="py-6">
          <h2 id="demo" className="text-2xl font-bold">{t("public.landing.demo_title")}</h2>
          <div className="mt-4 rounded-xl border border-line bg-surface p-5">
            <p className="text-lg font-semibold">{demo.business.name}</p>
            <p className="text-ink-muted">{t("public.landing.demo_business", { city: demo.business.city ?? "", date: day(demo.asOf, lang) })}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label={t("public.landing.to_collect")} paise={demo.dash.to_collect_paise} lang={lang} />
              <Stat label={t("public.landing.overdue")} paise={demo.dash.overdue_paise} lang={lang} tone="text-error" />
              <div>
                <dt className="text-ink-muted">{t("public.landing.shortfall")}</dt>
                <dd className="mt-1 text-2xl font-bold">
                  {demo.dash.first_shortfall_week == null
                    ? t("public.landing.no_shortfall")
                    : t("public.landing.shortfall_week", { n: demo.dash.first_shortfall_week + 1 })}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-ink-muted">{t("public.landing.demo_story")}</p>
          </div>
        </SlideIn>
      )}
      {demo?.failed && (
        <p role="status" className="my-6 rounded-xl bg-warning-soft px-4 py-3 font-medium text-warning">{t("public.landing.demo_unavailable")}</p>
      )}
    </Shell>
  );
}

function Stat({ label, paise, lang, tone = "" }) {
  const sub = lakh(paise, lang);
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tnum mt-1 text-2xl font-bold ${tone}`}>{inr(paise, false)}</dd>
      {sub && <dd className="text-ink-muted">{sub}</dd>}
    </div>
  );
}
