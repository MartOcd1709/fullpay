import { route, v } from "@/lib/http";
import * as customers from "@/lib/services/customers";

export const POST = route(({ client, ctx, params }) => customers.anonymize(client, ctx, v.id(params)));
