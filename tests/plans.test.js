// Instalment plan rules (pure).
import test from "node:test";
import assert from "node:assert/strict";
import { validatePlan, suggestParts, progress, canSplit, remainingParts, nextDue } from "../lib/plans.js";

const today = "2026-10-24";
const out = 11_800_000; // ₹1,18,000

test("the suggested offer adds up exactly, in whole rupees, and passes the rules", () => {
  for (const n of [2, 3]) {
    const parts = suggestParts(out + 37, today, n); // an odd paise amount still adds up
    assert.equal(parts.reduce((s, p) => s + p.amount_paise, 0), out + 37);
    assert.ok(parts.slice(0, -1).every((p) => p.amount_paise % 100 === 0));
    assert.deepEqual(parts.map((p) => p.date), ["2026-10-31", "2026-11-14", "2026-11-28"].slice(0, n));
    assert.equal(validatePlan(parts, { outstanding_paise: out + 37, today }).ok, true);
  }
});

test("a plan is refused when it is not 2–3 parts, out of order, too small, too late or does not add up", () => {
  const ok = [{ date: "2026-10-30", amount_paise: 5_000_000 }, { date: "2026-11-20", amount_paise: 6_800_000 }];
  const code = (parts, o = out) => validatePlan(parts, { outstanding_paise: o, today }).error?.code;
  assert.equal(validatePlan(ok, { outstanding_paise: out, today }).ok, true);
  assert.equal(code([ok[0]]), "plan_parts");
  assert.equal(code([...ok, ok[1], ok[1]]), "plan_parts");
  assert.equal(code([ok[1], ok[0]]), "plan_date_order");
  assert.equal(code([{ ...ok[0], date: today }, ok[1]]), "plan_date_order");
  assert.equal(code([{ ...ok[0], amount_paise: 40_000 }, { ...ok[1], amount_paise: out - 40_000 }]), "plan_part_small");
  assert.equal(code([{ ...ok[0], date: "2026-11-10" }, { ...ok[1], date: "2026-11-30" }]), "plan_first_far");
  assert.equal(code([ok[0], { ...ok[1], date: "2026-12-31" }]), "plan_too_far");
  assert.equal(code(ok, out + 100), "plan_sum");
  assert.equal(code([{ date: "31/10/2026", amount_paise: 5_000_000 }, ok[1]]), "invalid_date");
});

test("progress marks parts paid as the money covers them", () => {
  const parts = suggestParts(out, today, 3);
  assert.deepEqual(progress(parts, 0).map((p) => p.paid), [false, false, false]);
  assert.deepEqual(progress(parts, parts[0].amount_paise).map((p) => p.paid), [true, false, false]);
  assert.deepEqual(progress(parts, out).map((p) => p.paid), [true, true, true]);
  assert.equal(canSplit(99_999), false);
  assert.equal(canSplit(100_000), true);
});

test("what is left of each part, and the next part due, follow part payments", () => {
  const parts = [{ date: "2026-10-31", amount_paise: 5_000_000 }, { date: "2026-11-14", amount_paise: 6_800_000 }];
  assert.deepEqual(nextDue(parts, 0), { number: 1, of: 2, date: "2026-10-31", amount_paise: 5_000_000 });
  assert.deepEqual(nextDue(parts, 2_000_000), { number: 1, of: 2, date: "2026-10-31", amount_paise: 3_000_000 });
  assert.deepEqual(nextDue(parts, 5_000_000), { number: 2, of: 2, date: "2026-11-14", amount_paise: 6_800_000 });
  assert.equal(nextDue(parts, out), null);
  assert.deepEqual(remainingParts(parts, 2_000_000, out - 2_000_000), [{ date: "2026-10-31", amount_paise: 3_000_000 }, { date: "2026-11-14", amount_paise: 6_800_000 }]);
  assert.deepEqual(remainingParts(parts, 6_000_000, out - 6_000_000), [{ date: "2026-11-14", amount_paise: 5_800_000 }]);
  // A ₹1,000 credit note on top: the last part is trued up to what is really owed.
  assert.deepEqual(remainingParts(parts, 0, out - 100_000), [{ date: "2026-10-31", amount_paise: 5_000_000 }, { date: "2026-11-14", amount_paise: 6_700_000 }]);
  assert.deepEqual(remainingParts(parts, out, 0), []);
});
