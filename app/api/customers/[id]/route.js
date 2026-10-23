import { route, v } from "@/lib/http";
import * as customers from "@/lib/services/customers";

export const GET = route(({ client, ctx, params }) => customers.get(client, ctx, v.id(params)));
export const PATCH = route(({ client, ctx, params, body }) => customers.update(client, ctx, v.id(params), body ?? {}));
