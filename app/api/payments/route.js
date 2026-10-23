import { route, v } from "@/lib/http";
import * as payments from "@/lib/services/payments";

export const GET = route(({ client, ctx, request }) => {
  const status = new URL(request.url).searchParams.get("status");
  return payments.list(client, ctx, { status: v.oneOf({ status }, "status", ["pending", "confirmed", "rejected"], { optional: true }) ?? undefined });
});

// Add a payment by hand: pending until the owner confirms it.
export const POST = route(({ client, ctx, body }) =>
  payments.addManual(client, ctx, {
    paid_on: v.date(body, "paid_on"),
    amount_paise: v.int(body, "amount_paise", { min: 1 }),
    invoice_id: v.int(body, "invoice_id", { min: 1, optional: true }),
    customer_id: v.int(body, "customer_id", { min: 1, optional: true }),
    reference: v.str(body, "reference", { max: 100, optional: true }),
    narration: v.str(body, "narration", { max: 300, optional: true }),
  }),
);
