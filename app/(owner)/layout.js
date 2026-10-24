import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Icon from "@/components/ui/Icon";
import DemoBanner from "@/components/ui/DemoBanner";
import DemoTour, { TourButton } from "@/components/ui/DemoTour";
import { demoLinks } from "@/lib/services/letters";
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
  ["/approvals", "approvals", "nav.approvals"],
  ["/analytics", "analytics", "nav.analytics"],
  ["/team", "team", "nav.team"],
  ["/activity", "activity", "nav.activity"],
  ["/settings", "settings", "nav.settings"],
];

async function shell(session) {
  const demo = process.env.DEMO_MODE === "1";
  try {
    return await run(async (c, ctx) => {
      let minutes = null;
      if (demo) {
        const { rows } = await c.query("SELECT floor(extract(epoch FROM now() - (data->'demo'->>'reset_at')::timestamptz) / 60)::int AS m FROM config WHERE id = 1");
        minutes = rows[0]?.m ?? null;
      }
      const who = session?.uid ? (await c.query("SELECT name FROM users WHERE id = $1", [session.uid])).rows[0]?.name : null;
      const pending = (await c.query("SELECT count(*)::int AS n FROM approvals WHERE status = 'pending'")).rows[0].n;
      const links = demo ? await demoLinks(c).catch(() => null) : null;
      return { demo, business: ctx.cfg.business?.name, asOf: ctx.asOf, minutes, who, pending, links };
    });
  } catch {
    return { demo, business: null, asOf: null, minutes: null, who: null, pending: 0 }; // the page itself shows the error state
  }
}

export default async function OwnerLayout({ children }) {
  const session = getSessionFromCookies(await cookies());
  if (!session) redirect("/login");
  const lang = await getLang();
  const T = makeT(lang);
  const { demo, business, asOf, minutes, who, pending, links } = await shell(session);
  const items = NAV.map(([href, icon, label, short, mobile]) => ({
    href, icon, label: href === "/approvals" && pending > 0 ? `${T(label)} (${pending})` : T(label), short: short ? T(short) : undefined, mobile: !!mobile,
  }));

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
            <form method="get" action="/search" role="search" className="hidden w-44 md:block lg:w-56">
              <label htmlFor="global-q" className="sr-only">{T("pages.search.header")}</label>
              <input id="global-q" name="q" type="search" placeholder={T("pages.search.title")} title={T("pages.search.header")} autoComplete="off" className="field" />
            </form>
            <a href="/search" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface-2 md:hidden" aria-label={T("pages.search.header")}>
              <Icon name="search" className="h-5 w-5" />
            </a>
            <span className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm sm:inline-flex" title={T("pages.role.signed_in")}>
              <Icon name="user" className="h-4 w-4" />
              {who ? `${who} · ` : ""}
              <strong>{T(`pages.role.${session.role}`)}</strong>
            </span>
            {demo && <TourButton label={T("pages.tour.start")} />}
            {demo && (
              <form method="post" action="/api/auth/demo" className="hidden items-center gap-1 md:flex" aria-label={T("pages.role.view_as")}>
                <span className="text-sm text-ink-muted">{T("pages.role.view_as")}</span>
                {["owner", "accountant", "viewer"].map((r) => (
                  <button key={r} name="as" value={r} type="submit" aria-pressed={session.role === r}
                    className={`min-h-10 rounded-full px-3 text-sm font-semibold ${session.role === r ? "bg-accent text-on-accent" : "border border-line hover:bg-surface-2"}`}>
                    {T(`pages.role.${r}`)}
                  </button>
                ))}
              </form>
            )}
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
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
            {session.role !== "owner" && (
              <div role="note" className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${session.role === "viewer" ? "border-warning/40 bg-warning-soft" : "border-info/40 bg-info-soft"}`}>
                <p className="min-w-0 flex-1">
                  <strong>{T(`pages.role.banner_${session.role}`, { name: who ?? T(`pages.role.${session.role}`) })}</strong>{" "}
                  <span className="text-ink-muted">{T(`pages.role.banner_${session.role}_hint`)}</span>
                </p>
                {demo && (
                  <form method="post" action="/api/auth/demo">
                    <input type="hidden" name="next" value="/dashboard" />
                    <button name="as" value="owner" type="submit" className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong">{T("pages.role.back_to_owner")}</button>
                  </form>
                )}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
      {demo && <DemoTour lang={T.lang} links={links ? { pay_token: links.pay_token, verify_prefix: links.verify_prefix } : null} role={session.role} />}
      <ToastRegion />
    </>
  );
}
