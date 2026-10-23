import { route } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { run } from "@/lib/services/context";
import { tick, machineOk } from "@/lib/services/tick";
import { flush } from "@/lib/services/outbox";
import { appError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

// POST /api/tick — the daily run, then the email flush. Callers: Render Workflow / cron-job.org with x-tick-secret, or the owner.
// The response carries counts and ids only (cron-job.org stores response bodies), never message text or addresses.
export const POST = route(
  async ({ request, body }) => {
    const machine = machineOk(request, "x-tick-secret", "TICK_SECRET");
    if (!machine && requireOwner(request)) throw appError(401, "unauthorized", "Login required, or a valid x-tick-secret header");
    const source = machine ? (body?.source === "render-workflow" ? "render-workflow" : "cron-job") : "manual";
    const summary = await run((c, ctx) => tick(c, ctx, { source, workflow_run_id: body?.workflow_run_id ?? null }));
    const mail = await flush();
    return { ...summary, mail: { attempted: mail.attempted, sent: mail.sent, failed: mail.failed } };
  },
  { owner: false, txn: false },
);
