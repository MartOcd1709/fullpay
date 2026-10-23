import { route, v } from "@/lib/http";
import * as invoices from "@/lib/services/invoices";

export const GET = route(async ({ client, ctx, params }) => {
  const { pay_token, ...inv } = await invoices.get(client, ctx, v.id(params));
  return inv;
});
export const PATCH = route(({ client, ctx, params, body }) => invoices.updateDraft(client, ctx, v.id(params), body ?? {}));
