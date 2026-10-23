import { withTxn } from "../db.js";
import { loadConfig } from "../config.js";
import { initTime, today, nowISOTimestamp, isISODate } from "../time.js";

// One clock reading per operation: asOf is captured right after initTime, before any further await (clock-race finding).
export async function getContext(client) {
  const cfg = await loadConfig((text, params) => client.query(text, params));
  const clock_date = isISODate(cfg.demo?.clock_date) ? cfg.demo.clock_date : null;
  initTime({ demoOffsetDays: Number.isInteger(cfg.demo?.offset_days) ? cfg.demo.offset_days : 0, fixedToday: clock_date });
  const asOf = today();
  const now = nowISOTimestamp();
  // Under a demo clock, events are stamped on the demo date (same time of day) so timelines read in order.
  const ts = clock_date || cfg.demo?.offset_days ? `${asOf}${now.slice(10)}` : now;
  return { cfg, asOf, ts, run_id: null };
}

// For API routes: run(fn) => fn(client, ctx) inside one transaction.
export const run = (fn) => withTxn(async (client) => fn(client, await getContext(client)));
