import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITION_HEADING,
  EINVOICE_THRESHOLD_PAISE,
  GST_RATES_BPS,
  GST_RATE_LABELS,
  STATE_CODES,
  STATE_LIST,
  computeGSTINCheckDigit,
  docTypeFor,
  einvoiceJson,
  einvoiceRequired,
  hsnDigitsRequired,
  invoiceNumber,
  invoiceTotals,
  isInterstate,
  lineTax,
  parseInvoiceNumber,
  stateFromGSTIN,
  validateGSTIN,
  validateHSN,
  validateInvoiceNumber,
} from "../lib/gst.js";
import { UQC } from "../lib/data/uqc.js";

const tenK18 = { qty_milli: 1000, rate_paise: 1_000_000, gst_bps: 1800 };
const mint = (first14) => first14 + computeGSTINCheckDigit(first14);

test("₹10,000 @ 18% same state: CGST 90000 + SGST 90000, total 1180000", () => {
  assert.deepEqual(lineTax({ ...tenK18, interstate: false }), {
    taxable_paise: 1_000_000,
    cgst_paise: 90_000,
    sgst_paise: 90_000,
    igst_paise: 0,
  });
  const t = invoiceTotals([tenK18], { interstate: false });
  assert.equal(t.cgst_paise, 90_000);
  assert.equal(t.sgst_paise, 90_000);
  assert.equal(t.igst_paise, 0);
  assert.equal(t.subtotal_paise, 1_180_000);
  assert.equal(t.round_off_paise, 0);
  assert.equal(t.total_paise, 1_180_000);
});

test("₹10,000 @ 18% other state: IGST 180000, total 1180000", () => {
  assert.deepEqual(lineTax({ ...tenK18, interstate: true }), {
    taxable_paise: 1_000_000,
    cgst_paise: 0,
    sgst_paise: 0,
    igst_paise: 180_000,
  });
  const t = invoiceTotals([tenK18], { interstate: true });
  assert.equal(t.igst_paise, 180_000);
  assert.equal(t.total_paise, 1_180_000);
});

test("3 x ₹333 @ 5%: CGST 2498 + SGST 2498 vs IGST 4995 (one-paisa difference)", () => {
  const item = { qty_milli: 3000, rate_paise: 33_300, gst_bps: 500 };
  const same = lineTax({ ...item, interstate: false });
  const other = lineTax({ ...item, interstate: true });
  assert.equal(same.taxable_paise, 99_900);
  assert.equal(same.cgst_paise, 2498);
  assert.equal(same.sgst_paise, 2498);
  assert.equal(other.igst_paise, 4995);
  assert.equal(same.cgst_paise + same.sgst_paise - other.igst_paise, 1);
  assert.equal(invoiceTotals([item], { interstate: false }).total_paise, 104_900);
  assert.equal(invoiceTotals([item], { interstate: false }).round_off_paise, 4);
  assert.equal(invoiceTotals([item], { interstate: true }).round_off_paise, 5);
});

test("10% discount comes off the taxable value before tax", () => {
  const line = lineTax({ ...tenK18, discount_paise: 100_000, interstate: false });
  assert.deepEqual(line, { taxable_paise: 900_000, cgst_paise: 81_000, sgst_paise: 81_000, igst_paise: 0 });
  assert.equal(invoiceTotals([{ ...tenK18, discount_paise: 100_000 }], { interstate: false }).total_paise, 1_062_000);
});

test("discount larger than the line never goes below zero", () => {
  const line = lineTax({ qty_milli: 1000, rate_paise: 100, discount_paise: 500, gst_bps: 1800, interstate: false });
  assert.equal(line.taxable_paise, 0);
  assert.equal(line.cgst_paise, 0);
});

test("fractional quantities: 1.5 kg at ₹99.99 rounds to the paisa", () => {
  const line = lineTax({ qty_milli: 1500, rate_paise: 9999, gst_bps: 500, interstate: true });
  assert.equal(line.taxable_paise, 14_999); // 14998.5 -> half up
  assert.equal(line.igst_paise, 750); // 749.95
});

test("composition business: no GST, Bill of Supply, exact heading", () => {
  const t = invoiceTotals([tenK18], { interstate: false, registration: "composition" });
  assert.equal(t.cgst_paise + t.sgst_paise + t.igst_paise, 0);
  assert.equal(t.total_paise, 1_000_000);
  assert.equal(docTypeFor("composition"), "bill_of_supply");
  assert.equal(docTypeFor("regular"), "tax_invoice");
  assert.equal(docTypeFor("unregistered"), "plain");
  assert.throws(() => docTypeFor("llp"), RangeError);
  assert.equal(COMPOSITION_HEADING, "Composition taxable person, not eligible to collect tax on supplies");
  assert.equal(invoiceTotals([tenK18], { interstate: true, registration: "unregistered" }).igst_paise, 0);
});

test("0% item carries no tax", () => {
  assert.deepEqual(lineTax({ qty_milli: 2000, rate_paise: 5000, gst_bps: 0, interstate: false }), {
    taxable_paise: 10_000,
    cgst_paise: 0,
    sgst_paise: 0,
    igst_paise: 0,
  });
});

test("round-off: 123456 -> 123500 (+44); 123449 -> 123400 (-49); 123450 -> 123500 (+50, half up)", () => {
  const totals = (paise) => invoiceTotals([{ qty_milli: 1000, rate_paise: paise, gst_bps: 0 }], { interstate: false });
  assert.equal(totals(123_456).total_paise, 123_500);
  assert.equal(totals(123_456).round_off_paise, 44);
  assert.equal(totals(123_449).total_paise, 123_400);
  assert.equal(totals(123_449).round_off_paise, -49);
  assert.equal(totals(123_450).total_paise, 123_500);
  assert.equal(totals(123_450).round_off_paise, 50);
});

test("multi-line invoice sums per-line rounded tax, then rounds once", () => {
  const items = [
    { qty_milli: 3000, rate_paise: 33_300, gst_bps: 500 },
    { qty_milli: 1000, rate_paise: 1_000_000, discount_paise: 100_000, gst_bps: 1800 },
    { qty_milli: 2000, rate_paise: 5000, gst_bps: 0 },
  ];
  const t = invoiceTotals(items, { interstate: false });
  assert.equal(t.lines.length, 3);
  assert.equal(t.taxable_paise, 99_900 + 900_000 + 10_000);
  assert.equal(t.cgst_paise, 2498 + 81_000);
  assert.equal(t.sgst_paise, 2498 + 81_000);
  assert.equal(t.subtotal_paise, 1_009_900 + 166_996);
  assert.equal(t.total_paise, 1_176_900);
  assert.equal(t.round_off_paise, 4);
});

test("rejects floats and a missing interstate flag", () => {
  assert.throws(() => lineTax({ qty_milli: 1000, rate_paise: 333.5, gst_bps: 500, interstate: false }), TypeError);
  assert.throws(() => lineTax({ qty_milli: 1000, rate_paise: 100, gst_bps: 18.5, interstate: false }), TypeError);
  assert.throws(() => lineTax({ qty_milli: 1000, rate_paise: 100, gst_bps: 1800 }), TypeError);
  assert.throws(() => lineTax({ qty_milli: -1000, rate_paise: 100, gst_bps: 1800, interstate: false }), TypeError);
});

test("GSTIN: minted Punjab (03) and Haryana (06) GSTINs are valid", () => {
  for (const [first14, state] of [["03AAXCA1234F1Z", "03"], ["06ABCDE1234F1Z", "06"]]) {
    const gstin = mint(first14);
    const r = validateGSTIN(gstin);
    assert.equal(gstin.length, 15);
    assert.equal(r.valid, true, JSON.stringify(r));
    assert.equal(r.reason, null);
    assert.equal(r.state_code, state);
    assert.equal(r.pan, first14.slice(2, 12));
    assert.equal(r.check_digit_ok, true);
    assert.equal(r.gstin, gstin);
    assert.equal(stateFromGSTIN(gstin), state);
  }
});

test("GSTIN: a published check digit matches the algorithm", () => {
  assert.equal(computeGSTINCheckDigit("27AAPFU0939F1Z"), "V");
  assert.equal(validateGSTIN("27AAPFU0939F1ZV").valid, true);
  assert.equal(validateGSTIN(" 27aapfu0939f1zv ").valid, true);
  assert.equal(validateGSTIN(" 27aapfu0939f1zv ").gstin, "27AAPFU0939F1ZV");
});

test("GSTIN: changing one character fails the check digit", () => {
  const gstin = mint("03AAXCA1234F1Z");
  for (const i of [0, 3, 7, 10, 12, 14]) {
    const c = gstin[i];
    const swap = /\d/.test(c) ? String((Number(c) + 1) % 10) : c === "Z" ? "A" : "Z";
    const flipped = gstin.slice(0, i) + swap + gstin.slice(i + 1);
    const r = validateGSTIN(flipped);
    assert.equal(r.valid, false, `position ${i}: ${flipped}`);
    if (r.reason === "check_digit") assert.equal(r.check_digit_ok, false);
  }
  const wrongDigit = gstin.slice(0, 14) + (gstin[14] === "A" ? "B" : "A");
  assert.deepEqual(validateGSTIN(wrongDigit), {
    valid: false,
    reason: "check_digit",
    gstin: wrongDigit,
    state_code: "03",
    pan: "AAXCA1234F",
    check_digit_ok: false,
  });
});

test("GSTIN: wrong pattern, wrong length, empty, unknown state", () => {
  assert.equal(validateGSTIN("03AAXCA1234F0Z8").reason, "pattern"); // entity digit 0 not allowed
  assert.equal(validateGSTIN("0AAAXCA1234F1Z8").reason, "pattern");
  assert.equal(validateGSTIN("03AAXCA1234F1Z").reason, "length");
  assert.equal(validateGSTIN("").reason, "empty");
  assert.equal(validateGSTIN(null).reason, "empty");
  assert.equal(validateGSTIN(mint("00AAXCA1234F1Z")).reason, "state_code");
  assert.equal(validateGSTIN(mint("28AAXCA1234F1Z")).reason, "state_code");
  assert.throws(() => computeGSTINCheckDigit("03AAXCA1234F"), RangeError);
  assert.equal(stateFromGSTIN(""), null);
});

test("isInterstate compares two-digit state codes", () => {
  assert.equal(isInterstate("27", "27"), false);
  assert.equal(isInterstate("27", "24"), true);
  assert.equal(isInterstate("03", 3), false);
  assert.throws(() => isInterstate("27", undefined), RangeError);
});

test("state codes: 01-38 except 28, plus 96/97/99; ordered list", () => {
  assert.equal(Object.keys(STATE_CODES).length, 40);
  assert.equal(STATE_CODES["28"], undefined);
  assert.equal(STATE_CODES["03"], "Punjab");
  assert.equal(STATE_CODES["06"], "Haryana");
  assert.equal(STATE_CODES["27"], "Maharashtra");
  assert.equal(STATE_CODES["26"], "Dadra and Nagar Haveli and Daman and Diu");
  assert.equal(STATE_CODES["38"], "Ladakh");
  assert.equal(STATE_CODES["96"], "Foreign Country");
  assert.equal(STATE_CODES["99"], "Centre Jurisdiction");
  assert.deepEqual(STATE_LIST.slice(0, 2), [{ code: "01", name: "Jammu and Kashmir" }, { code: "02", name: "Himachal Pradesh" }]);
  assert.equal(STATE_LIST.at(-1).code, "99");
  assert.equal(UQC.length, 24);
  assert.deepEqual(UQC[0], { code: "PCS", label: "Pieces" });
});

test("HSN digits and e-invoicing switch at exactly ₹5 crore", () => {
  assert.equal(EINVOICE_THRESHOLD_PAISE, 5_000_000_000);
  assert.equal(hsnDigitsRequired(5_000_000_000), 4);
  assert.equal(hsnDigitsRequired(5_000_000_001), 6);
  assert.equal(hsnDigitsRequired(4_500_000_000), 4);
  assert.equal(einvoiceRequired(5_000_000_000), false);
  assert.equal(einvoiceRequired(5_000_000_001), true);
  assert.equal(validateHSN("8708", 4_500_000_000), true);
  assert.equal(validateHSN("8708", 5_000_000_001), false);
  assert.equal(validateHSN("870829", 5_000_000_001), true);
  assert.equal(validateHSN("998314", 4_500_000_000), true);
  assert.equal(validateHSN("87", 4_500_000_000), false);
  assert.equal(validateHSN("87082", 4_500_000_000), false);
  assert.equal(validateHSN("", 4_500_000_000), false);
});

test("GST rate list and labels", () => {
  assert.deepEqual([...GST_RATES_BPS], [0, 25, 150, 300, 500, 1800, 4000]);
  assert.equal(GST_RATE_LABELS[25], "0.25%");
  assert.equal(GST_RATE_LABELS[150], "1.5%");
  assert.equal(GST_RATE_LABELS[1800], "18%");
  assert.equal(GST_RATE_LABELS[4000], "40%");
  assert.equal(Object.keys(GST_RATE_LABELS).length, 7);
});

test("invoice numbers: format, parse round-trip, 16-char limit", () => {
  assert.equal(invoiceNumber("26-27", 42), "INV/26-27/0042");
  assert.equal(invoiceNumber("26-27", 1), "INV/26-27/0001");
  assert.equal(invoiceNumber("26-27", 12345), "INV/26-27/12345");
  assert.equal(invoiceNumber("99-00", 7), "INV/99-00/0007");
  assert.deepEqual(parseInvoiceNumber("INV/26-27/0042"), { fy: "26-27", seq: 42 });
  assert.deepEqual(parseInvoiceNumber(invoiceNumber("26-27", 12345)), { fy: "26-27", seq: 12345 });
  assert.equal(parseInvoiceNumber("INV/26-28/0042"), null);
  assert.equal(parseInvoiceNumber("INV 26-27 0042"), null);
  assert.equal(parseInvoiceNumber("garbage"), null);
  assert.equal(parseInvoiceNumber(null), null);
  assert.throws(() => invoiceNumber("2026-27", 1), RangeError);
  assert.throws(() => invoiceNumber("26-27", 0), TypeError);
  assert.throws(() => invoiceNumber("26-27", 1.5), TypeError);
  assert.throws(() => invoiceNumber("26-27", 9_999_999), RangeError);
  assert.equal(validateInvoiceNumber("INV/26-27/0042"), true);
  assert.equal(validateInvoiceNumber("A".repeat(16)), true);
  assert.equal(validateInvoiceNumber("A".repeat(17)), false);
  assert.equal(validateInvoiceNumber("0INV/26-27/0042"), false);
  assert.equal(validateInvoiceNumber("INV 26-27 0042"), false);
  assert.equal(validateInvoiceNumber(""), false);
  assert.equal(validateInvoiceNumber(undefined), false);
});

const business = {
  name: "Arora Auto Components",
  address: "12 Industrial Area A, Ludhiana 141003",
  gstin: mint("03AAXCA1234F1Z"),
  state_code: "03",
  regtype: "regular",
  pin: "141003",
};
const customer = {
  name: "Mehta Motors",
  address: "Plot 7, Sector 22, Gurugram 122015",
  gstin: mint("06ABCDE1234F1Z"),
  state_code: "06",
};
const items = [
  { description: "Brake pads", hsn_sac: "870830", qty_milli: 3000, unit: "PCS", rate_paise: 33_300, gst_bps: 500 },
  { description: "Fitting service", hsn_sac: "998714", qty_milli: 1000, unit: "NOS", rate_paise: 1_000_000, discount_paise: 100_000, gst_bps: 1800 },
];
const twoDp = (v) => typeof v === "number" && Math.round(v * 100) / 100 === v;

test("einvoiceJson has every required key, DocDtls.No passes its regex, rupee decimals", () => {
  const invoice = { number: invoiceNumber("26-27", 42), issue_date: "2026-10-24", place_of_supply: "06", reverse_charge: false };
  const j = einvoiceJson({ invoice, items, business, customer });
  assert.equal(j.Version, "1.1");
  assert.deepEqual(j.TranDtls, { TaxSch: "GST", SupTyp: "B2B", RegRev: "N" });
  assert.deepEqual(j.DocDtls, { Typ: "INV", No: "INV/26-27/0042", Dt: "24/10/2026" });
  assert.equal(validateInvoiceNumber(j.DocDtls.No), true);
  assert.deepEqual(Object.keys(j.SellerDtls), ["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd"]);
  assert.deepEqual(Object.keys(j.BuyerDtls), ["Gstin", "LglNm", "Pos", "Addr1", "Loc", "Pin", "Stcd"]);
  assert.equal(j.SellerDtls.Gstin, business.gstin);
  assert.equal(j.SellerDtls.Pin, 141003);
  assert.equal(j.SellerDtls.Stcd, "03");
  assert.equal(j.SellerDtls.Loc, "Punjab");
  assert.equal(j.BuyerDtls.Pin, 122015); // pulled from the address
  assert.equal(j.BuyerDtls.Pos, "06");
  assert.equal(j.BuyerDtls.Stcd, "06");
  assert.equal(j.ItemList.length, 2);
  assert.deepEqual(Object.keys(j.ItemList[0]), [
    "SlNo", "PrdDesc", "IsServc", "HsnCd", "Qty", "Unit", "UnitPrice", "TotAmt", "Discount", "AssAmt",
    "GstRt", "IgstAmt", "CgstAmt", "SgstAmt", "TotItemVal",
  ]);
  assert.deepEqual(j.ItemList[0], {
    SlNo: "1", PrdDesc: "Brake pads", IsServc: "N", HsnCd: "870830", Qty: 3, Unit: "PCS", UnitPrice: 333,
    TotAmt: 999, Discount: 0, AssAmt: 999, GstRt: 5, IgstAmt: 49.95, CgstAmt: 0, SgstAmt: 0, TotItemVal: 1048.95,
  });
  assert.equal(j.ItemList[1].SlNo, "2");
  assert.equal(j.ItemList[1].IsServc, "Y");
  assert.equal(j.ItemList[1].TotAmt, 10_000);
  assert.equal(j.ItemList[1].Discount, 1000);
  assert.equal(j.ItemList[1].AssAmt, 9000);
  assert.equal(j.ItemList[1].IgstAmt, 1620);
  assert.deepEqual(Object.keys(j.ValDtls), ["AssVal", "CgstVal", "SgstVal", "IgstVal", "RndOffAmt", "TotInvVal"]);
  assert.deepEqual(j.ValDtls, { AssVal: 9999, CgstVal: 0, SgstVal: 0, IgstVal: 1669.95, RndOffAmt: 0.05, TotInvVal: 11_669 });
  for (const v of [...Object.values(j.ValDtls), ...Object.values(j.ItemList[0]).filter((x) => typeof x === "number")]) {
    assert.ok(twoDp(v), `not 2dp: ${v}`);
  }
  assert.equal(JSON.parse(JSON.stringify(j)).ValDtls.TotInvVal, 11_669);
});

test("einvoiceJson same-state splits CGST/SGST, reverse charge flag, unregistered buyer is URP", () => {
  const invoice = { number: "INV/26-27/0043", issue_date: "2026-04-01", place_of_supply: "03", reverse_charge: true };
  const j = einvoiceJson({
    invoice,
    items: [{ description: "Brake pads", hsn_sac: "8708", qty_milli: 1000, unit: "PCS", rate_paise: 1_000_000, gst_bps: 1800 }],
    business,
    customer: { name: "Walk-in", address: "Ludhiana", gstin: null, state_code: "03" },
  });
  assert.equal(j.TranDtls.RegRev, "Y");
  assert.equal(j.DocDtls.Dt, "01/04/2026");
  assert.equal(j.BuyerDtls.Gstin, "URP");
  assert.equal(j.BuyerDtls.Pin, null);
  assert.deepEqual(j.ValDtls, { AssVal: 10_000, CgstVal: 900, SgstVal: 900, IgstVal: 0, RndOffAmt: 0, TotInvVal: 11_800 });
  assert.equal(j.ItemList[0].CgstAmt, 900);
  assert.equal(j.ItemList[0].TotItemVal, 11_800);
  assert.throws(() => einvoiceJson({ invoice: { ...invoice, issue_date: new Date() }, items: [], business, customer }), RangeError);
});
