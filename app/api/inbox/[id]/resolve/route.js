import { route, v } from "@/lib/http";
import { guard } from "@/lib/services/approvals";
import { fmtINR } from "@/lib/money";

const LABEL = { accept_credit_note: "Issue a credit note", mark_paid: "Mark as paid", reject: "Reject with a reply", edit: "Edit the invoice terms" };

// action: accept_credit_note {amount_paise, reason?} | mark_paid | reject {reply} | edit {changes}
export const POST = route(async ({ client, ctx, params, body }) => {
  const id = v.id(params);
  const payload = {
    action: v.oneOf(body, "action", ["accept_credit_note", "mark_paid", "reject", "edit"]),
    amount_paise: v.int(body, "amount_paise", { min: 1, optional: true }) ?? undefined,
    reason: v.str(body, "reason", { max: 300, optional: true }) ?? undefined,
    reply: v.str(body, "reply", { max: 1000, optional: true }) ?? undefined,
    changes: body?.changes && typeof body.changes === "object" ? body.changes : undefined,
  };
  const it = (await client.query("SELECT i.number FROM inbox_items x JOIN invoices i ON i.id = x.invoice_id WHERE x.id = $1", [id])).rows[0];
  return guard(client, ctx, {
    kind: "inbox_resolve", target_id: id, payload, amount_paise: payload.amount_paise ?? null,
    summary: `${LABEL[payload.action]}${payload.amount_paise ? ` for ${fmtINR(payload.amount_paise)}` : ""} on ${it?.number ?? `inbox item #${id}`}`,
  });
});
