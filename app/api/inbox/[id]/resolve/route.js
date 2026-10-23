import { route, v } from "@/lib/http";
import * as inbox from "@/lib/services/inbox";

// action: accept_credit_note {amount_paise, reason?} | mark_paid | reject {reply} | edit {changes}
export const POST = route(({ client, ctx, params, body }) =>
  inbox.resolve(client, ctx, v.id(params), {
    action: v.oneOf(body, "action", ["accept_credit_note", "mark_paid", "reject", "edit"]),
    amount_paise: v.int(body, "amount_paise", { min: 1, optional: true }) ?? undefined,
    reason: v.str(body, "reason", { max: 300, optional: true }) ?? undefined,
    reply: v.str(body, "reply", { max: 1000, optional: true }) ?? undefined,
    changes: body?.changes && typeof body.changes === "object" ? body.changes : undefined,
  }),
);
