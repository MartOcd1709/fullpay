import { ToWords as EnToWords } from "to-words/en-IN";
import { ToWords as HiToWords } from "to-words/hi-IN";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const NUMBER_IN = new Intl.NumberFormat("en-IN");

const numberWords = { converterOptions: { currency: false, ignoreDecimal: true } };
const WORDS = {
  en: { words: new EnToWords(numberWords), rupees: "Rupees", and: "and", paisa: "Paisa", paise: "Paise", only: "Only" },
  hi: { words: new HiToWords(numberWords), rupees: "रुपये", and: "और", paisa: "पैसा", paise: "पैसे", only: "मात्र" },
};

const AMOUNT_PREFIX = /^(?:₹|rs\.?|inr)\s*/i;
const AMOUNT_SUFFIX = /\s*\/-$/;
const AMOUNT_SHAPE = /^([\d,]*)(?:\.(\d*))?$/;

function fail(message) {
  return Object.assign(new RangeError(message), { code: "invalid_amount" });
}

export function asPaise(n) {
  if (typeof n !== "number" || !Number.isSafeInteger(n)) {
    throw fail(`money must be integer paise as a safe-integer Number, got ${String(n)}`);
  }
  return n || 0; // folds -0 into 0 so nothing ever formats as "-₹0.00"
}

export function rupeesToPaise(input, { allowNegative = false } = {}) {
  if (typeof input !== "string" && typeof input !== "number") {
    throw fail(`not a rupee amount: ${String(input)}`);
  }
  let text = String(input).trim().replace(AMOUNT_PREFIX, "").replace(AMOUNT_SUFFIX, "");
  const negative = text.startsWith("-");
  if (negative) text = text.slice(1).trimStart();
  const match = AMOUNT_SHAPE.exec(text);
  if (!match) throw fail(`not a rupee amount: "${input}"`);
  const whole = match[1].replace(/,/g, "");
  const fraction = match[2] ?? "";
  if (whole === "" && fraction === "") throw fail(`not a rupee amount: "${input}"`);
  if (fraction.length > 2) throw fail(`more than two decimal places: "${input}"`);
  const paise = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise)) throw fail(`amount too large: "${input}"`);
  if (negative && !allowNegative) throw fail(`negative amount not allowed: "${input}"`);
  return negative ? -paise || 0 : paise;
}

export function paiseToRupees(paise) {
  const p = asPaise(paise);
  const remainder = p % 100;
  return { rupees: (p - remainder) / 100, paise: Math.abs(remainder) };
}

export function fmtINR(paise, { paise: withPaise = true } = {}) {
  const p = asPaise(paise);
  if (withPaise) return INR.format(p / 100);
  return INR_WHOLE.format(roundToRupee(p).rounded_paise / 100);
}

export function fmtNumberIN(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) throw fail(`not a number: ${String(n)}`);
  return NUMBER_IN.format(n || 0);
}

export function roundToRupee(paise) {
  const p = asPaise(paise);
  const remainder = ((p % 100) + 100) % 100;
  const rounded_paise = p - remainder + (remainder >= 50 ? 100 : 0);
  return { rounded_paise, round_off_paise: rounded_paise - p };
}

export function amountInWords(paise, lang = "en") {
  const p = asPaise(paise);
  if (p < 0) throw fail(`amount in words needs a non-negative amount, got ${p}`);
  const t = WORDS[lang] ?? WORDS.en;
  const { rupees, paise: fraction } = paiseToRupees(p);
  const unit = fraction === 1 ? t.paisa : t.paise;
  const fractionWords = fraction ? ` ${t.and} ${t.words.convert(fraction)} ${unit}` : "";
  return `${t.rupees} ${t.words.convert(rupees)}${fractionWords} ${t.only}`;
}
