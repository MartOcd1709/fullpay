import test from "node:test";
import assert from "node:assert/strict";
import {
  asPaise,
  rupeesToPaise,
  paiseToRupees,
  fmtINR,
  fmtNumberIN,
  roundToRupee,
  amountInWords,
} from "../lib/money.js";

const invalidAmount = (fn) =>
  assert.throws(fn, (err) => err instanceof RangeError && err.code === "invalid_amount");

test("asPaise returns safe integers unchanged", () => {
  for (const n of [0, 1, -5, 11800000, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
    assert.equal(asPaise(n), n);
  }
  assert.ok(Object.is(asPaise(-0), 0));
});

test("asPaise throws RangeError on floats, NaN, strings, BigInt, unsafe ints", () => {
  for (const bad of [1.5, 0.1 + 0.2, NaN, Infinity, -Infinity, "100", "", 2 ** 53, -(2 ** 53), 10n, null, undefined, {}, []]) {
    invalidAmount(() => asPaise(bad));
  }
});

test("rupeesToPaise parses typed rupees exactly once", () => {
  assert.equal(rupeesToPaise("1,18,000"), 11800000);
  assert.equal(rupeesToPaise("1,18,000.50"), 11800050);
  assert.equal(rupeesToPaise("1,18,000.5"), 11800050);
  assert.equal(rupeesToPaise("₹ 1,000"), 100000);
  assert.equal(rupeesToPaise("₹1,000"), 100000);
  assert.equal(rupeesToPaise(" 250 "), 25000);
  assert.equal(rupeesToPaise("250."), 25000);
  assert.equal(rupeesToPaise(".5"), 50);
  assert.equal(rupeesToPaise("0"), 0);
  assert.equal(rupeesToPaise("0.01"), 1);
  assert.equal(rupeesToPaise("118000"), 11800000);
  assert.equal(rupeesToPaise("118,000"), 11800000);
  assert.equal(rupeesToPaise("Rs. 1,000/-"), 100000);
  assert.equal(rupeesToPaise("INR 1,000"), 100000);
  assert.equal(rupeesToPaise(1180.5), 118050);
  assert.equal(rupeesToPaise(118000), 11800000);
  assert.equal(rupeesToPaise("12,34,56,789.99"), 12345678999);
});

test("rupeesToPaise rejects three decimals, letters, junk, floats with artefacts", () => {
  for (const bad of ["1.005", "1,18,000.505", "abc", "12abc", "1e5", "1 000", "", "₹", ",", ".", "1..5", "1.5.5", "--5", "0x10", 0.1 + 0.2, NaN, Infinity, null, undefined, 1e21]) {
    invalidAmount(() => rupeesToPaise(bad));
  }
});

test("rupeesToPaise negatives only with allowNegative", () => {
  invalidAmount(() => rupeesToPaise("-100"));
  invalidAmount(() => rupeesToPaise("₹-100"));
  assert.equal(rupeesToPaise("-100", { allowNegative: true }), -10000);
  assert.equal(rupeesToPaise("₹ -1,000.25", { allowNegative: true }), -100025);
  assert.ok(Object.is(rupeesToPaise("-0", { allowNegative: true }), 0));
});

test("rupeesToPaise rejects amounts beyond safe integer paise", () => {
  invalidAmount(() => rupeesToPaise("99999999999999999"));
  invalidAmount(() => rupeesToPaise("90071992547409.92"));
  assert.equal(rupeesToPaise("90071992547409.91"), 9007199254740991);
});

test("paiseToRupees splits into rupee and paise parts", () => {
  assert.deepEqual(paiseToRupees(11800050), { negative: false, rupees: 118000, paise: 50 });
  assert.deepEqual(paiseToRupees(0), { negative: false, rupees: 0, paise: 0 });
  assert.deepEqual(paiseToRupees(99), { negative: false, rupees: 0, paise: 99 });
  assert.deepEqual(paiseToRupees(100), { negative: false, rupees: 1, paise: 0 });
  assert.deepEqual(paiseToRupees(-11800050), { negative: true, rupees: 118000, paise: 50 });
  assert.deepEqual(paiseToRupees(-50), { negative: true, rupees: 0, paise: 50 });
  invalidAmount(() => paiseToRupees(1.5));
});

test("fmtINR pins Node 22 Intl en-IN INR output", () => {
  assert.equal(fmtINR(11800000), "₹1,18,000.00");
  assert.equal(fmtINR(11800050), "₹1,18,000.50");
  assert.equal(fmtINR(0), "₹0.00");
  assert.equal(fmtINR(1), "₹0.01");
  assert.equal(fmtINR(10000000), "₹1,00,000.00");
  assert.equal(fmtINR(1234567890), "₹1,23,45,678.90");
  assert.equal(fmtINR(1000000000), "₹1,00,00,000.00");
  assert.equal(fmtINR(10000000000), "₹10,00,00,000.00");
  assert.equal(fmtINR(99999999999999), "₹9,99,99,99,99,999.99");
  assert.equal(fmtINR(-11800050), "-₹1,18,000.50");
  assert.equal(fmtINR(-0), "₹0.00");
});

test("fmtINR without paise rounds half-up to the rupee", () => {
  assert.equal(fmtINR(11800000, { paise: false }), "₹1,18,000");
  assert.equal(fmtINR(11800049, { paise: false }), "₹1,18,000");
  assert.equal(fmtINR(11800050, { paise: false }), "₹1,18,001");
  assert.equal(fmtINR(0, { paise: false }), "₹0");
  assert.equal(fmtINR(10000000000, { paise: false }), "₹10,00,00,000");
  assert.equal(fmtINR(11800000, { paise: true }), "₹1,18,000.00");
});

test("fmtINR rejects non-paise input", () => {
  invalidAmount(() => fmtINR(118000.5));
  invalidAmount(() => fmtINR("11800000"));
  invalidAmount(() => fmtINR(NaN));
});

test("fmtNumberIN uses Indian grouping", () => {
  assert.equal(fmtNumberIN(118000), "1,18,000");
  assert.equal(fmtNumberIN(12345678), "1,23,45,678");
  assert.equal(fmtNumberIN(100), "100");
  assert.equal(fmtNumberIN(1000), "1,000");
  assert.equal(fmtNumberIN(0), "0");
  assert.equal(fmtNumberIN(-0), "0");
  assert.equal(fmtNumberIN(2.5), "2.5");
  assert.equal(fmtNumberIN(-118000), "-1,18,000");
  invalidAmount(() => fmtNumberIN(NaN));
  invalidAmount(() => fmtNumberIN("118000"));
});

test("roundToRupee rounds half-up with a signed round-off", () => {
  assert.deepEqual(roundToRupee(123449), { rounded_paise: 123400, round_off_paise: -49 });
  assert.deepEqual(roundToRupee(123450), { rounded_paise: 123500, round_off_paise: 50 });
  assert.deepEqual(roundToRupee(123451), { rounded_paise: 123500, round_off_paise: 49 });
  assert.deepEqual(roundToRupee(123456), { rounded_paise: 123500, round_off_paise: 44 });
  assert.deepEqual(roundToRupee(123400), { rounded_paise: 123400, round_off_paise: 0 });
  assert.deepEqual(roundToRupee(0), { rounded_paise: 0, round_off_paise: 0 });
  assert.deepEqual(roundToRupee(49), { rounded_paise: 0, round_off_paise: -49 });
  assert.deepEqual(roundToRupee(50), { rounded_paise: 100, round_off_paise: 50 });
  assert.deepEqual(roundToRupee(1180000), { rounded_paise: 1180000, round_off_paise: 0 });
});

test("roundToRupee on negative amounts rounds half toward +infinity (Math.round semantics)", () => {
  assert.deepEqual(roundToRupee(-123449), { rounded_paise: -123400, round_off_paise: 49 });
  assert.deepEqual(roundToRupee(-123450), { rounded_paise: -123400, round_off_paise: 50 });
  assert.deepEqual(roundToRupee(-123451), { rounded_paise: -123500, round_off_paise: -49 });
  invalidAmount(() => roundToRupee(1234.5));
});

test("amountInWords gives the Indian cheque form in English", () => {
  assert.equal(amountInWords(11800000), "Rupees One Lakh Eighteen Thousand Only");
  assert.equal(amountInWords(10000050), "Rupees One Lakh and Fifty Paise Only");
  assert.equal(amountInWords(11800050), "Rupees One Lakh Eighteen Thousand and Fifty Paise Only");
  assert.equal(amountInWords(0), "Rupees Zero Only");
  assert.equal(amountInWords(100), "Rupees One Only");
  assert.equal(amountInWords(1), "Rupees Zero and One Paisa Only");
  assert.equal(amountInWords(101), "Rupees One and One Paisa Only");
  assert.equal(amountInWords(1180000), "Rupees Eleven Thousand Eight Hundred Only");
  assert.equal(amountInWords(1000000000), "Rupees One Crore Only");
  assert.equal(amountInWords(10000000000), "Rupees Ten Crore Only");
  assert.equal(
    amountInWords(1234567800),
    "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
  );
  assert.equal(
    amountInWords(123456789012),
    "Rupees One Hundred Twenty Three Crore Forty Five Lakh Sixty Seven Thousand Eight Hundred Ninety and Twelve Paise Only",
  );
  assert.equal(amountInWords(100000000000000), "Rupees One Lakh Crore Only");
});

test("amountInWords in Hindi uses the to-words hi-IN number words", () => {
  assert.equal(amountInWords(11800000, "hi"), "रुपये एक लाख अठारह हज़ार मात्र");
  assert.equal(amountInWords(11800050, "hi"), "रुपये एक लाख अठारह हज़ार और पचास पैसे मात्र");
  assert.equal(amountInWords(0, "hi"), "रुपये शून्य मात्र");
  assert.equal(amountInWords(1000000000, "hi"), "रुपये एक करोड़ मात्र");
  assert.equal(amountInWords(101, "hi"), "रुपये एक और एक पैसा मात्र");
});

test("amountInWords falls back to English for unknown languages and rejects bad input", () => {
  assert.equal(amountInWords(11800000, "ta"), "Rupees One Lakh Eighteen Thousand Only");
  assert.equal(amountInWords(11800000, undefined), "Rupees One Lakh Eighteen Thousand Only");
  invalidAmount(() => amountInWords(-100));
  invalidAmount(() => amountInWords(118000.5));
  invalidAmount(() => amountInWords("11800000"));
});

test("round-off, formatted total and words agree (pack: ₹10,000 @ 18% = ₹11,800)", () => {
  const { rounded_paise, round_off_paise } = roundToRupee(1180049);
  assert.equal(round_off_paise, -49);
  assert.equal(fmtINR(rounded_paise), "₹11,800.00");
  assert.equal(fmtINR(rounded_paise, { paise: false }), "₹11,800");
  assert.equal(amountInWords(rounded_paise), "Rupees Eleven Thousand Eight Hundred Only");
  assert.equal(rupeesToPaise(fmtINR(rounded_paise)), rounded_paise);
});

test("review fixes: exact formatting near 2^53, prototype-key lang, long input rejected fast", () => {
  assert.equal(fmtINR(Number.MAX_SAFE_INTEGER), "₹9,00,71,99,25,47,409.91");
  assert.equal(fmtINR(-49), "-₹0.49");
  assert.equal(amountInWords(11800000, "constructor"), "Rupees One Lakh Eighteen Thousand Only");
  const t0 = performance.now();
  invalidAmount(() => rupeesToPaise("1" + " ".repeat(100000) + "x"));
  assert.ok(performance.now() - t0 < 50);
});
