import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  initTime,
  today,
  isISODate,
  parseISO,
  toISO,
  addDays,
  addMonths,
  dayAfter,
  daysBetween,
  compareISO,
  maxISO,
  minISO,
  fyOf,
  fyRange,
  monthlyRests,
  formatDate,
  formatDDMMYYYY,
  nowISOTimestamp,
} from "../lib/time.js";

function atInstant(utcMs, fn) {
  mock.timers.enable({ apis: ["Date"], now: utcMs });
  try {
    return fn();
  } finally {
    mock.timers.reset();
  }
}

test("isISODate accepts real calendar dates only", () => {
  assert.equal(isISODate("2026-10-12"), true);
  assert.equal(isISODate("2024-02-29"), true);
  assert.equal(isISODate("2023-02-29"), false);
  assert.equal(isISODate("2026-02-30"), false);
  assert.equal(isISODate("2026-13-01"), false);
  assert.equal(isISODate("2026-00-10"), false);
  assert.equal(isISODate("2026-1-5"), false);
  assert.equal(isISODate("12/10/2026"), false);
  assert.equal(isISODate("2026-10-12T00:00:00Z"), false);
  assert.equal(isISODate(null), false);
  assert.equal(isISODate(20261012), false);
});

test("parseISO and toISO round-trip and reject invalid input", () => {
  assert.deepEqual(parseISO("2026-04-01"), { y: 2026, m: 4, d: 1 });
  assert.equal(toISO(2026, 4, 1), "2026-04-01");
  assert.equal(toISO(2024, 2, 29), "2024-02-29");
  assert.throws(() => parseISO("2026-02-30"), RangeError);
  assert.throws(() => parseISO(undefined), RangeError);
  assert.throws(() => toISO(2023, 2, 29), RangeError);
});

test("addDays crosses month ends, year ends and leap days", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  assert.equal(addDays("2023-02-28", 1), "2023-03-01");
  assert.equal(addDays("2024-02-29", 365), "2025-02-28");
  assert.equal(addDays("2024-02-29", 366), "2025-03-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-10-12", 0), "2026-10-12");
  assert.equal(dayAfter("2026-02-28"), "2026-03-01");
  assert.throws(() => addDays("2026-10-12", 1.5), RangeError);
});

test("addMonths clamps to the month end in both directions", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(addMonths("2026-05-31", -1), "2026-04-30");
  assert.equal(addMonths("2026-05-31", 1), "2026-06-30");
  assert.equal(addMonths("2026-08-31", 1), "2026-09-30");
  assert.equal(addMonths("2026-10-31", 4), "2027-02-28");
  assert.equal(addMonths("2026-12-31", 2), "2027-02-28");
  assert.equal(addMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(addMonths("2024-02-29", 48), "2028-02-29");
  assert.equal(addMonths("2024-02-29", -12), "2023-02-28");
  assert.equal(addMonths("2026-01-15", -13), "2024-12-15");
  assert.equal(addMonths("2026-01-15", 0), "2026-01-15");
  assert.equal(addMonths("2026-01-15", 11), "2026-12-15");
  assert.equal(addMonths("2026-01-15", 12), "2027-01-15");
  assert.throws(() => addMonths("2026-01-15", "1"), RangeError);
});

test("daysBetween counts whole days, negative allowed", () => {
  assert.equal(daysBetween("2026-01-31", "2026-02-01"), 1);
  assert.equal(daysBetween("2025-12-31", "2026-01-01"), 1);
  assert.equal(daysBetween("2024-01-01", "2025-01-01"), 366);
  assert.equal(daysBetween("2025-01-01", "2026-01-01"), 365);
  assert.equal(daysBetween("2026-04-01", "2027-03-31"), 364);
  assert.equal(daysBetween("2026-02-01", "2026-01-31"), -1);
  assert.equal(daysBetween("2026-10-12", "2026-10-12"), 0);
  assert.equal(daysBetween("2026-09-12", "2026-10-19"), 37);
});

test("compareISO, maxISO and minISO", () => {
  assert.equal(compareISO("2026-01-31", "2026-02-01"), -1);
  assert.equal(compareISO("2026-02-01", "2026-01-31"), 1);
  assert.equal(compareISO("2026-02-01", "2026-02-01"), 0);
  assert.equal(compareISO("2025-12-31", "2026-01-01"), -1);
  assert.throws(() => compareISO("2026-02-01T00:00:00Z", "2026-02-01"), RangeError);
  assert.equal(maxISO("2026-01-31", "2026-02-01", "2025-12-31"), "2026-02-01");
  assert.equal(minISO("2026-01-31", "2026-02-01", "2025-12-31"), "2025-12-31");
  assert.equal(maxISO(null, "2026-02-01", undefined), "2026-02-01");
  assert.equal(maxISO(), undefined);
  assert.equal(minISO(null), undefined);
});

test("fyOf follows the April-March Indian financial year", () => {
  assert.equal(fyOf("2026-03-31"), "25-26");
  assert.equal(fyOf("2026-04-01"), "26-27");
  assert.equal(fyOf("2027-03-31"), "26-27");
  assert.equal(fyOf("2027-04-01"), "27-28");
  assert.equal(fyOf("2024-02-29"), "23-24");
  assert.equal(fyOf("2026-10-23"), "26-27");
  assert.equal(fyOf("2099-04-01"), "99-00");
  assert.equal(fyOf("2000-01-01"), "99-00");
});

test("fyRange gives the FY bounds and rejects malformed input", () => {
  assert.deepEqual(fyRange("26-27"), { start: "2026-04-01", end: "2027-03-31" });
  assert.deepEqual(fyRange("23-24"), { start: "2023-04-01", end: "2024-03-31" });
  assert.deepEqual(fyRange("99-00"), { start: "2099-04-01", end: "2100-03-31" });
  assert.equal(fyOf(fyRange("26-27").start), "26-27");
  assert.equal(fyOf(fyRange("26-27").end), "26-27");
  assert.throws(() => fyRange("26-28"), RangeError);
  assert.throws(() => fyRange("2026-27"), RangeError);
  assert.throws(() => fyRange("0042"), RangeError);
  assert.throws(() => fyRange(null), RangeError);
});

test("monthlyRests from a 31st clamps each rest from the original date", () => {
  assert.deepEqual(monthlyRests("2026-01-31", "2026-06-15"), ["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  assert.deepEqual(monthlyRests("2024-01-31", "2024-04-30"), ["2024-02-29", "2024-03-31", "2024-04-30"]);
  assert.deepEqual(monthlyRests("2026-10-12", "2027-01-11"), ["2026-11-12", "2026-12-12"]);
  assert.deepEqual(monthlyRests("2026-10-12", "2026-11-12"), ["2026-11-12"]);
  assert.deepEqual(monthlyRests("2026-10-12", "2026-11-11"), []);
  assert.deepEqual(monthlyRests("2026-10-12", "2026-10-12"), []);
  assert.deepEqual(monthlyRests("2026-10-12", "2026-01-01"), []);
});

test("today() uses fixedToday when set, ignoring the offset", () => {
  try {
    initTime({ fixedToday: "2026-11-22" });
    assert.equal(today(), "2026-11-22");
    initTime({ fixedToday: "2026-11-22", demoOffsetDays: 5 });
    assert.equal(today(), "2026-11-22");
  } finally {
    initTime();
  }
});

test("today() is the IST calendar date, flipping at 18:30 UTC, plus the demo offset", () => {
  try {
    initTime();
    assert.equal(atInstant(Date.UTC(2026, 9, 23, 5, 0, 0), today), "2026-10-23");
    assert.equal(atInstant(Date.UTC(2026, 0, 31, 18, 29, 59, 999), today), "2026-01-31");
    assert.equal(atInstant(Date.UTC(2026, 0, 31, 18, 30, 0), today), "2026-02-01");
    assert.equal(atInstant(Date.UTC(2026, 11, 31, 18, 30, 0), today), "2027-01-01");
    assert.equal(atInstant(Date.UTC(2024, 1, 28, 18, 30, 0), today), "2024-02-29");
    initTime({ demoOffsetDays: 30 });
    assert.equal(atInstant(Date.UTC(2026, 9, 23, 5, 0, 0), today), "2026-11-22");
    initTime({ demoOffsetDays: -1 });
    assert.equal(atInstant(Date.UTC(2026, 0, 31, 18, 30, 0), today), "2026-01-31");
  } finally {
    initTime();
  }
});

test("today() without initTime is the real IST date", () => {
  initTime();
  assert.equal(isISODate(today()), true);
});

test("initTime validates its inputs", () => {
  assert.throws(() => initTime({ fixedToday: "2026-02-30" }), RangeError);
  assert.throws(() => initTime({ fixedToday: "22/11/2026" }), RangeError);
  assert.throws(() => initTime({ demoOffsetDays: 1.5 }), RangeError);
  assert.throws(() => initTime({ demoOffsetDays: "30" }), RangeError);
  assert.doesNotThrow(() => initTime({ fixedToday: undefined, demoOffsetDays: 0 }));
  initTime();
});

test("formatDate renders en-IN and Hindi month names without zero padding", () => {
  assert.equal(formatDate("2026-10-12"), "12 Oct 2026");
  assert.equal(formatDate("2026-10-12", "en"), "12 Oct 2026");
  assert.equal(formatDate("2026-01-05"), "5 Jan 2026");
  assert.equal(formatDate("2024-02-29"), "29 Feb 2024");
  assert.equal(formatDate("2026-10-12", "hi"), "12 अक्टूबर 2026");
  assert.equal(formatDate("2026-02-05", "hi"), "5 फ़रवरी 2026");
  assert.equal(formatDate("2026-10-12", "fr"), "12 Oct 2026");
  assert.throws(() => formatDate("2026-02-30"), RangeError);
});

test("formatDDMMYYYY is the e-invoice date shape", () => {
  assert.equal(formatDDMMYYYY("2026-10-12"), "12/10/2026");
  assert.equal(formatDDMMYYYY("2026-01-05"), "05/01/2026");
  assert.throws(() => formatDDMMYYYY("2026-13-05"), RangeError);
});

test("nowISOTimestamp is the real UTC instant, unaffected by the demo clock", () => {
  assert.match(nowISOTimestamp(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  try {
    initTime({ fixedToday: "2026-11-22" });
    const stamp = atInstant(Date.UTC(2026, 9, 23, 5, 0, 0), nowISOTimestamp);
    assert.equal(stamp, "2026-10-23T05:00:00.000Z");
  } finally {
    initTime();
  }
});

test("review fixes: initTime accepts the config shape; formatDate ignores prototype keys", () => {
  initTime({ demo: { clock_date: "2026-11-09" } });
  assert.equal(today(), "2026-11-09");
  initTime();
  assert.equal(formatDate("2026-10-12", "__proto__"), formatDate("2026-10-12", "en"));
});
