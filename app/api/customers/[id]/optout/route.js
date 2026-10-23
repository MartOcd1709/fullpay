import { route, v } from "@/lib/http";
import * as customers from "@/lib/services/customers";

// POST { opt_out: true|false }
export const POST = route(({ client, ctx, params, body }) => customers.setOptOut(client, ctx, v.id(params), body?.opt_out));
