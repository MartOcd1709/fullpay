// In-process daily schedule, so the 10:00 IST run does not depend on an outside cron service.
// - Today's chase: once per demo day, at or after 10:00 IST (checked every 5 minutes, and 30 s after the server starts, so a
//   server that was asleep at 10:00 catches up on its first wake). The tick's advisory lock and "no stage twice" rule make a
//   second trigger (cron-job.org, Render cron) harmless; we also skip when today's run is already recorded.
// - Demo reset: once a night after 01:00 IST (DEMO_MODE only), if nobody reset it in the last 6 hours.
import { run } from "./services/context.js";
import { tick, reseed, minutesSinceReset } from "./services/tick.js";
import { flush } from "./services/outbox.js";

const istHour = (ms = Date.now()) => new Date(ms + 330 * 60_000).getUTCHours(); // IST = UTC+5:30, no DST
let busy = false;

export async function checkOnce(ms = Date.now()) {
  if (busy) return { skipped: "busy" };
  busy = true;
  try {
    const h = istHour(ms);
    if (process.env.DEMO_MODE === "1" && h >= 1 && h < 6) {
      const mins = await run((c) => minutesSinceReset(c));
      if (mins == null || mins > 6 * 60) return { reset: await reseed() };
    }
    if (h < 10) return { skipped: "before_10" };
    const summary = await run(async (c, ctx) => {
      const { rows } = await c.query("SELECT 1 FROM escalation_events WHERE type = 'tick_run' AND payload::jsonb->>'as_of' = $1 LIMIT 1", [ctx.asOf]);
      return rows.length ? null : tick(c, ctx, { source: "scheduler" });
    });
    if (!summary) return { skipped: "already_ran" };
    const mail = await flush();
    console.info(`[scheduler] daily run ${summary.run_id}: ${summary.advanced} advanced, ${mail.sent} emailed, ${mail.failed} failed`);
    return { summary, mail };
  } catch (err) {
    if (err?.code !== "tick_running") console.error("[scheduler]", err?.message ?? err);
    return { error: err?.code ?? "error" };
  } finally {
    busy = false;
  }
}

export function start() {
  setTimeout(() => checkOnce(), 30_000).unref();
  setInterval(() => checkOnce(), 5 * 60_000).unref();
}
