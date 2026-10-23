import { route, v } from "@/lib/http";
import { badRequest } from "@/lib/services/errors";
import { guard } from "@/lib/services/approvals";
import { fmtINR } from "@/lib/money";

// Confirm a matched payment; allocations default to the matcher's proposals. An accountant's confirmation waits for the owner.
export const POST = route(async ({ client, ctx, params, body }) => {
  const id = v.id(params);
  const a = body?.allocations;
  if (a != null && (!Array.isArray(a) || a.length > 50)) throw badRequest("validation", "allocations must be a list");
  const allocations = a?.map((x) => ({ invoice_id: v.int(x, "invoice_id", { min: 1 }), amount_paise: v.int(x, "amount_paise", { min: 1 }) })) ?? null;
  const p = (await client.query("SELECT amount_paise, paid_on, narration FROM payments WHERE id = $1", [id])).rows[0];
  return guard(client, ctx, {
    kind: "payment_confirm", target_id: id, payload: { allocations }, amount_paise: p?.amount_paise ?? null,
    summary: p ? `Confirm payment of ${fmtINR(p.amount_paise)} received ${p.paid_on}${p.narration ? ` (${p.narration.slice(0, 60)})` : ""}` : `Confirm payment #${id}`,
  });
});
