import test from "node:test";
import assert from "node:assert/strict";
import { payPattern, bestReminderDay } from "../lib/payDay.js";

test("a weekday habit, a month habit, and no habit", () => {
  assert.deepEqual(payPattern(["2026-08-10", "2026-09-07", "2026-10-15"]), { kind: "weekday", weekday: 1, share: 2 / 3, n: 3 });
  const m = payPattern(["2026-07-05", "2026-08-03", "2026-09-06", "2026-10-21"]);
  assert.deepEqual([m.kind, m.from, m.to, m.share], ["month", 3, 6, 0.75]);
  assert.equal(payPattern(["2026-08-01", "2026-08-12", "2026-09-24"]), null, "three different days, no habit");
  assert.equal(payPattern(["2026-08-10", "2026-09-07"]), null, "too few payments to say");
  assert.equal(payPattern(["2026-08-10", "2026-08-10", "2026-09-07"]), null, "same-day entries count once");
});

test("remind the day before the next usual payment day", () => {
  // 24 Oct 2026 is a Saturday; next Monday is 26 Oct → remind Sunday 25 Oct.
  assert.deepEqual(bestReminderDay({ kind: "weekday", weekday: 1 }, "2026-10-24"), { pay_day: "2026-10-26", remind_on: "2026-10-25" });
  assert.deepEqual(bestReminderDay({ kind: "month", from: 3, to: 6 }, "2026-10-24"), { pay_day: "2026-11-03", remind_on: "2026-11-02" });
  assert.equal(bestReminderDay(null, "2026-10-24"), null);
  assert.deepEqual(bestReminderDay({ kind: "month", from: 20, to: 26 }, "2026-10-24"), { pay_day: "2026-10-24", remind_on: "2026-10-24", now: true });
});
