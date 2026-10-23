import { route } from "@/lib/http";
import * as customers from "@/lib/services/customers";

export const GET = route(({ client, ctx }) => customers.list(client, ctx));
export const POST = route(({ client, ctx, body }) => customers.create(client, ctx, body ?? {}));
