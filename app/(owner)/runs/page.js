import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import Money from "@/components/ui/Money";
import Term from "@/components/ui/Term";
import { Button } from "@/components/ui/Button";
import { getLang } from "@/components/ui/server/lang";
import { getSessionFromCookies } from "@/lib/auth";
import { t, tHint } from "@/lib/i18n";
import { formatDate } from "@/lib/time";
import { run } from "@/lib/services/context";
import { runs as loadRuns, tick } from "@/lib/services/tick";
import { list as listOutbox, flush, retry } from "@/lib/services/outbox";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: t("ops.runs.title", await getLang()) };
}

const SOURCE_KEY = { "render-workflow": "render_workflow", "cron-job": "cron_job", manual: "manual", demo: "demo", test: "test" };

async function mustBeOwner() {
  if (!getSessionFromCookies(await cookies())) redirect("/login?next=/runs");
}

// Server actions: forms post back to this page, so the buttons work without client JavaScript.
async function runNow() {
  "use server";
  await mustBeOwner();
  let s;
  try {
    s = await run((c, ctx) => tick(c, ctx, { source: "manual" }));
  } catch (err) {
    if (err?.code === "tick_running") redirect("/runs?busy=1");
    throw err;
  }
  await flush();
  redirect(`/runs?ran=${s.advanced}.${s.queued}.${s.awaiting_owner}`);
}

async function flushNow() {
  "use server";
  await mustBeOwner();
  const r = await flush();
  redirect(`/runs?flushed=${r.sent}.${r.failed}`);
}

async function retryOne(formData) {
  "use server";
  await mustBeOwner();
  const id = Number(formData.get("id"));
  if (Number.isSafeInteger(id) && id > 0) {
    await run((c, ctx) => retry(c, ctx, id)).catch(() => null);
    await flush({ ids: [id] });
  }
  redirect(`/runs#msg-${id}`);
}

const nums = (v) => (typeof v === "string" && /^\d+(\.\d+)*$/.test(v) ? v.split(".").map(Number) : null);

function Notice({ sp, lang }) {
  const ran = nums(sp.ran);
  const flushed = nums(sp.flushed);
  let text = null;
  let tone = "success";
  if (sp.busy) [text, tone] = [t("ops.runs.busy", lang), "warning"];
  else if (ran?.length === 3) text = t("ops.runs.done", lang, { advanced: ran[0], emailed: ran[1], owner: ran[2] });
  else if (flushed?.length === 2) [text, tone] = [t("ops.runs.flushed", lang, { sent: flushed[0], failed: flushed[1] }), flushed[1] ? "warning" : "success"];
  if (!text) return null;
  return (
    <p role="status" className={`mb-5 rounded-xl border p-4 font-semibold ${tone === "success" ? "border-success bg-success-soft text-success" : "border-warning bg-warning-soft text-warning"}`}>
      {text}
    </p>
  );
}

function Stat({ value, k, lang, hint = false }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="tnum text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-ink-muted">
        {hint ? <Term label={t(k, lang)} term={t(k, lang)} meaning={tHint(k, lang)} more={t("ops.term.more", lang)} /> : t(k, lang)}
      </p>
    </div>
  );
}

function rungLabel(rung, lang) {
  return rung === "invoice_sent" ? t("ops.rung.invoice_sent", lang) : t(`rung.${rung}`, lang);
}

function Message({ m, lang }) {
  return (
    <li id={`msg-${m.id}`} className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{m.customer_name}</p>
          <p className="text-ink-muted">
            {rungLabel(m.rung, lang)} · {t(`ops.channel.${m.channel}`, lang)}
          </p>
        </div>
        <StatusPill status={m.status} label={t(`ops.msg.${m.status}`, lang)} />
      </div>
      <p className="mt-2 text-ink-muted">
        {t("ops.runs.bills", lang)}: <span className="text-ink">{(m.invoice_numbers ?? []).join(", ")}</span> · <Money paise={m.outstanding_paise} />
      </p>
      {m.status === "failed" && m.error && <p className="mt-2 rounded-xl bg-error-soft p-3 text-error">{m.error}</p>}
      {m.status === "failed" && (
        <form action={retryOne} className="mt-3">
          <input type="hidden" name="id" value={m.id} />
          <Button type="submit" variant="secondary">{t("ops.runs.retry", lang)}</Button>
        </form>
      )}
      {m.status === "awaiting_owner" && (
        <Button href="/followups" variant="ghost" className="mt-2 -ml-3">{t("ops.runs.followups_link", lang)}</Button>
      )}
    </li>
  );
}

function RunCard({ r, messages, lang }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">
          {formatDate(r.ist_date, lang)} · <span className="tnum">{r.ist_time}</span> IST
        </h2>
        <StatusPill status={r.source === "render-workflow" || r.source === "cron-job" ? "success" : "info"} label={t(`ops.source.${SOURCE_KEY[r.source] ?? "manual"}`, lang)} />
      </header>
      <p className="mt-1 text-ink-muted">
        {t("ops.status.run_id", lang)}: <code className="break-all font-mono text-ink">{r.run_id}</code>
        {r.workflow_run_id && <> · {t("ops.status.workflow_id", lang)}: <code className="break-all font-mono text-ink">{r.workflow_run_id}</code></>}
        {r.source === "demo" && <> · {t("ops.status.as_of", lang, { date: formatDate(r.as_of, lang) })}</>}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat value={r.evaluated} k="ops.run.checked" lang={lang} />
        <Stat value={r.advanced} k="ops.run.advanced" lang={lang} hint />
        <Stat value={r.outbox.sent} k="ops.run.sent" lang={lang} />
        <Stat value={r.letters} k="ops.run.letters" lang={lang} hint />
        <Stat value={r.skipped} k="ops.run.held" lang={lang} hint />
      </div>
      <h3 className="mt-5 font-semibold">{t("ops.runs.messages", lang)}</h3>
      {messages.length ? (
        <ul className="mt-2 grid gap-2">{messages.map((m) => <Message key={m.id} m={m} lang={lang} />)}</ul>
      ) : (
        <p className="mt-1 text-ink-muted">{t("ops.runs.no_messages", lang)}</p>
      )}
    </li>
  );
}

export default async function RunsPage({ searchParams }) {
  const lang = await getLang();
  const sp = (await searchParams) ?? {};
  let data = null;
  try {
    data = await run(async (c, ctx) => {
      const rs = await loadRuns(c, { limit: 30 });
      const msgs = rs.length ? await listOutbox(c, ctx, { limit: 500 }) : [];
      return { rs, msgs };
    });
  } catch (err) {
    console.error("[runs]", err?.message);
  }
  const actions = (
    <>
      <form action={runNow}>
        <Button type="submit">{t("ops.runs.run_now", lang)}</Button>
      </form>
      <form action={flushNow}>
        <Button type="submit" variant="secondary">{t("ops.runs.send_queued", lang)}</Button>
      </form>
    </>
  );
  return (
    <>
      <PageHeader title={t("ops.runs.title", lang)} subtitle={t("ops.runs.subtitle", lang)} actions={actions} />
      <p className="-mt-4 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
        <span>{t("ops.runs.run_now_hint", lang)}</span>
        <Link href="/status" className="inline-flex min-h-12 items-center font-semibold text-accent underline underline-offset-4">
          {t("ops.runs.public_link", lang)}
        </Link>
      </p>
      <Notice sp={sp} lang={lang} />
      {!data ? (
        <section role="alert" className="rounded-xl border border-error bg-error-soft p-5">
          <StatusPill status="error" label={t("ops.runs.error_title", lang)} />
          <p className="mt-3">{t("ops.status.error_body", lang)}</p>
        </section>
      ) : data.rs.length === 0 ? (
        <EmptyState title={t("ops.runs.empty_title", lang)} description={t("ops.runs.empty_body", lang)} />
      ) : (
        <ol className="grid gap-4">
          {data.rs.map((r) => (
            <RunCard key={r.run_id} r={r} messages={data.msgs.filter((m) => m.run_id === r.run_id)} lang={lang} />
          ))}
        </ol>
      )}
    </>
  );
}
