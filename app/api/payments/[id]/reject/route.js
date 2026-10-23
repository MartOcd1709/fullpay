import { route, v } from "@/lib/http";
import * as payments from "@/lib/services/payments";

export const POST = route(({ client, ctx, params, body }) => payments.reject(client, ctx, v.id(params), { reply: v.str(body, "reply", { max: 1000, optional: true }) }));
