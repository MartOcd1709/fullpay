import { route, v } from "@/lib/http";
import { badRequest } from "@/lib/services/errors";
import * as approvals from "@/lib/services/approvals";

// POST { ids: [..], approve: true|false } — owner only; each decision runs on its own savepoint.
export const POST = route(
  ({ client, ctx, body }) => {
    const ids = Array.isArray(body?.ids) ? body.ids.map((id) => v.int({ id }, "id", { min: 1 })) : null;
    if (!ids) throw badRequest("validation", "ids must be a list");
    return approvals.decideMany(client, ctx, ids, { approve: body?.approve === true, note: v.str(body, "note", { max: 500, optional: true }) });
  },
  { roles: ["owner"] },
);
