import { route, v } from "@/lib/http";
import * as fu from "@/lib/services/followups";

// Outcome of the +15 "Call the customer" card: promise | dispute | snooze (2 days).
export const POST = route(({ client, ctx, params, body }) =>
  fu.callOutcome(client, ctx, v.id(params, "invoiceId"), {
    outcome: v.oneOf(body, "outcome", ["promise", "dispute", "snooze"]),
    promised_date: v.date(body, "promised_date", { optional: true }),
    amount_paise: v.int(body, "amount_paise", { min: 1, optional: true }),
    reason: v.str(body, "reason", { max: 1000, optional: true }),
    note: v.str(body, "note", { max: 300, optional: true }),
  }),
);
