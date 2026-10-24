import test from "node:test";
import assert from "node:assert/strict";
import { suggestOffer, offerValid } from "../lib/earlyPay.js";

test("₹1,18,000 expected 47 days from now, 14% overdraft: discount is 75% of the borrowing avoided, in whole ₹100", () => {
  const s = suggestOffer({ outstanding_paise: 11_800_000, today: "2026-10-24", expected_date: "2026-12-10", rate_bps: 1400 });
  // pay by 27 Oct → 44 days earlier; 1,18,000 × 14% × 44/365 = ₹1,991.45 → 75% = ₹1,493.59 → ₹1,400
  assert.deepEqual([s.pay_by, s.days_earlier, s.borrow_cost_paise, s.discount_paise], ["2026-10-27", 44, 199145, 140000]);
  assert.equal(s.pay_amount_paise, 11_660_000);
  assert.equal(s.owner_saves_paise, 59145);
});

test("capped at 2% of the amount; nothing offered for money due soon or for under ₹100", () => {
  const big = suggestOffer({ outstanding_paise: 10_000_000, today: "2026-10-24", expected_date: "2027-06-01", rate_bps: 2400 });
  assert.equal(big.discount_paise, 200_000, "2% of ₹1,00,000");
  assert.equal(suggestOffer({ outstanding_paise: 10_000_000, today: "2026-10-24", expected_date: "2026-10-31", rate_bps: 1400 }), null);
  assert.equal(suggestOffer({ outstanding_paise: 500_000, today: "2026-10-24", expected_date: "2026-11-20", rate_bps: 1400 }), null);
  assert.equal(suggestOffer({ outstanding_paise: 0, today: "2026-10-24", expected_date: "2026-12-10", rate_bps: 1400 }), null);
});

test("an offer counts only when open and paid on or before its date", () => {
  const o = { status: "open", pay_by: "2026-10-27" };
  assert.ok(offerValid(o, "2026-10-27"));
  assert.ok(!offerValid(o, "2026-10-28"));
  assert.ok(!offerValid({ ...o, status: "withdrawn" }, "2026-10-25"));
});
