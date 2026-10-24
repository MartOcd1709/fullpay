// Pay-early offers: the discount an owner can afford, because getting the money N days sooner saves N days of borrowing.
// Pure; money in paise, rates in basis points a year, dates 'YYYY-MM-DD'.
import { addDays, daysBetween } from "./time.js";

export const OFFER_DEFAULTS = { borrow_rate_bps: 1400, max_discount_bps: 200, owner_share: 0.75, pay_by_days: 3, min_days_earlier: 7, min_discount_paise: 10000 };

// The borrowing an owner avoids by being paid on `pay_by` instead of `expected_date`; the discount offered is a share of it
// (so the owner still comes out ahead), capped at max_discount_bps of the amount and rounded down to whole ₹100.
// Returns null when it is not worth offering (money due soon anyway, or a discount under ₹100).
export function suggestOffer({ outstanding_paise, today, expected_date, rate_bps, opts = {} }) {
  const o = { ...OFFER_DEFAULTS, ...opts };
  if (!(outstanding_paise > 0) || !expected_date) return null;
  const pay_by = addDays(today, o.pay_by_days);
  const days_earlier = daysBetween(pay_by, expected_date);
  if (days_earlier < o.min_days_earlier) return null;
  const borrow_cost_paise = Math.floor((outstanding_paise * rate_bps * days_earlier) / (10000 * 365));
  const cap = Math.floor((outstanding_paise * o.max_discount_bps) / 10000);
  const discount_paise = Math.floor(Math.min(borrow_cost_paise * o.owner_share, cap) / 10000) * 10000;
  if (discount_paise < o.min_discount_paise) return null;
  return {
    pay_by, days_earlier, rate_bps, borrow_cost_paise, discount_paise,
    pay_amount_paise: outstanding_paise - discount_paise,
    owner_saves_paise: borrow_cost_paise - discount_paise,
    discount_bps: Math.round((discount_paise * 10000) / outstanding_paise),
  };
}

// An offer counts when the money arrives on or before its pay-by date.
export const offerValid = (offer, onDate) => !!offer && offer.status === "open" && onDate <= offer.pay_by;
