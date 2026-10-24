import { route, v } from "@/lib/http";
import { guard } from "@/lib/services/approvals";
import * as offers from "@/lib/services/offers";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

// GET: the suggested pay-early offer for this invoice (and any open one). POST { discount_paise, pay_by }: make it.
export const GET = route(({ client, ctx, params }) => offers.suggest(client, ctx, v.id(params)));
export const POST = route(async ({ client, ctx, params, body }) => {
  const id = v.id(params);
  const discount_paise = v.int(body ?? {}, "discount_paise", { min: 100 });
  const pay_by = v.date(body ?? {}, "pay_by");
  const inv = (await client.query("SELECT number FROM invoices WHERE id = $1", [id])).rows[0];
  return guard(client, ctx, {
    kind: "offer_make", target_id: id, payload: { discount_paise, pay_by }, amount_paise: discount_paise,
    summary: `Offer ${fmtINR(discount_paise)} off ${inv?.number ?? `invoice #${id}`} if paid by ${formatDate(pay_by)}`,
  });
});
