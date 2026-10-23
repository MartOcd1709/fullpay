import test from "node:test";
import assert from "node:assert/strict";
import {
  RUNGS, DEFAULT_OFFSETS, rungMeta, rungIndex, daysOverdue, dueRungs, evaluate,
  onPromise, onDispute, onClaim, nextSteps, validateOffsets,
} from "../lib/ladder.js";

const DUE = "2026-10-10";

function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function invoice(over = {}) {
  return { id: 1, status: "sent", rung: null, paused_by: null, snoozed_until: null, due_date: DUE, outstanding_paise: 1180000, ...over };
}

function ctx(today, over = {}) {
  return { today, customer: { opt_out: false }, open_promise: null, broken_promise: false, ...over };
}

test("one invoice moves through every rung on the right day and never repeats a stage", () => {
  const inv = invoice();
  const expected = {
    "2026-10-07": "heads_up", "2026-10-10": "due_date", "2026-10-17": "overdue_gentle",
    "2026-10-25": "overdue_firm", "2026-11-09": "demand_letter", "2026-11-24": "odr_guidance",
  };
  const policies = { heads_up: "auto", due_date: "auto", overdue_gentle: "owner_tap", overdue_firm: "owner_tap", demand_letter: "owner_action", odr_guidance: "owner_action" };
  const advances = {};
  for (let today = "2026-10-06"; today <= "2026-11-30"; today = addDays(today, 1)) {
    const r = evaluate(inv, ctx(today));
    if (r.action === "none") {
      assert.equal(r.eligible, false, today);
      assert.equal(r.reason, "nothing_due", today);
      continue;
    }
    assert.equal(r.eligible, true, today);
    assert.equal(r.action, "advance", today);
    assert.equal(r.reason, "due", today);
    assert.deepEqual(r.skipped, [], today);
    assert.equal(r.channel_policy, policies[r.target_rung], today);
    advances[today] = r.target_rung;
    inv.rung = r.target_rung;
  }
  assert.deepEqual(advances, expected);
});

test("entry 20 days overdue goes straight to overdue_firm, skipping three rungs", () => {
  const r = evaluate(invoice(), ctx(addDays(DUE, 20)));
  assert.equal(r.eligible, true);
  assert.equal(r.target_rung, "overdue_firm");
  assert.deepEqual(r.skipped, ["heads_up", "due_date", "overdue_gentle"]);
  assert.equal(r.action, "advance");
});

test("invoice sent at due+10 enters at overdue_gentle with no heads_up or due_date message", () => {
  const r = evaluate(invoice(), ctx(addDays(DUE, 10)));
  assert.equal(r.target_rung, "overdue_gentle");
  assert.deepEqual(r.skipped, ["heads_up", "due_date"]);
  assert.equal(r.channel_policy, "owner_tap");
});

test("a stage already reached is never repeated and the ladder never moves backwards", () => {
  assert.equal(evaluate(invoice({ rung: "overdue_firm" }), ctx(addDays(DUE, 20))).action, "none");
  const r = evaluate(invoice({ rung: "demand_letter" }), ctx(addDays(DUE, 20)));
  assert.equal(r.action, "none");
  assert.equal(r.reason, "nothing_due");
});

test("part payment keeps the stage and stays eligible for the next one", () => {
  assert.equal(evaluate(invoice({ status: "part_paid", rung: "overdue_gentle" }), ctx(addDays(DUE, 10))).action, "none");
  const r = evaluate(invoice({ status: "part_paid", rung: "overdue_gentle" }), ctx(addDays(DUE, 15)));
  assert.equal(r.action, "advance");
  assert.equal(r.target_rung, "overdue_firm");
});

test("pause by dispute or claim blocks", () => {
  for (const paused_by of [onDispute(), onClaim()]) {
    const r = evaluate(invoice({ rung: "due_date", paused_by }), ctx(addDays(DUE, 20)));
    assert.equal(r.eligible, false);
    assert.equal(r.reason, "paused");
    assert.equal(r.action, "none");
  }
});

test("snoozed_until today blocks, yesterday allows", () => {
  const today = addDays(DUE, 7);
  const blocked = evaluate(invoice({ rung: "due_date", snoozed_until: today }), ctx(today));
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.reason, "snoozed");
  const allowed = evaluate(invoice({ rung: "due_date", snoozed_until: addDays(today, -1) }), ctx(today));
  assert.equal(allowed.action, "advance");
  assert.equal(allowed.target_rung, "overdue_gentle");
});

test("opt_out blocks auto and owner_tap rungs but still surfaces demand_letter as owner_action_only", () => {
  const optOut = { customer: { opt_out: true } };
  const auto = evaluate(invoice(), ctx(addDays(DUE, -3), optOut));
  assert.equal(auto.eligible, false);
  assert.equal(auto.reason, "opt_out");
  assert.equal(auto.target_rung, "heads_up");
  const tap = evaluate(invoice(), ctx(addDays(DUE, 20), optOut));
  assert.equal(tap.eligible, false);
  assert.equal(tap.reason, "opt_out");
  assert.equal(tap.action, "none");
  const letter = evaluate(invoice(), ctx(addDays(DUE, 30), optOut));
  assert.equal(letter.eligible, true);
  assert.equal(letter.target_rung, "demand_letter");
  assert.equal(letter.channel_policy, "owner_action_only");
  assert.equal(letter.action, "advance");
  assert.deepEqual(letter.skipped, ["heads_up", "due_date", "overdue_gentle", "overdue_firm"]);
});

test("broken promise lifts the pause and advances one rung even when the date guard says none", () => {
  const today = addDays(DUE, 3);
  const inv = invoice({ rung: "due_date", paused_by: "promise" });
  assert.equal(evaluate(inv, ctx(today, { open_promise: { promised_date: addDays(today, 2) } })).reason, "paused");
  const r = evaluate(inv, ctx(today, { broken_promise: true }));
  assert.equal(r.eligible, true);
  assert.equal(r.target_rung, "overdue_gentle");
  assert.equal(r.action, "unpause_and_advance");
  assert.equal(r.reason, "promise_broken");
  assert.deepEqual(r.skipped, []);
});

test("broken promise still lands on the highest due rung when that is further ahead", () => {
  const r = evaluate(invoice({ rung: "due_date", paused_by: "promise" }), ctx(addDays(DUE, 20), { broken_promise: true }));
  assert.equal(r.target_rung, "overdue_firm");
  assert.deepEqual(r.skipped, ["overdue_gentle"]);
  assert.equal(r.action, "unpause_and_advance");
});

test("open promise is derived from ctx: unbroken pauses, past promised_date breaks", () => {
  const today = addDays(DUE, 3);
  const open = evaluate(invoice({ rung: "due_date" }), ctx(today, { open_promise: { promised_date: today } }));
  assert.equal(open.reason, "paused");
  const broken = evaluate(invoice({ rung: "due_date", paused_by: "promise" }), ctx(today, { open_promise: { promised_date: addDays(today, -1) } }));
  assert.equal(broken.action, "unpause_and_advance");
  assert.equal(broken.target_rung, "overdue_gentle");
});

test("broken promise at the last rung does nothing; dispute pause is not lifted by a broken promise", () => {
  assert.equal(evaluate(invoice({ rung: "odr_guidance", paused_by: "promise" }), ctx(addDays(DUE, 60), { broken_promise: true })).action, "none");
  assert.equal(evaluate(invoice({ rung: "due_date", paused_by: "dispute" }), ctx(addDays(DUE, 20), { broken_promise: true })).reason, "paused");
});

test("paid, disputed and draft invoices are never eligible", () => {
  for (const status of ["paid", "disputed", "draft"]) {
    const r = evaluate(invoice({ status, rung: "due_date" }), ctx(addDays(DUE, 20)));
    assert.equal(r.eligible, false, status);
    assert.equal(r.reason, "status", status);
    assert.equal(r.action, "none", status);
  }
});

test("auto_rungs from settings decide auto vs owner_tap; owner_action rungs never become auto", () => {
  assert.equal(evaluate(invoice(), ctx(addDays(DUE, -3), { auto_rungs: [] })).channel_policy, "owner_tap");
  assert.equal(evaluate(invoice(), ctx(addDays(DUE, 7), { auto_rungs: RUNGS })).channel_policy, "auto");
  assert.equal(evaluate(invoice(), ctx(addDays(DUE, 30), { auto_rungs: RUNGS })).channel_policy, "owner_action");
});

test("custom offsets from config drive the dates", () => {
  const offsets = { ...DEFAULT_OFFSETS, overdue_gentle: 5 };
  assert.equal(evaluate(invoice({ rung: "due_date" }), ctx(addDays(DUE, 5), { offsets })).target_rung, "overdue_gentle");
  assert.equal(evaluate(invoice({ rung: "due_date" }), ctx(addDays(DUE, 5))).action, "none");
  assert.equal(rungMeta("overdue_gentle", offsets).offset, 5);
});

test("evaluate rejects a missing or malformed today", () => {
  assert.throws(() => evaluate(invoice(), {}), TypeError);
  assert.throws(() => evaluate(invoice(), { today: "2026-13-01" }), TypeError);
});

test("rung helpers", () => {
  assert.deepEqual(RUNGS, ["heads_up", "due_date", "overdue_gentle", "overdue_firm", "demand_letter", "odr_guidance"]);
  assert.deepEqual(RUNGS.map(rungIndex), [0, 1, 2, 3, 4, 5]);
  assert.equal(rungIndex(null), -1);
  assert.deepEqual(RUNGS.map((r) => rungMeta(r).policy), ["auto", "auto", "owner_tap", "owner_tap", "owner_action", "owner_action"]);
  assert.deepEqual(RUNGS.map((r) => rungMeta(r).offset), [-3, 0, 7, 15, 30, 45]);
  assert.equal(rungMeta("overdue_firm").call_prompt, true);
  assert.equal(rungMeta("bogus"), null);
  assert.equal(daysOverdue(invoice(), "2026-10-06"), -4);
  assert.equal(daysOverdue(invoice(), "2026-11-24"), 45);
  assert.deepEqual(dueRungs(invoice(), "2026-10-06"), []);
  assert.deepEqual(dueRungs(invoice(), "2026-10-07"), ["heads_up"]);
  assert.deepEqual(dueRungs(invoice(), "2026-10-24"), ["heads_up", "due_date", "overdue_gentle"]);
  assert.deepEqual(dueRungs(invoice(), "2026-10-25"), ["heads_up", "due_date", "overdue_gentle", "overdue_firm"]);
});

test("onPromise accepts tomorrow through today+14 and rejects the rest", () => {
  const today = "2026-10-20";
  assert.deepEqual(onPromise(invoice(), "2026-10-21", today), { ok: true, error: null });
  assert.deepEqual(onPromise(invoice({ status: "part_paid" }), "2026-11-03", today), { ok: true, error: null });
  assert.equal(onPromise(invoice(), "2026-11-04", today).error.code, "date_too_far");
  assert.equal(onPromise(invoice(), "2026-10-19", today).error.code, "date_past");
  assert.equal(onPromise(invoice(), today, today).error.code, "date_past");
  assert.equal(onPromise(invoice(), "20-10-2026", today).error.code, "invalid_date");
  assert.equal(onPromise(invoice(), "2026-02-30", today).error.code, "invalid_date");
  assert.equal(onPromise(invoice({ paused_by: "promise" }), "2026-10-25", today).error.code, "promise_open");
  assert.equal(onPromise(invoice({ open_promise: { promised_date: "2026-10-22" } }), "2026-10-25", today).error.code, "promise_open");
  assert.equal(onPromise(invoice({ status: "paid" }), "2026-10-25", today).error.code, "status");
  assert.equal(onPromise(invoice(), "2026-11-10", today, 30).ok, true);
});

test("nextSteps at odr_guidance: call, lawyer, and MSME ODR only for a Udyam micro/small enterprise", () => {
  const at45 = invoice({ rung: "odr_guidance" });
  assert.deepEqual(nextSteps(at45, { udyam: true }), ["ladder.next_steps.call_customer", "ladder.next_steps.consult_lawyer", "ladder.next_steps.file_msme_odr"]);
  assert.deepEqual(nextSteps(at45, { udyam: true, msme_class: "small" }).length, 3);
  assert.deepEqual(nextSteps(at45, { udyam: true, msme_class: "medium" }), ["ladder.next_steps.call_customer", "ladder.next_steps.consult_lawyer"]);
  assert.deepEqual(nextSteps(at45, { udyam: false }), ["ladder.next_steps.call_customer", "ladder.next_steps.consult_lawyer"]);
  assert.deepEqual(nextSteps(at45), ["ladder.next_steps.call_customer", "ladder.next_steps.consult_lawyer"]);
  assert.deepEqual(nextSteps(invoice({ rung: "demand_letter" }), { udyam: true }), []);
});

test("validateOffsets requires six whole-day offsets in strictly increasing order", () => {
  assert.equal(validateOffsets(DEFAULT_OFFSETS).ok, true);
  assert.equal(validateOffsets({ ...DEFAULT_OFFSETS, overdue_firm: 7 }).ok, false);
  assert.equal(validateOffsets({ ...DEFAULT_OFFSETS, heads_up: "-3" }).ok, false);
  assert.equal(validateOffsets({ ...DEFAULT_OFFSETS, odr_guidance: 45.5 }).ok, false);
  const { odr_guidance, ...missing } = DEFAULT_OFFSETS;
  assert.equal(validateOffsets(missing).error.code, "offsets");
  assert.equal(validateOffsets(null).ok, false);
});

test("review fixes: promise pause without an open promise counts as broken; bypass needs a promise pause", () => {
  const today = addDays(DUE, 3);
  const lifted = evaluate(invoice({ rung: "due_date", paused_by: "promise" }), ctx(today));
  assert.equal(lifted.lift_pause, true);
  assert.equal(lifted.action, "unpause_and_advance");
  const noPause = evaluate(invoice({ rung: "due_date" }), ctx(today, { broken_promise: true }));
  assert.equal(noPause.lift_pause, false);
  assert.equal(noPause.reason, "nothing_due");
});

test("review fixes: nothing owed is ineligible; no new promise after a broken one", () => {
  assert.equal(evaluate(invoice({ outstanding_paise: 0 }), ctx(addDays(DUE, 10))).reason, "status");
  const r = onPromise(invoice({ had_broken_promise: true }), addDays(DUE, 5), DUE);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "promise_broken_before");
});
