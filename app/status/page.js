import Link from "next/link";
import { cookies } from "next/headers";
import StatusPill from "@/components/ui/StatusPill";
import Term from "@/components/ui/Term";
import { t, tHint } from "@/lib/i18n";
import { formatDate } from "@/lib/time";
import { run } from "@/lib/services/context";
import { status as loadStatus, dbUp } from "@/lib/services/tick";

export const dynamic = "force-dynamic";

const langOf = async () => ((await cookies()).get("lang")?.value === "hi" ? "hi" : "en");

export async function generateMetadata() {
  return { title: t("ops.status.meta_title", await langOf()), robots: { index: false } };
}

const SOURCE_KEY = { "render-workflow": "render_workflow", "cron-job": "cron_job", scheduler: "scheduler", manual: "manual", demo: "demo", test: "test" };
const isAuto = (r) => r?.source === "render-workflow" || r?.source === "cron-job" || r?.source === "scheduler";

// Plain word + ⓘ popover with the meaning (shared Term: opens on tap or Enter, not hover-only).
function Explained({ k, lang }) {
  return <Term label={t(k, lang)} term={t(k, lang)} meaning={tHint(k, lang)} more={t("ops.term.more", lang)} className="font-semibold text-ink-muted" />;
}

function Mono({ children }) {
  return <code className="block break-all font-mono text-base text-ink">{children}</code>;
}

const TILE_TONE = { success: "border-l-success", error: "border-l-error", warning: "border-l-warning", info: "border-l-info", neutral: "border-l-line" };

function Tile({ value, label, tone }) {
  return (
    <div className={`rounded-xl border border-l-4 border-line bg-surface p-4 ${TILE_TONE[tone]}`}>
      <p className="tnum text-3xl font-bold leading-none">{value}</p>
      <p className="mt-2 font-semibold leading-snug text-ink-muted">{label}</p>
    </div>
  );
}

function RunRow({ r, lang }) {
  const sent = r.outbox.sent;
  const failed = r.outbox.failed;
  const reasons = Object.entries(r.skipped_by_reason ?? {})
    .map(([k, n]) => `${n} ${t(`ops.reason.${k}`, lang)}`)
    .join(", ");
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {formatDate(r.ist_date, lang)} · <span className="tnum">{r.ist_time}</span> IST{" "}
          <span className="font-normal text-ink-muted">({t("ops.status.utc", lang, { time: r.utc_time })})</span>
        </p>
        <p className="text-ink-muted">{t(`ops.source.${SOURCE_KEY[r.source] ?? "manual"}`, lang)}</p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        <li><StatusPill status={sent ? "success" : "neutral"} label={`${sent} ${t("ops.run.sent", lang)}`} /></li>
        {failed > 0 && <li><StatusPill status="error" label={`${failed} ${t("ops.run.failed", lang)}`} /></li>}
        {r.outbox.awaiting_owner > 0 && <li><StatusPill status="warning" label={`${r.outbox.awaiting_owner} ${t("ops.run.for_owner", lang)}`} /></li>}
        {r.letters > 0 && <li><StatusPill status="info" label={`${r.letters} ${t("ops.run.letters", lang)}`} /></li>}
        {r.skipped > 0 && <li><StatusPill status="neutral" label={`${r.skipped} ${t("ops.run.held", lang)}`} /></li>}
      </ul>
      {reasons && <p className="mt-2 text-ink-muted">{t("ops.run.held", lang)}: {reasons}</p>}
      <p className="mt-2 text-ink-muted">
        {t("ops.status.run_id", lang)}: <code className="break-all font-mono text-ink">{r.run_id}</code>
        {r.workflow_run_id && (
          <>
            {" · "}
            {t("ops.status.workflow_id", lang)}: <code className="break-all font-mono text-ink">{r.workflow_run_id}</code>
          </>
        )}
        {r.source === "demo" && <> · {t("ops.status.as_of", lang, { date: formatDate(r.as_of, lang) })}</>}
      </p>
    </li>
  );
}

export default async function StatusPage() {
  const lang = await langOf();
  let s = null;
  try {
    s = await run((c, ctx) => loadStatus(c, ctx));
  } catch (err) {
    console.error("[status]", err?.message);
  }
  const db = s ? true : await dbUp();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-12 items-center gap-2 text-xl font-bold text-ink no-underline">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-on-accent">₹</span>
          FullPay
        </Link>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 font-semibold text-ink no-underline hover:bg-surface-2">
          {t("ops.status.back", lang)}
        </Link>
      </header>

      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{t("ops.status.title", lang)}</h1>
      <p className="mt-2 max-w-prose text-ink-muted">{t("ops.status.subtitle", lang)}</p>

      {!s ? (
        <section role="alert" className="mt-6 rounded-xl border border-error bg-error-soft p-5">
          <StatusPill status="error" label={t("ops.status.error_title", lang)} />
          <p className="mt-3">{t("ops.status.error_body", lang)}</p>
        </section>
      ) : (
        <StatusBody s={s} lang={lang} db={db} />
      )}
    </div>
  );
}

function StatusBody({ s, lang, db }) {
  const last = s.last_automatic_run ?? s.last_run;
  const nextDate = s.next_run.slice(0, 10);
  return (
    <>
      <section aria-labelledby="hero" className="mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
        {last ? (
          <>
            <StatusPill status={isAuto(last) ? "success" : "info"} label={t(`ops.source.${SOURCE_KEY[last.source] ?? "manual"}`, lang)} />
            <h2 id="hero" className="mt-3 text-xl font-bold leading-snug sm:text-2xl">
              {t(isAuto(last) ? "ops.status.hero_auto" : "ops.status.hero_other", lang, { time: last.ist_time })}
              {" — "}
              <span className="whitespace-nowrap text-success">{t("ops.status.hero_sent", lang, { n: last.outbox.sent })}</span>
              {last.outbox.failed > 0 && (
                <span className="whitespace-nowrap text-error"> · {t("ops.status.hero_failed", lang, { n: last.outbox.failed })}</span>
              )}
            </h2>
            <p className="mt-1 text-ink-muted">
              {t("ops.status.on", lang, { date: formatDate(last.ist_date, lang) })} ({t("ops.status.utc", lang, { time: last.utc_time })})
            </p>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt><Explained k="ops.status.run_id" lang={lang} /></dt>
                <dd><Mono>{last.run_id}</Mono></dd>
              </div>
              {last.workflow_run_id && (
                <div>
                  <dt><Explained k="ops.status.workflow_id" lang={lang} /></dt>
                  <dd><Mono>{last.workflow_run_id}</Mono></dd>
                </div>
              )}
              <div>
                <dt className="flex min-h-12 items-center font-semibold text-ink-muted">{t("ops.status.next_run", lang)}</dt>
                <dd className="font-semibold">{t("ops.status.next_run_value", lang, { date: formatDate(nextDate, lang) })}</dd>
                {s.demo.mode && <dd className="mt-1 text-ink-muted">{t("ops.status.next_run_note", lang)}</dd>}
              </div>
            </dl>
          </>
        ) : (
          <>
            <StatusPill status="neutral" label={t("ops.status.empty_title", lang)} />
            <h2 id="hero" className="mt-3 text-xl font-bold leading-snug sm:text-2xl">{t("ops.status.hero_none", lang)}</h2>
            <p className="mt-2 text-ink-muted">{t("ops.status.next_run_value", lang, { date: formatDate(nextDate, lang) })}</p>
          </>
        )}
      </section>

      <section aria-labelledby="today" className="mt-6">
        <h2 id="today" className="mb-3 text-lg font-semibold">
          {t(s.demo.mode ? "ops.status.today" : "ops.status.today_real", lang)} · {formatDate(s.as_of, lang)}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile value={s.today.sent} label={t("ops.status.sent", lang)} tone="success" />
          <Tile value={s.today.failed} label={t("ops.status.failed", lang)} tone={s.today.failed ? "error" : "neutral"} />
          <Tile value={s.today.awaiting_owner} label={t("ops.status.awaiting", lang)} tone="warning" />
          <Tile value={s.today.queued} label={t("ops.status.queued", lang)} tone="info" />
        </div>
      </section>

      <section aria-labelledby="chain" className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 id="chain" className="text-lg font-semibold">
          <Explained k="ops.status.chain_title" lang={lang} />
        </h2>
        <p className="mt-2">
          {s.chain.intact ? (
            <StatusPill status="intact" label={t("ops.status.chain_ok", lang, { n: s.chain.count })} />
          ) : (
            <StatusPill status="error" label={t("ops.status.chain_broken", lang, { id: s.chain.break_at_id })} />
          )}
        </p>
        <p className="mt-3 font-semibold text-ink-muted">{t("ops.status.chain_head", lang)}</p>
        <Mono>{s.chain.head}</Mono>
      </section>

      <section aria-labelledby="recent" className="mt-6">
        <h2 id="recent" className="mb-3 text-lg font-semibold">{t("ops.status.recent", lang)}</h2>
        {s.runs.length ? (
          <ol className="grid gap-3">
            {s.runs.map((r) => <RunRow key={r.run_id} r={r} lang={lang} />)}
          </ol>
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center">
            <p className="font-semibold">{t("ops.status.empty_title", lang)}</p>
            <p className="mx-auto mt-2 max-w-prose text-ink-muted">{t("ops.status.empty_body", lang)}</p>
          </div>
        )}
      </section>

      <footer className="mt-8 grid gap-2 border-t border-line pt-5 text-ink-muted">
        <p className="flex flex-wrap gap-2">
          <StatusPill status={db ? "success" : "error"} label={db ? t("ops.status.db_ok", lang) : t("ops.status.error_title", lang)} />
        </p>
        <p>{s.mail.configured ? (s.mail.test_mode ? t("ops.status.mail_test", lang) : t("ops.status.mail_live", lang)) : t("ops.status.mail_off", lang)}</p>
        <p>
          {t("ops.status.build", lang)}: <code className="font-mono text-ink">{s.build.sha ?? t("ops.status.build_unknown", lang)}</code>
          {s.demo.mode && (
            <>
              {" · "}
              {t("ops.status.demo_note", lang, { date: formatDate(s.as_of, lang) })}
              {s.demo.minutes_since_reset != null && <> · {t("ops.status.demo_reset", lang, { n: s.demo.minutes_since_reset })}</>}
            </>
          )}
        </p>
        <p>{t("ops.status.no_pii", lang)}</p>
      </footer>
    </>
  );
}
