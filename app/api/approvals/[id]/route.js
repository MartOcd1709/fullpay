import { route, v } from "@/lib/http";
import * as approvals from "@/lib/services/approvals";

// POST { approve: true|false, note? } — owner only.
export const POST = route(
  ({ client, ctx, params, body }) =>
    approvals.decide(client, ctx, v.id(params), { approve: body?.approve === true, note: v.str(body, "note", { max: 500, optional: true }) }),
  { roles: ["owner"] },
);
