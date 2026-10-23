import { route, v } from "@/lib/http";
import { badRequest } from "@/lib/services/errors";
import * as payments from "@/lib/services/payments";

// The owner's confirmation; allocations default to the matcher's proposals.
export const POST = route(({ client, ctx, params, body }) => {
  const a = body?.allocations;
  if (a != null && (!Array.isArray(a) || a.length > 50)) throw badRequest("validation", "allocations must be a list");
  const allocations = a?.map((x) => ({ invoice_id: v.int(x, "invoice_id", { min: 1 }), amount_paise: v.int(x, "amount_paise", { min: 1 }) })) ?? null;
  return payments.confirm(client, ctx, v.id(params), allocations);
});
