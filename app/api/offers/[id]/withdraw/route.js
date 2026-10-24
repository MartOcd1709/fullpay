import { route, v } from "@/lib/http";
import * as offers from "@/lib/services/offers";

// POST: withdraw an open pay-early offer (it no longer shows on the customer's link).
export const POST = route(({ client, ctx, params }) => offers.withdraw(client, ctx, v.id(params)));
