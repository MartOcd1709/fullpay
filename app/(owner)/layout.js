import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Icon from "@/components/ui/Icon";
import DemoBanner from "@/components/ui/DemoBanner";
import LangSwitch from "@/components/ui/LangSwitch";
import { ToastRegion } from "@/components/ui/Toast";
import { getSessionFromCookies } from "@/lib/auth";
import { run } from "@/lib/services/context";
import { getLang } from "@/components/ui/server/lang";
import { makeT } from "@/components/ui/i18n";

const NAV = [
  ["/dashboard", "dashboard", "nav.dashboard", "core.nav_short.dashboard", true],
  ["/followups", "followups", "nav.followups", "core.nav_short.followups", true],
  ["/invoices", "invoices", "nav.invoices", "core.nav_short.invoices", true],
  ["/invoices/new", "newInvoice", "nav.new_invoice"],
  ["/customers", "customers", "nav.customers"],
  ["/inbox", "inbox", "nav.inbox"],
  ["/payments", "payments", "nav.payments", "core.nav_short.payments", true],
  ["/forecast", "forecast", "nav.forecast"],
  ["/chase-first", "chaseFirst", "nav.chase_first"],
  ["/documents", "documents", "nav.documents"],
  ["/settings", "settings", "nav.settings"],
];

async function shell() {
  const demo = process.env.DEMO_MODE === "1";
  try {
    return await run(async (c, ctx) => {
      let minutes = null;
      if (demo) {
        const { rows } = await c.query("SELECT floor(extract(epoch FROM now() - (data->'demo'->>'reset_at')::timestamptz) / 60)::int AS m FROM config WHERE id = 1");
        minutes = rows[0]?.m ?? null;
      }
      return { demo, business: ctx.cfg.business?.name, asOf: ctx.asOf, minutes };
    });
  } catch {
    return { demo, business: null, asOf: null, minutes: null }; // the page itself shows the error state
  }
}

export default async function OwnerLayout({ children }) {
  if (!getSessionFromCookies(await cookies())) redirect("/login");
  const lang = await getLang();
  const T = makeT(lang);
  const { demo, business, asOf, minutes } = await shell();
  const items = NAV.map(([href, icon, label, short, mobile]) => ({ href, icon, label: T(label), short: short ? T(short) : undefined, mobile: !!mobile }));

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3">
        {T("core.skip")}
      </a>
      <Nav items={items} brand="FullPay" labels={{ nav: T("core.nav_label"), more: T("core.nav_short.more"), logout: T("nav.logout") }} />
      <div className="lg:pl-64">
        <header className="border-b border-line bg-surface print:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5 sm:px-6">
            <p className="min-w-0 flex-1 truncate font-semibold">
              <span className="text-accent lg:hidden">FullPay · </span>
              <span>{business ?? ""}</span>
            </p>
            {demo && (
              <>
                <button
                  type="button"
                  popoverTarget="demo-chip"
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-2 font-semibold text-warning"
                  aria-label={T("core.demo.chip_aria")}
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1">
                    <Icon name="sparkle" className="h-4 w-4" />
                    {T("core.demo.chip")}
                  </span>
                </button>
                <div id="demo-chip" popover="auto" className="term-pop">
                  <p className="font-semibold">{T("core.demo.chip_title")}</p>
                  <p className="mt-2">
                    <strong>{T("core.demo.simulated")}</strong> {T("core.demo.simulated_list")}
                  </p>
                  <p className="mt-2">
                    <strong>{T("core.demo.real")}</strong> {T("core.demo.real_list")}
                  </p>
                </div>
              </>
            )}
            <LangSwitch lang={lang} label={T("settings.language")} />
          </div>
        </header>
        {demo && asOf && (
          <DemoBanner
            date={T.date(asOf)}
            minutes={minutes}
            labels={{
              shared: T("core.demo.shared"),
              date: T("core.demo.date"),
              reset_ago: minutes != null ? T("core.demo.reset_ago", { n: minutes }) : "",
              plus_day: T("core.demo.plus_day"),
              more: T("core.demo.more"),
              reset: T("btn.reset_demo"),
              reset_title: T("core.demo.reset_title"),
              reset_body: T("settings.reset_confirm"),
              reset_recent: T("core.demo.reset_recent"),
              reset_anyway: T("core.demo.reset_anyway"),
              resetting: T("core.demo.resetting"),
              reset_done: T("core.demo.reset_done"),
              advanced: T("core.demo.advanced"),
              working: T("core.demo.working"),
              network: T("error.network"),
              cancel: T("btn.cancel"),
              close: T("core.close"),
            }}
          />
        )}
        <main id="main" className="pb-24 lg:pb-8">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">{children}</div>
        </main>
      </div>
      <ToastRegion />
    </>
  );
}
