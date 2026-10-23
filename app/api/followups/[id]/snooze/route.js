import { route, v } from "@/lib/http";
import * as fu from "@/lib/services/followups";

export const POST = route(({ client, ctx, params, body }) => fu.snooze(client, ctx, v.id(params), { days: v.int(body, "days", { min: 1, max: 7 }) }));
