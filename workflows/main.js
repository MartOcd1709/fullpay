import { task } from "@renderinc/sdk/workflows";

// Render cron (04:30 UTC = 10:00 IST) starts this task; it calls the web app's daily run once.
// The run itself is idempotent and single-flight (advisory lock 7, 409 if busy), so no retries here.
// SDK 1.4: the task receives its TaskContext first; ctx.metadata.taskRunId is this run's id, which the app
// records on the tick_run event and shows on /status and /runs.
task({ name: "daily-tick", timeoutSeconds: 120, plan: "starter", retry: { maxRetries: 0 } }, async (ctx) => {
  const workflow_run_id = ctx?.metadata?.taskRunId ?? null;
  const res = await fetch(`${process.env.APP_URL}/api/tick`, {
    method: "POST",
    headers: { "x-tick-secret": process.env.TICK_SECRET, "content-type": "application/json" },
    body: JSON.stringify({ source: "render-workflow", workflow_run_id }),
    signal: AbortSignal.timeout(100_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`tick failed: ${res.status} ${body.slice(0, 300)}`);
  const summary = JSON.parse(body);
  console.log(`[daily-tick] run ${summary.run_id} (workflow ${workflow_run_id}): advanced ${summary.advanced}, queued ${summary.queued}, sent ${summary.mail?.sent}, failed ${summary.mail?.failed}`);
  return summary;
});
