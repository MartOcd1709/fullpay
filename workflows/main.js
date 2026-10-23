import { task } from "@renderinc/sdk/workflows";

// Render cron (04:30 UTC = 10:00 IST) starts this task; it calls the web app's dunning tick once.
// The tick itself is idempotent and single-flight (advisory lock), so no retries here.
task({ name: "daily-tick", timeoutSeconds: 120, retry: { maxRetries: 0 } }, async () => {
  const res = await fetch(`${process.env.APP_URL}/api/tick`, {
    method: "POST",
    headers: { "x-tick-secret": process.env.TICK_SECRET, "content-type": "application/json" },
    body: JSON.stringify({ source: "render-workflow" }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`tick failed: ${res.status} ${body}`);
  return JSON.parse(body);
});
