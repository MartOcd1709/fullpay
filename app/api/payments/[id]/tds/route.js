import { route, v } from "@/lib/http";
import * as fu from "@/lib/services/followups";

// K7: record a confirmed payment's exact TDS shortfall as tax deducted (not cash).
export const POST = route(({ client, ctx, params }) => fu.recordTds(client, ctx, v.id(params)));
