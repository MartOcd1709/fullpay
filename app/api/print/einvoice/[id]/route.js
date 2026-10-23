import { route, v } from "@/lib/http";
import { einvoice } from "@/lib/services/letters";

// K28: the invoice as NIC INV-01 shaped JSON, downloaded as a file. No IRN is generated here.
export const GET = route(async ({ params, client, ctx }) => {
  const { number, json } = await einvoice(client, ctx, v.id(params));
  const name = `einvoice-${number.replace(/[^A-Za-z0-9-]/g, "-")}.json`;
  return new Response(JSON.stringify(json, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
});
