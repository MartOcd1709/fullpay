import { route, v } from "@/lib/http";
import { rupeesToPaise } from "@/lib/money";
import { appError, badRequest } from "@/lib/services/errors";
import * as pub from "@/lib/services/public";
import { payPage, simulateUpi } from "@/lib/services/letters";

// Customer link API (no login; the token is the key). Errors use the { error: { code, message } } contract.
const REASONS = {
  wrong_amount: "The amount or rate is wrong",
  wrong_quantity: "The quantity is wrong",
  returned: "Goods were returned or not received",
  already_paid: "We have already paid",
  other: "Something else",
};

export const GET = route(async ({ params, client, ctx }) => {
  const view = await payPage(client, ctx, params.token);
  if (view.state === "missing") throw appError(404, "not_found", "We could not find this invoice");
  if (view.state === "expired") throw appError(410, "link_expired", "This link has expired");
  return view;
}, { owner: false });

export const POST = route(async ({ params, body, client, ctx }) => {
  const action = v.oneOf(body, "action", ["claim", "dispute", "promise", "simulate", "confirm_balance"]);
  if (action === "confirm_balance") return pub.confirmBalance(client, ctx, params.token);
  const token = params.token;
  if (action === "claim") {
    const amount_paise = rupeesToPaise(v.str(body, "amount", { max: 40 }));
    return pub.claimPaid(client, ctx, token, { reference: v.str(body, "reference", { max: 100 }), date: v.date(body, "date"), amount_paise });
  }
  if (action === "dispute") {
    const code = v.oneOf(body, "reason_code", Object.keys(REASONS));
    const details = v.str(body, "details", { max: 900, optional: true });
    if (code === "other" && !details) throw badRequest("reason_required", "Tell the seller what is wrong");
    return pub.dispute(client, ctx, token, { reason: details ? `${REASONS[code]}: ${details}` : REASONS[code] });
  }
  if (action === "promise") {
    const p = await pub.promise(client, ctx, token, { date: v.date(body, "date") });
    return { promised_date: p?.promised_date ?? body.date };
  }
  return simulateUpi(client, ctx, token, { tds: body?.tds === true });
}, { owner: false });
