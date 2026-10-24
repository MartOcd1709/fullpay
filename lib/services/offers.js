// Pay-early offers on open invoices. The suggestion comes from lib/earlyPay.js (borrowing avoided); the owner can change
// the amount and date. One open offer per invoice; making one is a money step (an accountant's goes to the owner).
import { suggestOffer, offerValid } from "../earlyPay.js";
import { expectedInflowDate } from "../forecast.js";
import { addDays, isISODate } from "../time.js";
import { event, stamp, loadInvoice } from "./common.js";
import { listWithReliability } from "./customers.js";
import { badRequest, conflict, notFound } from "./errors.js";

const OPEN = ["sent", "part_paid"];
// No offer while the customer disputes the bill or says it is already paid: settle that first.
const offerable = (inv) => OPEN.includes(inv.status) && inv.outstanding_paise > 0 && inv.paused_by !== "dispute" && inv.paused_by !== "claim";

export async function openOffers(client, invoiceIds) {
  if (!invoiceIds.length) return new Map();
  const { rows } = await client.query("SELECT * FROM early_offers WHERE status = 'open' AND invoice_id = ANY($1::bigint[])", [invoiceIds]);
  return new Map(rows.map((r) => [Number(r.invoice_id), r]));
}

export async function suggest(client, ctx, invoiceId) {
  const inv = await loadInvoice(client, invoiceId);
  const open = (await openOffers(client, [Number(inv.id)])).get(Number(inv.id)) ?? null;
  if (!offerable(inv)) return { invoice_id: inv.id, open, suggestion: null };
  const customer = (await listWithReliability(client, ctx)).find((c) => Number(c.id) === Number(inv.customer_id));
  const rate = ctx.cfg.finance?.borrow_rate_bps ?? 1400;
  const suggestion = suggestOffer({
    outstanding_paise: inv.outstanding_paise, today: ctx.asOf, expected_date: expectedInflowDate(inv, customer, ctx.asOf), rate_bps: rate,
    opts: { max_discount_bps: ctx.cfg.finance?.max_discount_bps ?? 200 },
  });
  return { invoice_id: inv.id, number: inv.number, outstanding_paise: inv.outstanding_paise, open, suggestion,
    expected_date: expectedInflowDate(inv, customer, ctx.asOf), avg_late_days: Math.round(customer?.avg_late_days ?? 0) };
}

export async function make(client, ctx, invoiceId, { discount_paise, pay_by } = {}) {
  const inv = await loadInvoice(client, invoiceId, { lock: true });
  if (!offerable(inv)) throw conflict("not_offerable", `${inv.number ?? "This invoice"} is not open for an offer (disputed, claimed as paid, or settled)`);
  const cap = Math.floor((inv.outstanding_paise * (ctx.cfg.finance?.max_discount_bps ?? 200)) / 10000);
  if (!Number.isSafeInteger(discount_paise) || discount_paise < 100 || discount_paise > cap) {
    throw badRequest("invalid_discount", `The discount must be between ₹1 and ${(cap / 100).toLocaleString("en-IN")} (the cap in Settings)`);
  }
  if (!isISODate(pay_by) || pay_by < ctx.asOf || pay_by > addDays(ctx.asOf, 30)) throw badRequest("invalid_date", "The pay-by date must be within the next 30 days");
  const { rows } = await client.query(
    `INSERT INTO early_offers (invoice_id, discount_paise, pay_by, rate_bps, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (invoice_id) WHERE status = 'open' DO NOTHING RETURNING *`,
    [inv.id, discount_paise, pay_by, ctx.cfg.finance?.borrow_rate_bps ?? 1400, ctx.user?.uid || null, stamp(ctx)],
  );
  if (!rows.length) throw conflict("offer_open", "This invoice already has an open offer; withdraw it first");
  await event(client, ctx, inv.id, "early_offer_made", "owner", { offer_id: Number(rows[0].id), discount_paise, pay_by, pay_amount_paise: inv.outstanding_paise - discount_paise });
  return rows[0];
}

export async function withdraw(client, ctx, offerId) {
  const { rows } = await client.query("UPDATE early_offers SET status = 'withdrawn', closed_at = $2 WHERE id = $1 AND status = 'open' RETURNING *", [offerId, stamp(ctx)]);
  if (!rows.length) throw notFound("open offer");
  await event(client, ctx, rows[0].invoice_id, "early_offer_withdrawn", "owner", { offer_id: Number(rows[0].id) });
  return rows[0];
}

export { offerValid };
