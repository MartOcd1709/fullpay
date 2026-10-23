import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import LangSwitch from "@/components/ui/LangSwitch";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import SettingsForm, { DemoControls } from "@/components/pages/SettingsForm";
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
      return { cfg: ctx.cfg, asOf: ctx.asOf, ...rows[0] };
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
  const { cfg, asOf, optouts, notices, last_notice } = data;
  const states = Object.keys(STATE_CODES).map((code) => [code, stateName(code, T.lang)]).sort((a, b) => a[1].localeCompare(b[1], T.lang));
  return (
    <>
      <PageHeader title={T("settings.title")} />
      <div className="grid gap-4">
        <Card title={T("settings.language")}>
          <LangSwitch lang={T.lang} label={T("settings.language")} />
        </Card>
        <SettingsForm lang={T.lang} cfg={cfg} states={states} />
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
