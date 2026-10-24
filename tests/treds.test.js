import test from "node:test";
import assert from "node:assert/strict";
import { tredsEstimate, sellerReady } from "../lib/treds.js";
import { daysBetween } from "../lib/time.js";

test("cash today for ₹1,18,000 due in 30 days at 7–10% a year", () => {
  const e = tredsEstimate({ outstanding_paise: 11_800_000, today: "2026-10-24", due_date: "2026-11-23", low_bps: 700, high_bps: 1000, daysBetween });
  // 1,18,000 × 7% × 30/365 = ₹678.904 → ₹678.91 (rounded up: never overstate the cash) → ₹1,17,321.09; at 10% ₹969.87 → ₹1,17,030.13
  assert.deepEqual(e, { days: 30, cash_high_paise: 11_732_109, cash_low_paise: 11_703_013 });
  assert.equal(tredsEstimate({ outstanding_paise: 11_800_000, today: "2026-10-24", due_date: "2026-10-24", low_bps: 700, high_bps: 1000, daysBetween }), null, "due today or overdue: not on TReDS");
});

test("the seller needs Udyam registration and a GSTIN", () => {
  assert.deepEqual(sellerReady({ udyam: true, gstin: "03ABCDE1234F1Z5", registration: "regular" }), { udyam: true, gstin: true });
  assert.deepEqual(sellerReady({ udyam: false, gstin: null }), { udyam: false, gstin: false });
});
