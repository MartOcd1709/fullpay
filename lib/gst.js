import { STATE_CODES } from "./data/state-codes.js";

export { STATE_CODES };
export const STATE_LIST = Object.freeze(
  Object.keys(STATE_CODES)
    .sort()
    .map((code) => ({ code, name: STATE_CODES[code] })),
);

// ---------- GSTIN ----------

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const normalize = (s) => String(s ?? "").trim().toUpperCase();
const pad2 = (code) => {
  const s = String(code ?? "").trim();
  return s ? s.padStart(2, "0") : "";
};

export function computeGSTINCheckDigit(first14) {
  const s = normalize(first14);
  if (s.length !== 14 || ![...s].every((c) => ALPHABET.includes(c))) {
    throw new RangeError("first14 must be 14 characters from 0-9A-Z");
  }
  // GSTN mod-36 check digit: weights alternate 1,2 from the left; each product contributes floor(p/36) + p%36.
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = ALPHABET.indexOf(s[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36];
}

export function validateGSTIN(gstin) {
  const s = normalize(gstin);
  const result = { valid: false, reason: null, gstin: s, state_code: null, pan: null, check_digit_ok: false };
  if (!s) return { ...result, reason: "empty" };
  if (s.length !== 15) return { ...result, reason: "length" };
  if (!GSTIN_PATTERN.test(s)) return { ...result, reason: "pattern" };
  result.state_code = s.slice(0, 2);
  result.pan = s.slice(2, 12);
  result.check_digit_ok = computeGSTINCheckDigit(s.slice(0, 14)) === s[14];
  if (!result.check_digit_ok) return { ...result, reason: "check_digit" };
  if (!STATE_CODES[result.state_code]) return { ...result, reason: "state_code" };
  return { ...result, valid: true };
}

export function stateFromGSTIN(gstin) {
  const s = normalize(gstin);
  return /^\d{2}/.test(s) ? s.slice(0, 2) : null;
}

export function isInterstate(businessStateCode, placeOfSupply) {
  const a = pad2(businessStateCode);
  const b = pad2(placeOfSupply);
  if (!/^\d{2}$/.test(a) || !/^\d{2}$/.test(b)) {
    throw new RangeError(`state codes must be two digits: ${businessStateCode}, ${placeOfSupply}`);
  }
  return a !== b;
}

// ---------- Tax math (integer paise, integer bps, qty_milli) ----------

function assertInt(name, v, min = 0) {
  if (!Number.isSafeInteger(v) || v < min) throw new TypeError(`${name} must be an integer >= ${min}, got ${v}`);
}

const grossPaise = ({ qty_milli, rate_paise }) => Math.round((qty_milli * rate_paise) / 1000);

export function lineTax({ qty_milli, rate_paise, discount_paise = 0, gst_bps, interstate }) {
  assertInt("qty_milli", qty_milli);
  assertInt("rate_paise", rate_paise);
  assertInt("discount_paise", discount_paise);
  assertInt("gst_bps", gst_bps);
  if (typeof interstate !== "boolean") throw new TypeError("interstate must be a boolean");
  const taxable_paise = Math.max(0, grossPaise({ qty_milli, rate_paise }) - discount_paise);
  const igst = Math.round((taxable_paise * gst_bps) / 10000);
  // CGST and SGST are each half the rate, rounded separately; the pair may differ from IGST by one paisa (pack rule).
  const half = Math.round((taxable_paise * gst_bps) / 20000);
  return interstate
    ? { taxable_paise, cgst_paise: 0, sgst_paise: 0, igst_paise: igst }
    : { taxable_paise, cgst_paise: half, sgst_paise: half, igst_paise: 0 };
}

export function invoiceTotals(items, { interstate, registration = "regular" } = {}) {
  const taxed = docTypeFor(registration) === "tax_invoice";
  const lines = items.map((it) => lineTax({ ...it, gst_bps: taxed ? it.gst_bps : 0, interstate }));
  const sum = (key) => lines.reduce((acc, l) => acc + l[key], 0);
  const taxable_paise = sum("taxable_paise");
  const cgst_paise = sum("cgst_paise");
  const sgst_paise = sum("sgst_paise");
  const igst_paise = sum("igst_paise");
  const subtotal_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise;
  const total_paise = Math.round(subtotal_paise / 100) * 100;
  return {
    lines,
    taxable_paise,
    cgst_paise,
    sgst_paise,
    igst_paise,
    subtotal_paise,
    round_off_paise: total_paise - subtotal_paise,
    total_paise,
  };
}

// ---------- Document rules ----------

const DOC_TYPES = Object.freeze({ regular: "tax_invoice", composition: "bill_of_supply", unregistered: "plain" });

export function docTypeFor(registration) {
  const type = DOC_TYPES[registration];
  if (!type) throw new RangeError(`unknown registration type: ${registration}`);
  return type;
}

export const COMPOSITION_HEADING = "Composition taxable person, not eligible to collect tax on supplies";

// ₹5 crore: e-invoicing above it (Notif 10/2023-CT); HSN 4 digits up to it, 6 above (Notif 78/2020-CT).
export const EINVOICE_THRESHOLD_PAISE = 5_000_000_000;

export const hsnDigitsRequired = (turnover_paise) => (turnover_paise > EINVOICE_THRESHOLD_PAISE ? 6 : 4);

export const einvoiceRequired = (turnover_paise) => turnover_paise > EINVOICE_THRESHOLD_PAISE;

export function validateHSN(hsn_sac, turnover_paise) {
  const s = String(hsn_sac ?? "").trim();
  return /^(\d{4}|\d{6}|\d{8})$/.test(s) && s.length >= hsnDigitsRequired(turnover_paise);
}

// Check current rates on cbic-gst.gov.in; 28% withdrawn from 1 Feb 2026 (Notif 19/2025-CT(R)).
export const GST_RATES_BPS = Object.freeze([0, 25, 150, 300, 500, 1800, 4000]);

export const GST_RATE_LABELS = Object.freeze(Object.fromEntries(GST_RATES_BPS.map((bps) => [bps, `${bps / 100}%`])));

// ---------- Invoice numbers ----------

// NIC e-invoice DocDtls.No pattern; Rule 46(b) caps the serial at 16 characters.
export const INVOICE_NUMBER_PATTERN = /^[a-zA-Z1-9][a-zA-Z0-9/-]{0,15}$/;

const isFy = (fy) => /^\d{2}-\d{2}$/.test(fy) && (Number(fy.slice(0, 2)) + 1) % 100 === Number(fy.slice(3));

export function invoiceNumber(fy, seq) {
  if (!isFy(fy)) throw new RangeError(`fy must look like '26-27', got ${fy}`);
  assertInt("seq", seq, 1);
  const number = `INV/${fy}/${String(seq).padStart(4, "0")}`;
  if (!validateInvoiceNumber(number)) throw new RangeError(`invoice number exceeds 16 characters: ${number}`);
  return number;
}

export function parseInvoiceNumber(str) {
  const m = /^INV\/(\d{2}-\d{2})\/(\d{4,})$/.exec(String(str ?? "").trim());
  return m && isFy(m[1]) ? { fy: m[1], seq: Number(m[2]) } : null;
}

export const validateInvoiceNumber = (str) =>
  typeof str === "string" && str.length <= 16 && INVOICE_NUMBER_PATTERN.test(str);

// ---------- e-invoice (NIC INV-01 shape; rupee decimals, export only, never hashed) ----------

const rupees = (paise) => paise / 100;

function ddmmyyyy(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ""));
  if (!m) throw new RangeError(`issue_date must be 'YYYY-MM-DD', got ${isoDate}`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function pinOf(party) {
  const m = /\b[1-9]\d{5}\b/.exec(String(party.pin ?? "")) ?? /\b[1-9]\d{5}\b/.exec(String(party.address ?? ""));
  return m ? Number(m[0]) : null;
}

function partyDtls(party) {
  const stcd = pad2(party.state_code);
  return {
    Gstin: party.gstin ? normalize(party.gstin) : "URP",
    LglNm: party.name,
    Addr1: party.address ?? "",
    Loc: party.city || STATE_CODES[stcd] || "",
    Pin: pinOf(party),
    Stcd: stcd,
  };
}

function itemDtls(item, line, slNo, taxed) {
  const hsn = String(item.hsn_sac ?? "").trim();
  return {
    SlNo: String(slNo),
    PrdDesc: item.description,
    IsServc: hsn.startsWith("99") ? "Y" : "N",
    HsnCd: hsn,
    Qty: item.qty_milli / 1000,
    Unit: item.unit ?? "PCS",
    UnitPrice: rupees(item.rate_paise),
    TotAmt: rupees(grossPaise(item)),
    Discount: rupees(item.discount_paise ?? 0),
    AssAmt: rupees(line.taxable_paise),
    GstRt: taxed ? item.gst_bps / 100 : 0,
    IgstAmt: rupees(line.igst_paise),
    CgstAmt: rupees(line.cgst_paise),
    SgstAmt: rupees(line.sgst_paise),
    TotItemVal: rupees(line.taxable_paise + line.cgst_paise + line.sgst_paise + line.igst_paise),
  };
}

export function einvoiceJson({ invoice, items, business, customer }) {
  const registration = business.regtype ?? "regular";
  const interstate = isInterstate(business.state_code, invoice.place_of_supply);
  const totals = invoiceTotals(items, { interstate, registration });
  const taxed = docTypeFor(registration) === "tax_invoice";
  const buyer = partyDtls(customer);
  return {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: invoice.reverse_charge ? "Y" : "N" },
    DocDtls: { Typ: "INV", No: invoice.number, Dt: ddmmyyyy(invoice.issue_date) },
    SellerDtls: partyDtls(business),
    BuyerDtls: {
      Gstin: buyer.Gstin,
      LglNm: buyer.LglNm,
      Pos: pad2(invoice.place_of_supply),
      Addr1: buyer.Addr1,
      Loc: buyer.Loc,
      Pin: buyer.Pin,
      Stcd: buyer.Stcd,
    },
    ItemList: items.map((item, i) => itemDtls(item, totals.lines[i], i + 1, taxed)),
    ValDtls: {
      AssVal: rupees(totals.taxable_paise),
      CgstVal: rupees(totals.cgst_paise),
      SgstVal: rupees(totals.sgst_paise),
      IgstVal: rupees(totals.igst_paise),
      RndOffAmt: rupees(totals.round_off_paise),
      TotInvVal: rupees(totals.total_paise),
    },
  };
}
