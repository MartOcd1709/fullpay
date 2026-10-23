import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { parseBankCsv, normalizeName, extractInvoiceRefs, dedupeHash, matchCredits } from "../lib/recon.js";

const FIXTURE = fs.readFileSync(new URL("./fixtures/bank-statement.sample.csv", import.meta.url), "utf8");
const FYS = ["26-27", "25-26"];
const TDS_REASON = "Possibly TDS deducted: ask the customer for the TDS certificate";

const customers = [
  { id: 1, name: "M/s Acme Pvt. Ltd." },
  { id: 2, name: "Bharat Steel Works LLP" },
  { id: 3, name: "Sharma Packaging Industries" },
  { id: 4, name: "Gupta & Co." },
  { id: 5, name: "Kapoor Traders" },
];

const inv = (id, customer_id, seq, taxable, due_date, extra = {}) => ({
  id,
  number: seq == null ? null : `INV/26-27/${String(seq).padStart(4, "0")}`,
  fy: "26-27",
  seq,
  customer_id,
  taxable_paise: taxable,
  total_paise: Math.round(taxable * 1.18),
  outstanding_paise: Math.round(taxable * 1.18),
  due_date,
  status: "sent",
  ...extra,
});

const invoices = [
  inv(3, 1, 3, 5000000, "2026-08-01", { outstanding_paise: 0, status: "paid" }),
  inv(7, 1, 7, 10000000, "2026-09-15"),
  inv(12, 1, 12, 5000000, "2026-09-30"),
  inv(13, 1, 13, 2500000, "2026-10-05"),
  inv(9, 2, 9, 20000000, "2026-09-20"),
  inv(21, 3, 21, 15000000, "2026-10-01"),
  inv(18, 4, 18, 2000000, "2026-10-10"),
  inv(40, 2, null, 1000000, "2026-11-01", { status: "draft" }),
];

const credit = (narration, credit_paise, extra = {}) => ({
  line: 1,
  date: "2026-10-20",
  narration,
  reference: "REF1",
  debit_paise: 0,
  credit_paise,
  balance_paise: null,
  ...extra,
});
const matchOne = (c, invs = invoices) => matchCredits([c], invs, customers, { fys: FYS })[0];

test("fixture: header found after junk lines, rows and skipped reasons", () => {
  const { rows, skipped } = parseBankCsv(FIXTURE);
  assert.deepEqual(skipped, [
    { line: 1, reason: "before_header" },
    { line: 2, reason: "before_header" },
    { line: 4, reason: "opening_balance" },
    { line: 12, reason: "bad_amount" },
  ]);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0], {
    line: 5,
    date: "2026-10-03",
    narration: "UPI/528311234567/INV 26-27 0007/acme@okaxis",
    reference: "0000528311234567",
    debit_paise: 0,
    credit_paise: 11800000,
    balance_paise: 53800000,
  });
  assert.equal(rows[1].debit_paise, 8500000);
  assert.equal(rows[1].credit_paise, 0);
  assert.equal(rows.filter((r) => r.credit_paise > 0).length, 6);
  assert.ok(rows.every((r) => Number.isInteger(r.credit_paise) && Number.isInteger(r.debit_paise)));
});

test("header synonyms, date formats, Cr suffix, spaces and a missing debit column", () => {
  const csv = [
    "﻿Txn Date,Transaction Remarks,Ref No,Debit Amount,Credit Amount,Balance",
    "03-10-2026,ICICI style,R1,,\"1,18,000.00 Cr\",\"5,38,000.00 Cr\"",
    "2026-10-04,ISO date,R2,500.5,,\"5,37,499.50\"",
    "",
    "05/10/2026,four digit year,R3,, 2 500 , 5 39 999.50",
    "31/13/26,impossible month,R4,,100.00,",
    "garbage line without a date,,,,100.00,",
    "06/10/26,missing cells",
  ].join("\r\n");
  const { rows, skipped } = parseBankCsv(csv);
  assert.deepEqual(
    rows.map((r) => [r.line, r.date, r.debit_paise, r.credit_paise, r.balance_paise, r.reference]),
    [
      [2, "2026-10-03", 0, 11800000, 53800000, "R1"],
      [3, "2026-10-04", 50050, 0, 53749950, "R2"],
      [5, "2026-10-05", 0, 250000, 53999950, "R3"],
    ],
  );
  assert.deepEqual(skipped, [
    { line: 6, reason: "bad_date" },
    { line: 7, reason: "bad_date" },
    { line: 8, reason: "bad_amount" },
  ]);

  const creditOnly = parseBankCsv("Value Date|Particulars|Chq/Ref Number|Deposit\n01/10/26|Cash|C1|1000\n");
  assert.deepEqual(creditOnly.rows, [
    { line: 2, date: "2026-10-01", narration: "Cash", reference: "C1", debit_paise: 0, credit_paise: 100000, balance_paise: null },
  ]);
});

test("no header row throws a coded error", () => {
  assert.throws(() => parseBankCsv("just,some,cells\n1,2,3\n"), (e) => e.code === "no_header");
});

test("normalizeName strips business suffixes and punctuation, twice", () => {
  assert.equal(normalizeName("M/s Acme Pvt. Ltd."), "acme");
  assert.equal(normalizeName("ACME PRIVATE LIMITED"), "acme");
  assert.equal(normalizeName("Acme Pvt. Ltd. Ltd."), "acme");
  assert.equal(normalizeName("Gupta & Co."), "gupta");
  assert.equal(normalizeName("Messrs. Sharma and Company"), "sharma");
  assert.equal(normalizeName("Bharat   Steel-Works LLP"), "bharat steel works");
  assert.equal(normalizeName("Arora Auto Components OPC"), "arora auto components");
  assert.equal(normalizeName(""), "");
});

test("extractInvoiceRefs tolerates separators and only accepts known FYs", () => {
  for (const n of ["INV/26-27/0012", "INV 26-27 12", "INV-26-27-0012", "inv2627 0012", "INV 0012", "Invoice No. 0012"]) {
    assert.deepEqual(extractInvoiceRefs(n, FYS), [{ fy: "26-27", seq: 12 }], n);
  }
  assert.deepEqual(extractInvoiceRefs("INV/25-26/0101", FYS), [{ fy: "25-26", seq: 101 }]);
  assert.deepEqual(extractInvoiceRefs("INV/24-25/0012", FYS), []);
  assert.deepEqual(extractInvoiceRefs("Payment 0012 towards goods", FYS), [{ fy: "26-27", seq: 12 }]);
  assert.deepEqual(extractInvoiceRefs("INV/26-27/0012 ref 0099", FYS), [{ fy: "26-27", seq: 12 }]);
  assert.deepEqual(extractInvoiceRefs("23/10/26 payment on 2026-10-23", FYS), []);
  assert.deepEqual(extractInvoiceRefs("26-27", FYS), []);
  assert.deepEqual(extractInvoiceRefs("UPI/528311234567/acme@okaxis", FYS), []);
  assert.deepEqual(extractInvoiceRefs("INV/26-27/0013 then INV 26-27 0012 and INV/26-27/0013 again", FYS), [
    { fy: "26-27", seq: 13 },
    { fy: "26-27", seq: 12 },
  ]);
  assert.deepEqual(extractInvoiceRefs("INV 0012", []), []);
});

test("dedupeHash is stable, keyed on date|amount|reference", () => {
  const row = { date: "2026-10-03", credit_paise: 11800000, reference: "0000528311234567", narration: "x" };
  const expected = createHash("sha256").update("2026-10-03|11800000|0000528311234567").digest("hex");
  assert.equal(dedupeHash(row), expected);
  assert.equal(dedupeHash({ ...row, narration: "different narration" }), expected);
  assert.notEqual(dedupeHash({ ...row, reference: "other" }), expected);
  assert.notEqual(dedupeHash({ ...row, credit_paise: 11800001 }), expected);
  assert.equal(dedupeHash({ ...row, reference: null }), createHash("sha256").update("2026-10-03|11800000|").digest("hex"));
  const hashes = parseBankCsv(FIXTURE).rows.map(dedupeHash);
  assert.equal(new Set(hashes).size, hashes.length);
  assert.deepEqual(parseBankCsv(FIXTURE).rows.map(dedupeHash), hashes);
});

test("fixture: the six pack cases plus the debit row", () => {
  const { rows } = parseBankCsv(FIXTURE);
  const out = matchCredits(rows, invoices, customers, { fys: FYS, today: "2026-10-23" });
  assert.equal(out.length, 7);
  const [exact, debit, part, multi, tds, over, unknown] = out;

  assert.equal(exact.customer_id, 1);
  assert.deepEqual(exact.matches, [{ invoice_id: 7, amount_paise: 11800000 }]);
  assert.deepEqual([exact.confidence, exact.flags], [95, []]);
  assert.match(exact.reason, /INV\/26-27\/0007/);

  assert.deepEqual([debit.customer_id, debit.matches, debit.confidence, debit.flags], [null, [], 0, ["debit"]]);
  assert.equal(debit.credit, rows[1]);

  assert.equal(part.customer_id, 2);
  assert.deepEqual(part.matches, [{ invoice_id: 9, amount_paise: 10000000 }]);
  assert.deepEqual([part.confidence, part.flags], [70, ["part"]]);
  assert.match(part.reason, /Bharat Steel Works LLP/);

  assert.equal(multi.customer_id, 1);
  assert.deepEqual(multi.matches, [
    { invoice_id: 12, amount_paise: 5900000 },
    { invoice_id: 13, amount_paise: 2950000 },
  ]);
  assert.deepEqual([multi.confidence, multi.flags], [95, ["multi"]]);

  assert.equal(tds.customer_id, 3);
  assert.deepEqual(tds.matches, [{ invoice_id: 21, amount_paise: 17400000 }]);
  assert.deepEqual([tds.confidence, tds.flags, tds.reason], [70, ["tds_2"], TDS_REASON]);

  assert.equal(over.customer_id, 4);
  assert.deepEqual(over.matches, [{ invoice_id: 18, amount_paise: 2360000 }]);
  assert.deepEqual([over.confidence, over.flags], [70, ["overpaid"]]);

  assert.deepEqual([unknown.customer_id, unknown.matches, unknown.confidence, unknown.flags], [null, [], 0, ["unmatched"]]);
});

test("TDS: 1% and 10% of the taxable value, by name and by invoice number", () => {
  const byName = matchOne(credit("NEFT CR-ICIC0004567-SHARMA PACKAGING INDUSTRIES", 17700000 - 150000));
  assert.deepEqual([byName.flags, byName.confidence, byName.matches], [["tds_1"], 70, [{ invoice_id: 21, amount_paise: 17550000 }]]);
  const byRef = matchOne(credit("NEFT CR-SHARMA-INV/26-27/0021", 17700000 - 1500000));
  assert.deepEqual([byRef.flags, byRef.confidence, byRef.reason], [["tds_10"], 95, TDS_REASON]);
  assert.deepEqual(byRef.matches, [{ invoice_id: 21, amount_paise: 16200000 }]);
  const notTds = matchOne(credit("NEFT CR-ICIC0004567-SHARMA PACKAGING INDUSTRIES", 17700000 - 150150));
  assert.deepEqual(notTds.flags, ["part"]);
});

test("outstanding, not total, is what a payment is compared against", () => {
  const partPaid = invoices.map((i) => (i.id === 9 ? { ...i, outstanding_paise: 13600000, status: "part_paid" } : i));
  const r = matchOne(credit("NEFT CR-SBIN0001234-BHARAT STEEL WORKS LLP", 13600000), partPaid);
  assert.deepEqual([r.customer_id, r.confidence, r.flags], [2, 85, []]);
  assert.deepEqual(r.matches, [{ invoice_id: 9, amount_paise: 13600000 }]);
  const byTotal = matchOne(credit("NEFT CR-SBIN0001234-BHARAT STEEL WORKS LLP", 23600000), partPaid);
  assert.deepEqual(byTotal.flags, ["overpaid"]);
  assert.deepEqual(byTotal.matches, [{ invoice_id: 9, amount_paise: 13600000 }]);
});

test("±100 paise counts as exact and never over-allocates", () => {
  const under = matchOne(credit("UPI/1/INV 26-27 0007/acme@okaxis", 11800000 - 50));
  assert.deepEqual([under.flags, under.confidence, under.matches], [[], 95, [{ invoice_id: 7, amount_paise: 11799950 }]]);
  const over = matchOne(credit("NEFT CR-HDFC-ACME PVT LTD-OCT", 11800000 + 50));
  assert.deepEqual([over.flags, over.confidence, over.matches], [[], 85, [{ invoice_id: 7, amount_paise: 11800000 }]]);
});

test("name match: several invoices, oldest first", () => {
  const multi = matchOne(credit("NEFT CR-HDFC-ACME PVT LTD-OCT", 11800000 + 5900000));
  assert.deepEqual([multi.customer_id, multi.confidence, multi.flags], [1, 75, ["multi"]]);
  assert.deepEqual(multi.matches, [
    { invoice_id: 7, amount_paise: 11800000 },
    { invoice_id: 12, amount_paise: 5900000 },
  ]);
  const greedy = matchOne(credit("NEFT CR-HDFC-ACME PVT LTD-OCT", 15000000));
  assert.deepEqual([greedy.confidence, greedy.flags], [40, ["multi", "part"]]);
  assert.deepEqual(greedy.matches, [
    { invoice_id: 7, amount_paise: 11800000 },
    { invoice_id: 12, amount_paise: 3200000 },
  ]);
  assert.match(greedy.reason, /INV\/26-27\/0012 part paid/);
  const everything = matchOne(credit("NEFT CR-HDFC-ACME PVT LTD-OCT", 30000000));
  assert.deepEqual([everything.confidence, everything.flags], [75, ["multi", "overpaid"]]);
  assert.equal(everything.matches.reduce((a, m) => a + m.amount_paise, 0), 11800000 + 5900000 + 2950000);
});

test("invoice number named: remainder spills oldest first; a paid invoice drops confidence", () => {
  const spill = matchOne(credit("NEFT CR-HDFC-ACME PVT LTD-INV/26-27/0013", 2950000 + 5900000));
  assert.deepEqual([spill.confidence, spill.flags], [95, ["multi", "part"]]);
  assert.deepEqual(spill.matches, [
    { invoice_id: 13, amount_paise: 2950000 },
    { invoice_id: 7, amount_paise: 5900000 },
  ]);
  const paid = matchOne(credit("NEFT CR-HDFC-ACME-INV/26-27/0003", 5900000));
  assert.deepEqual([paid.customer_id, paid.confidence, paid.flags], [1, 40, ["part"]]);
  assert.match(paid.reason, /already paid/);
  const unknownRef = matchOne(credit("UPI/1/INV 26-27 0999/someone@upi", 5000));
  assert.deepEqual([unknownRef.customer_id, unknownRef.flags], [null, ["unmatched"]]);
});

test("name match with nothing open, drafts ignored, fuzzy spelling, fys from today", () => {
  const none = matchOne(credit("NEFT CR-PUNB0005678-KAPOOR TRADERS-ADVANCE", 2500000));
  assert.deepEqual([none.customer_id, none.matches, none.confidence, none.flags], [5, [], 40, ["unmatched"]]);
  const draftOnly = matchOne(credit("NEFT CR-BHARAT STEEL WORKS", 1000000), invoices.filter((i) => i.id !== 9));
  assert.deepEqual([draftOnly.customer_id, draftOnly.matches, draftOnly.flags], [2, [], ["unmatched"]]);
  const fuzzy = matchOne(credit("IMPS-BHARAT STEELS WORKS-OCT", 23600000));
  assert.deepEqual([fuzzy.customer_id, fuzzy.confidence], [2, 85]);
  const stranger = matchOne(credit("UPI/510912345678/Payment/ravi.kumar@ybl", 15000000));
  assert.equal(stranger.customer_id, null);
  const [viaToday] = matchCredits([credit("INV 26-27 0007", 11800000)], invoices, customers, { today: "2026-10-23" });
  assert.deepEqual(viaToday.matches, [{ invoice_id: 7, amount_paise: 11800000 }]);
});

test("matchCredits is pure: inputs are not mutated", () => {
  const { rows } = parseBankCsv(FIXTURE);
  const before = JSON.stringify([rows, invoices, customers]);
  matchCredits(rows, invoices, customers, { fys: FYS });
  assert.equal(JSON.stringify([rows, invoices, customers]), before);
});

test("amount cells: '-' placeholder, unsafe size, Cr/Dr on the wrong side, debit and credit on one row", () => {
  const h = "Date,Narration,Ref,Withdrawal Amt.,Deposit Amt.,Closing Balance\n";
  const csv = [
    '01/10/26,dash debit,R1,-,"1,18,000.5","5,000.00 Dr"',
    "01/10/26,too big,R2,,99999999999999999,",
    '01/10/26,Dr in credit column,R3,,"1,000.00 Dr",',
    '01/10/26,Cr in debit column,R4,"1,000.00 Cr",,',
    "01/10/26,both sides,R5,500.00,1000.00,",
    '01/10/26,rupee sign,R6,,"₹2,500",',
  ].join("\n");
  const { rows, skipped } = parseBankCsv(h + csv);
  assert.deepEqual(
    rows.map((r) => [r.line, r.debit_paise, r.credit_paise, r.balance_paise]),
    [
      [2, 0, 11800050, null],
      [7, 0, 250000, null],
    ],
  );
  assert.deepEqual(skipped, [
    { line: 3, reason: "bad_amount" },
    { line: 4, reason: "bad_amount" },
    { line: 5, reason: "bad_amount" },
    { line: 6, reason: "debit_and_credit" },
  ]);
});

test("dedupeHash: identical rows in one file stay distinct, re-import is stable", () => {
  const csv = "Date,Narration,Ref,Deposit\n05/10/26,CASH DEP,,10000\n05/10/26,CASH DEP,,10000\n05/10/26,UPI,U1,10000\n05/10/26,UPI,U2,10000\n";
  const hashes = parseBankCsv(csv).rows.map(dedupeHash);
  assert.equal(new Set(hashes).size, 4);
  assert.equal(hashes[0], createHash("sha256").update("2026-10-05|1000000|").digest("hex"));
  assert.deepEqual(parseBankCsv(csv).rows.map(dedupeHash), hashes);
});

test("invoice number of one customer, payer name or another invoice of a different customer", () => {
  const wrongPayer = matchOne(credit("NEFT CR-BHARAT STEEL WORKS LLP-INV/26-27/0012", 5900000));
  assert.deepEqual([wrongPayer.customer_id, wrongPayer.confidence], [1, 40]);
  assert.match(wrongPayer.reason, /payer name Bharat Steel Works LLP\): check before confirming/);
  const twoCustomers = matchOne(credit("NEFT CR-X-INV/26-27/0012 INV/26-27/0009", 5900000 + 23600000));
  assert.equal(twoCustomers.confidence, 40);
  assert.ok(twoCustomers.matches.every((m) => [7, 12, 13].includes(m.invoice_id)));
  assert.match(twoCustomers.reason, /INV\/26-27\/0009/);
  const payerPicks = matchOne(credit("NEFT CR-BHARAT STEEL WORKS-INV/26-27/0012 INV/26-27/0009", 23600000));
  assert.deepEqual([payerPicks.customer_id, payerPicks.matches], [2, [{ invoice_id: 9, amount_paise: 23600000 }]]);
});

test("extractInvoiceRefs: an FY with no sequence or an over-long sequence is not a bare invoice number", () => {
  assert.deepEqual(extractInvoiceRefs("INV 26-27", FYS), []);
  assert.deepEqual(extractInvoiceRefs("INV/26-27/123456", FYS), []);
});

test("fys default: today's FY first, then every FY that has an invoice (April payment of a March invoice)", () => {
  const march = inv(7, 1, 7, 10000000, "2027-03-15");
  const c = credit("NEFT INV/26-27/0007", 11800000, { date: "2027-04-05" });
  const [r] = matchCredits([c], [march], customers, { today: "2027-04-05" });
  assert.deepEqual([r.matches, r.confidence], [[{ invoice_id: 7, amount_paise: 11800000 }], 95]);
});
