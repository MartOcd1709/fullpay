import { route, v } from "@/lib/http";
import { event, loadInvoice } from "@/lib/services/common";
import { badRequest, conflict } from "@/lib/services/errors";
import { addDays } from "@/lib/time";

const MAX_DAYS = 30;

// POST { until: 'YYYY-MM-DD' | null } — no reminders for this invoice up to and including that date (ladder.evaluate honours
// snoozed_until). null clears it. Chained as a 'snoozed' event so the record shows why reminders went quiet.
export const POST = route(async ({ client, ctx, params, body }) => {
  const inv = await loadInvoice(client, v.id(params), { lock: true });
  if (!["sent", "part_paid"].includes(inv.status)) throw conflict("status", "Only a sent or part-paid invoice can be snoozed");
  const until = body?.until == null ? null : v.date(body, "until");
  if (until && (until <= ctx.asOf || until > addDays(ctx.asOf, MAX_DAYS))) {
    throw badRequest("invalid_date", `Snooze must end between tomorrow and ${MAX_DAYS} days from today`);
  }
  await client.query("UPDATE invoices SET snoozed_until = $2 WHERE id = $1", [inv.id, until]);
  await event(client, ctx, inv.id, until ? "snoozed" : "snooze_cleared", "owner", until ? { until } : {});
  return { id: inv.id, snoozed_until: until };
});
