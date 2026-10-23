import { route, v } from "@/lib/http";
import { guard } from "@/lib/services/approvals";

// K7: record a confirmed payment's exact TDS shortfall as tax deducted (not cash).
export const POST = route(({ client, ctx, params }) => {
  const id = v.id(params);
  return guard(client, ctx, { kind: "tds_record", target_id: id, summary: `Record the TDS shortfall on payment #${id} as tax deducted` });
});
