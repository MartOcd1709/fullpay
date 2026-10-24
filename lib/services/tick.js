// The autonomous daily run (10:00 IST). One transaction under advisory lock 7: evaluate every open invoice, advance at most one
// rung each, queue the message for it in the outbox, and seal a 'tick_run' summary event into the chain.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { evaluateAll, applyAdvance } from "./rungs.js";
import { markBroken } from "./promises.js";
import { queue, flush } from "./outbox.js";
import { placeDue } from "./calls.js";
import { event } from "./common.js";
import { appError, badRequest, conflict } from "./errors.js";
import { RUNGS } from "../ladder.js";
import { festivalState } from "../festivals.js";
import { addDays, daysBetween, nowISOTimestamp } from "../time.js";
import { existsSync, readFileSync } from "node:fs";
import { pool, withTxn } from "../db.js";
import { getContext } from "./context.js";
import { save as saveSettings } from "./settings.js";
import { verifyChain, loadChain } from "../chain.js";
import { mailSetup } from "../mail.js";
import { seed, SEED_LETTER_HASH } from "../../db/seed.js";

export const TICK_LOCK = 7;
const SOURCES = ["render-workflow", "cron-job", "scheduler", "manual", "demo", "test"];
const NO_MESSAGE = new Set(["demand_letter", "odr_guidance"]); // owner action only: never sent by the tick

export const newRunId = (asOf) => `run-${asOf}-${randomUUID().slice(0, 8)}`;

export async function tick(client, ctx, { source = "manual", workflow_run_id = null } = {}) {
  const { rows: lock } = await client.query("SELECT pg_try_advisory_xact_lock($1) AS ok", [TICK_LOCK]);
  if (!lock[0].ok) throw conflict("tick_running", "Today's run is already in progress. Try again in a minute.");
  const run_id = ctx.run_id ?? newRunId(ctx.asOf);
  const rctx = { ...ctx, run_id };
  const cap = ctx.cfg.messaging?.cap_per_customer_per_day ?? 1;

  const items = await evaluateAll(client, rctx);
  const summary = {
    run_id, source: SOURCES.includes(source) ? source : "manual", workflow_run_id: workflow_run_id ? String(workflow_run_id).slice(0, 100) : null,
    as_of: ctx.asOf, evaluated: items.length, advanced: 0, queued: 0, awaiting_owner: 0, letters: 0, promises_broken: 0, skipped: 0,
    skipped_by_reason: {}, outbox_ids: [],
  };
  const skip = (reason, n = 1) => {
    summary.skipped += n;
    summary.skipped_by_reason[reason] = (summary.skipped_by_reason[reason] ?? 0) + n;
  };

  // A promise whose date has passed is broken even when the invoice cannot advance today (snoozed, opted out...).
  for (const { inv, ev } of items) {
    if (!ev.eligible && inv.open_promise && inv.open_promise.promised_date < ctx.asOf) {
      await markBroken(client, rctx, inv.open_promise);
      summary.promises_broken++;
    }
    if (!ev.eligible && ev.reason !== "nothing_due" && ev.reason !== "status") skip(ev.reason);
  }

  // Festival quiet days: nothing is advanced or sent today; the ladder catches up (highest due step) after the festival.
  const quiet = festivalState(ctx.cfg, ctx.asOf).quiet;
  if (quiet) {
    const due = items.filter((x) => x.ev.eligible).length;
    if (due) skip("quiet_day", due);
    summary.quiet = { key: quiet.key, resumes: quiet.resumes };
    await event(client, rctx, null, "tick_run", "system", summary);
    return summary;
  }

  const byCustomer = new Map();
  for (const it of items.filter((x) => x.ev.eligible)) byCustomer.set(it.inv.customer_id, [...(byCustomer.get(it.inv.customer_id) ?? []), it]);

  for (const [customerId, its] of byCustomer) {
    const customer = (await client.query("SELECT * FROM customers WHERE id = $1", [customerId])).rows[0];
    const { rows: today } = await client.query(
      `SELECT count(*)::int AS n FROM outbox WHERE customer_id = $1 AND rung NOT IN ('invoice_sent','payment_received')
         AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $2::date`,
      [customerId, ctx.asOf],
    );
    let left = cap - today[0].n;
    // Merge key (customer, rung, channel): one message per group. Most serious rung first, so the cap keeps the one that matters.
    const groups = new Map();
    for (const it of its) {
      const policy = it.ev.channel_policy;
      const channel = NO_MESSAGE.has(it.ev.target_rung) ? null : policy === "auto" ? "email" : customer.phone ? "whatsapp" : "email";
      const key = `${it.ev.target_rung}|${channel}|${policy}`;
      groups.set(key, [...(groups.get(key) ?? []), it]);
    }
    const ordered = [...groups.entries()].sort((a, b) => RUNGS.indexOf(b[1][0].ev.target_rung) - RUNGS.indexOf(a[1][0].ev.target_rung));
    for (const [key, group] of ordered) {
      const [rung, channel, policy] = key.split("|");
      if (NO_MESSAGE.has(rung)) {
        // Letters and ODR guidance are drafted for the owner; nothing goes to the customer, so the daily cap does not apply.
        for (const { inv, ev } of group) {
          await applyAdvance(client, rctx, inv, ev, "system");
          summary.advanced++;
          summary.letters++;
          if (ev.action === "unpause_and_advance") summary.promises_broken++;
        }
        continue;
      }
      if (left <= 0) {
        skip("daily_cap", group.length); // not advanced: it goes out on the next run
        continue;
      }
      for (const { inv, ev } of group) {
        await applyAdvance(client, rctx, inv, ev, "system");
        summary.advanced++;
        if (ev.action === "unpause_and_advance") summary.promises_broken++;
      }
      const status = policy === "auto" ? "queued" : "awaiting_owner";
      const row = await queue(client, rctx, { customer, invoices: group.map((g) => g.inv), rung, channel, status });
      summary.outbox_ids.push(row.id);
      if (row.status === "queued") summary.queued++; // with no email set up, an automatic step comes back as a one-tap message
      else summary.awaiting_owner++;
      left--;
    }
  }

  // Reminder calls (simulated): 7 days before and 7 days after the due date, after the ladder so a promise broken today counts.
  summary.calls = (await placeDue(client, rctx)).length;

  await event(client, rctx, null, "tick_run", "system", summary);
  return summary;
}

// Run history for /status and /runs: tick_run events newest first, joined with what their outbox rows became.
export async function runs(client, { limit = 7 } = {}) {
  const { rows } = await client.query(
    `SELECT e.payload, e.run_id, e.entry_hash, to_char(e.ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ts,
            to_char(e.ts AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS ist_date, to_char(e.ts AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS ist_time,
            to_char(e.ts AT TIME ZONE 'UTC', 'HH24:MI') AS utc_time
     FROM escalation_events e WHERE e.type = 'tick_run' ORDER BY e.id DESC LIMIT $1`,
    [Math.min(Math.max(1, limit), 100)],
  );
  if (!rows.length) return [];
  const { rows: counts } = await client.query(
    `SELECT run_id, count(*) FILTER (WHERE status = 'sent')::int AS sent, count(*) FILTER (WHERE status = 'failed')::int AS failed,
            count(*) FILTER (WHERE status = 'queued')::int AS queued, count(*) FILTER (WHERE status = 'awaiting_owner')::int AS awaiting_owner
     FROM outbox WHERE run_id = ANY($1) GROUP BY run_id`,
    [rows.map((r) => r.run_id)],
  );
  const by = Object.fromEntries(counts.map((c) => [c.run_id, c]));
  return rows.map((r) => {
    const p = JSON.parse(r.payload);
    const c = by[r.run_id] ?? { sent: 0, failed: 0, queued: 0, awaiting_owner: 0 };
    return {
      run_id: r.run_id, ts: r.ts, ist_date: r.ist_date, ist_time: r.ist_time, utc_time: r.utc_time, source: p.source, workflow_run_id: p.workflow_run_id ?? null, as_of: p.as_of,
      evaluated: p.evaluated, advanced: p.advanced, letters: p.letters ?? 0, skipped: p.skipped, skipped_by_reason: p.skipped_by_reason ?? {},
      promises_broken: p.promises_broken ?? 0,
      outbox: { sent: c.sent, failed: c.failed, queued: c.queued, awaiting_owner: c.awaiting_owner },
      entry_hash: r.entry_hash,
    };
  });
}

// Next scheduled run: 10:00 IST = 04:30 UTC, on the real calendar (the schedule does not follow the demo clock).
export function nextScheduledRun() {
  const now = nowISOTimestamp();
  const day = now.slice(0, 10);
  const next = now.slice(11, 16) < "04:30" ? day : addDays(day, 1);
  return `${next}T04:30:00Z`;
}

// ---- machine auth, reseed, demo clock, public status ----

const sha = (s) => createHash("sha256").update(String(s)).digest();
// Header secret check for cron callers (Render Workflow, cron-job.org). Constant time; an unset secret never matches.
export function machineOk(request, header, envName) {
  const expected = process.env[envName];
  const got = request.headers.get(header);
  return Boolean(expected && got) && timingSafeEqual(sha(got), sha(expected));
}

export const demoMode = () => process.env.DEMO_MODE === "1";

// Wipes and rebuilds the demo world (db/seed.js) under the tick lock, so a reseed never interleaves with a run.
// seed() itself asserts the pinned letter hash and rolls back if it moved.
export async function reseed() {
  return withTxn(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICK_LOCK]);
    const facts = await seed(client);
    if (facts.letter_hash !== SEED_LETTER_HASH) throw appError(500, "letter_hash_moved", "The demo letter hash changed; reseed rolled back");
    await client.query("UPDATE config SET data = jsonb_set(data, '{demo,reset_at}', to_jsonb(now())) WHERE id = 1");
    return { anchor: facts.anchor, letter_hash: facts.letter_hash, chain_head: facts.chain_head, events: facts.events };
  });
}

export async function minutesSinceReset(client) {
  const { rows } = await client.query(
    "SELECT floor(extract(epoch FROM now() - (data->'demo'->>'reset_at')::timestamptz) / 60)::int AS m FROM config WHERE id = 1",
  );
  return rows[0]?.m ?? null;
}

// Moves the demo clock forward one day at a time and runs that day's tick, then sends the queued email once.
export async function advanceDemo(days) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 60) throw badRequest("validation", "days must be a whole number from 1 to 60");
  const ran = [];
  for (let i = 0; i < days; i++) {
    ran.push(
      await withTxn(async (client) => {
        const ctx = await getContext(client);
        const d = ctx.cfg.demo ?? {};
        await saveSettings(client, ctx, d.clock_date ? { demo: { clock_date: addDays(d.clock_date, 1) } } : { demo: { offset_days: (d.offset_days ?? 0) + 1 } });
        return tick(client, await getContext(client), { source: "demo" });
      }),
    );
  }
  const mail = await flush();
  const total = (k) => ran.reduce((s, r) => s + (r[k] ?? 0), 0);
  return {
    days, as_of: ran.at(-1).as_of,
    advanced: total("advanced"), queued: total("queued"), awaiting_owner: total("awaiting_owner"), letters: total("letters"),
    promises_broken: total("promises_broken"), runs: ran.map((r) => r.run_id),
    mail: { attempted: mail.attempted, sent: mail.sent, failed: mail.failed },
  };
}

// How many days until the next rung of the given kind falls due for any open, unpaused invoice (K3 "to next rung").
export async function daysUntil(client, ctx, to) {
  const { offsets } = ctx.cfg.ladder;
  const { rows } = await client.query("SELECT due_date, rung FROM invoices WHERE status IN ('sent','part_paid') AND paused_by IS NULL");
  let best = null;
  for (const inv of rows) {
    const cur = RUNGS.indexOf(inv.rung);
    const targets = to === "next" ? RUNGS.slice(cur + 1, cur + 2) : RUNGS.indexOf(to) > cur ? [to] : [];
    for (const r of targets) {
      const d = daysBetween(ctx.asOf, addDays(inv.due_date, offsets[r]));
      if (d >= 1 && (best == null || d < best)) best = d;
    }
  }
  return best;
}

export const JUMPS = { letter: "demand_letter", odr: "odr_guidance", next: "next" };

function buildSha() {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  try {
    // Local fallback without running git: read .git/HEAD and the ref it points to.
    const head = readFileSync(".git/HEAD", "utf8").trim();
    if (!head.startsWith("ref:")) return head;
    const ref = `.git/${head.slice(5)}`;
    return existsSync(ref) ? readFileSync(ref, "utf8").trim() : null;
  } catch {
    return null;
  }
}
export const BUILD_SHA = buildSha();

export async function dbUp() {
  try {
    // A hung database must not hang the health check: give up after 2 s.
    await Promise.race([pool.query("SELECT 1"), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 2000))]);
    return true;
  } catch {
    return false;
  }
}

// Public status (no personal data): last runs, next scheduled run, chain check, today's send counts.
export async function status(client, ctx) {
  const chain = verifyChain(await loadChain((t, p) => client.query(t, p)));
  const recent = await runs(client, { limit: 7 });
  const { rows } = await client.query(
    `SELECT count(*) FILTER (WHERE status = 'sent' AND (sent_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date)::int AS sent,
            count(*) FILTER (WHERE status = 'failed' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date)::int AS failed,
            count(*) FILTER (WHERE status = 'queued')::int AS queued,
            count(*) FILTER (WHERE status = 'awaiting_owner')::int AS awaiting_owner
     FROM outbox`,
    [ctx.asOf],
  );
  const mail = mailSetup();
  const auto = recent.find((r) => r.source === "render-workflow" || r.source === "cron-job") ?? null;
  return {
    ok: chain.ok,
    as_of: ctx.asOf,
    next_run: nextScheduledRun(),
    last_run: recent[0] ?? null,
    last_automatic_run: auto,
    runs: recent,
    chain: { intact: chain.ok, count: chain.count, head: chain.head, break_at_id: chain.breakAtId },
    today: rows[0],
    demo: { mode: demoMode(), t0: ctx.cfg.demo?.t0 ?? null, minutes_since_reset: await minutesSinceReset(client) },
    mail: { configured: mail.configured, test_mode: mail.testMode },
    build: { sha: BUILD_SHA ? BUILD_SHA.slice(0, 7) : null },
  };
}
