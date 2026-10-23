import { formatDate } from "@/lib/time";
import { route, v } from "@/lib/http";
import { guard } from "@/lib/services/approvals";
import { fmtINR } from "@/lib/money";

export const POST = route(async ({ client, ctx, params, body }) => {
  const id = v.id(params);
  const p = (await client.query("SELECT amount_paise, paid_on FROM payments WHERE id = $1", [id])).rows[0];
  return guard(client, ctx, {
    kind: "payment_reject", target_id: id, payload: { reply: v.str(body, "reply", { max: 1000, optional: true }) }, amount_paise: p?.amount_paise ?? null,
    summary: p ? `Reject payment of ${fmtINR(p.amount_paise)} received ${formatDate(p.paid_on)}` : `Reject payment #${id}`,
  });
});
