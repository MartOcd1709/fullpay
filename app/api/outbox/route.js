import { route } from "@/lib/http";
import { list } from "@/lib/services/outbox";
import { badRequest } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

const STATUSES = ["queued", "awaiting_owner", "sent", "failed"];

// GET /api/outbox?status=awaiting_owner,failed&run_id=&invoice_id=&customer_id=&limit=
export const GET = route(async ({ request, client, ctx }) => {
  const p = new URL(request.url).searchParams;
  const status = p.get("status") ? p.get("status").split(",") : null;
  if (status && !status.every((s) => STATUSES.includes(s))) throw badRequest("validation", `status must be any of ${STATUSES.join(", ")}`);
  const num = (k) => (p.get(k) && /^\d+$/.test(p.get(k)) ? Number(p.get(k)) : null);
  return { rows: await list(client, ctx, { status, run_id: p.get("run_id"), invoice_id: num("invoice_id"), customer_id: num("customer_id"), limit: num("limit") ?? 200 }) };
});
