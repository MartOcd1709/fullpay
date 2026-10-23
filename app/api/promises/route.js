import { route, v } from "@/lib/http";
import { badRequest } from "@/lib/services/errors";
import * as fu from "@/lib/services/followups";

// Owner records "Customer promised to pay on [date]" for one invoice (invoice_id) or every invoice of a reminder (invoice_ids).
export const POST = route(({ client, ctx, body }) => {
  const ids = Array.isArray(body?.invoice_ids) ? body.invoice_ids : body?.invoice_id != null ? [body.invoice_id] : null;
  if (!ids || !ids.every((x) => Number.isSafeInteger(x) && x > 0)) throw badRequest("validation", "invoice_id or invoice_ids must be positive integers");
  return fu.promiseMany(client, ctx, {
    invoice_ids: ids,
    promised_date: v.date(body, "promised_date"),
    amount_paise: v.int(body, "amount_paise", { min: 1, optional: true }),
  });
});
