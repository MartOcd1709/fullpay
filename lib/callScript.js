// What an automatic reminder call says, in the customer's language. Short, polite, never a threat: the bill, the amount,
// the due date, how to pay, and, only for a micro or small supplier, the plain fact that the MSMED Act adds interest to
// payments made after the due date. Pure: plain data in, plain text out.
import { fmtINR } from "./money.js";
import { addDays, formatDate } from "./time.js";

const LINES = {
  en: {
    hello: "Namaste {customer}. This is an automated call from {business}.",
    before: "Your bill {numbers} for {amount} is due on {due}. Please pay by the due date using the payment link we sent you.",
    after: "Your bill {numbers} for {amount} was due on {due} and is still open. Please pay using the payment link we sent you, or tell us the date you will pay.",
    interest_before: "Under the MSMED Act, payments made after the due date carry interest.",
    interest_after: "Under the MSMED Act, interest applies from {since}.",
    paid: "If you have already paid, please ignore this call.",
    bye: "To talk to us, call {phone}. Thank you.",
    thanks: "Thank you.",
  },
  hi: {
    hello: "नमस्ते {customer} जी। यह {business} की ओर से एक स्वचालित कॉल है।",
    before: "आपका बिल {numbers}, रकम {amount}, की भुगतान तारीख {due} है। कृपया हमारे भेजे भुगतान लिंक से तय तारीख तक भुगतान करें।",
    after: "आपका बिल {numbers}, रकम {amount}, की भुगतान तारीख {due} थी और यह अभी बाकी है। कृपया हमारे भेजे भुगतान लिंक से भुगतान करें, या बताएँ कि आप किस तारीख तक भुगतान करेंगे।",
    interest_before: "MSMED कानून के अनुसार, तय तारीख के बाद किए गए भुगतान पर ब्याज लगता है।",
    interest_after: "MSMED कानून के अनुसार, {since} से ब्याज लागू है।",
    paid: "अगर आप भुगतान कर चुके हैं, तो कृपया इस कॉल को अनदेखा करें।",
    bye: "हमसे बात करने के लिए {phone} पर कॉल करें। धन्यवाद।",
    thanks: "धन्यवाद।",
  },
};

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// kind: "before" (the bill is not due yet) or "after" (past its due date). interest: true only for a micro/small supplier.
export function callScript({ lang = "en", kind, business, customer, numbers, amount_paise, due_date, interest = false }) {
  const l = LINES[lang] ? lang : "en";
  const L = LINES[l];
  const vars = {
    customer,
    business: business.name,
    numbers: numbers.join(", "),
    amount: fmtINR(amount_paise, { paise: false }),
    due: formatDate(due_date, l),
    since: formatDate(addDays(due_date, 1), l),
    phone: business.phone ?? "",
  };
  const lines = [L.hello, L[kind === "after" ? "after" : "before"]];
  if (interest) lines.push(L[kind === "after" ? "interest_after" : "interest_before"]);
  lines.push(L.paid);
  lines.push(business.phone ? L.bye : L.thanks);
  return { lang: l, text: lines.map((x) => fill(x, vars)).join(" ") };
}
