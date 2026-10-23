import { route, v } from "@/lib/http";
import * as promises from "@/lib/services/promises";

// POST { date: 'YYYY-MM-DD', amount_paise? } — the owner records "Customer promised to pay on [date]"; reminders pause until then.
export const POST = route(({ client, ctx, params, body }) =>
  promises.create(client, ctx, {
    invoice_id: v.id(params),
    promised_date: v.date(body, "date"),
    amount_paise: v.int(body, "amount_paise", { min: 1, optional: true }),
    actor: "owner",
  }),
);
