import { route, v } from "@/lib/http";
import { run } from "@/lib/services/context";
import { retry, flush, get } from "@/lib/services/outbox";

export const dynamic = "force-dynamic";

// POST /api/outbox/:id/retry — a failed (or waiting) message goes back in the email queue and is sent right away.
export const POST = route(
  async ({ params }) => {
    const id = v.id(params);
    await run((c, ctx) => retry(c, ctx, id));
    const mail = await flush({ ids: [id] });
    const row = await run((c, ctx) => get(c, ctx, id));
    return { id, status: row.status, error: row.error, mail: { sent: mail.sent, failed: mail.failed } };
  },
  { txn: false },
);
