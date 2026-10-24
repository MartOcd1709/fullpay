import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import LangSwitch from "@/components/ui/LangSwitch";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import SettingsForm, { DemoControls } from "@/components/pages/SettingsForm";
import QuietDays from "@/components/pages/QuietDays";
import SetupChecklist from "@/components/pages/SetupChecklist";
import * as setup from "@/lib/services/setup";
import { webhookSetup, recent as recentDeliveries } from "@/lib/services/webhooks";
import N8nTest from "@/components/pages/N8nTest";
import { run } from "@/lib/services/context";
import { STATE_CODES, stateName } from "@/lib/gst";
import { demoMode } from "@/lib/services/tick";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("settings.title") };
}

export default async function SettingsPage() {
  const T = await getT();
  let data;
  try {
    data = await run(async (c, ctx) => {
      const { rows } = await c.query(
        `SELECT (SELECT count(*) FROM customers WHERE opt_out)::int AS optouts,
                (SELECT count(*) FROM escalation_events WHERE type = 'notice_shown')::int AS notices,
                (SELECT max(ts) FROM escalation_events WHERE type = 'notice_shown') AS last_notice`,
      );
      const hook = webhookSetup();
      return { cfg: ctx.cfg, asOf: ctx.asOf, steps: await setup.steps(c, ctx), n8n: { host: hook.host, recent: await recentDeliveries(c) }, ...rows[0] };
    });
  } catch (err) {
    console.error("[settings]", err);
    return (
      <>
        <PageHeader title={T("settings.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/settings" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const { cfg, asOf, steps, n8n, optouts, notices, last_notice } = data;
  const states = Object.keys(STATE_CODES).map((code) => [code, stateName(code, T.lang)]).sort((a, b) => a[1].localeCompare(b[1], T.lang));
  return (
    <>
      <PageHeader title={T("settings.title")} />
      <div className="grid gap-4">
        <Card title={T("pages.setup.title")}>
          <SetupChecklist steps={steps} T={T} />
        </Card>
        <Card title={T("settings.language")}>
          <LangSwitch lang={T.lang} label={T("settings.language")} />
        </Card>
        <SettingsForm lang={T.lang} cfg={cfg} states={states} />
        <Card title={T("pages.quiet.title")}>
          <QuietDays lang={T.lang} festivals={cfg.calendar?.festivals ?? []} quietDays={cfg.calendar?.quiet_days ?? []} />
        </Card>
        <Card title={T("pages.n8n.title")}>
          <div className="grid gap-3">
            <p>{T("pages.n8n.intro")}</p>
            <ul className="list-disc pl-5 text-ink-muted">
              <li>{T("pages.n8n.sends_sheet")}</li>
              <li>{T("pages.n8n.sends_alerts")}</li>
              <li>{T("pages.n8n.sends_digest")}</li>
            </ul>
            {n8n.host ? (
              <p className="rounded-lg bg-success-soft p-3 font-semibold text-success">{T("pages.n8n.connected", { host: n8n.host })}</p>
            ) : (
              <p className="rounded-lg bg-surface-2 p-3">{T("pages.n8n.not_connected")}</p>
            )}
            {n8n.host && (
              <N8nTest labels={{ button: T("pages.n8n.test"), sending: T("pages.n8n.sending"), sent: T("pages.n8n.test_sent"), failed: T("pages.n8n.test_failed"), too_soon: T("pages.n8n.too_soon"), not_configured: T("pages.n8n.not_connected") }} />
            )}
            {n8n.recent.length > 0 && (
              <div>
                <h3 className="font-semibold">{T("pages.n8n.recent")}</h3>
                <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
                  {n8n.recent.map((d, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="mono" translate="no">{d.event_type}</span>
                      <span className={d.status === "sent" ? "text-success" : "text-error"}>
                        {T(d.status === "sent" ? "pages.n8n.ok" : "pages.n8n.fail", { code: d.http_status ?? d.error ?? "" })} · {d.at}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-ink-muted">{T("pages.n8n.privacy")}</p>
          </div>
        </Card>
        <Card title={T("settings.demo_date")}>
          <DemoControls lang={T.lang} enabled={demoMode()} date={asOf} />
        </Card>
        <Card title={T("privacy.title")}>
          <div className="grid gap-3">
            <p>{T("privacy.intro")}</p>
            <p>{T("pages.set.basis")}</p>
            <p className="text-sm text-ink-muted">{T("pages.set.basis_law")}</p>
            <h3 className="mt-2 font-semibold">{T("privacy.data_map")}</h3>
            <ul className="list-disc pl-5">
              <li>{T("privacy.data_name")}</li>
              <li>{T("privacy.data_contact")}</li>
              <li>{T("privacy.data_history")}</li>
            </ul>
            <h3 className="mt-2 font-semibold">{T("privacy.retention")}</h3>
            <p>{T("privacy.retention_rule", { date: T.date(cfg.retention?.fy_2026_27_until ?? "2033-12-31") })}</p>
            <p>{T("privacy.optouts", { n: optouts })}</p>
            {notices > 0 && <p>{T("privacy.notice_log", { n: notices, date: T.dateTime(last_notice) })}</p>}
            <p className="text-sm text-ink-muted">{T("privacy.dates")}</p>
            <h3 className="mt-2 font-semibold">{T("privacy.anonymize")}</h3>
            <p>{T("privacy.anonymize_hint")}</p>
            <p><Link href="/customers" className="font-semibold">{T("pages.set.manage_customers")}</Link></p>
          </div>
        </Card>
      </div>
    </>
  );
}
