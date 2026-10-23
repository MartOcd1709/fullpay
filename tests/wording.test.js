// K29: the never-threaten rule, enforced. Nothing a customer can receive, and no screen text, may use these phrases.
// The pack's own disclaimer ("not a GST department notice and not a legal notice") is the one allowed use.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE_NAMES, render, renderWhatsAppText } from "../lib/templates.js";
import en from "../lib/i18n/en.json" with { type: "json" };
import hi from "../lib/i18n/hi.json" with { type: "json" };

const BANNED = [
  "legal notice", "legal action", "demand notice", "notice of demand", "statutory demand", "final demand", "notice period",
  "defaulter", "default", "operational debt", "corporate debtor", "dishonour", "hereby called upon", "failing which",
  "constrained to", "without prejudice", "under instructions from", "penal", "penalty", "without further notice",
  "कानूनी नोटिस", "नोटिस",
];
// The letter's disclaimer says what the letter is NOT; that negation is required by the pack (EN and HI exact wording).
const ALLOWED = [
  /not a notice from the GST department and not a legal notice from a lawyer/gi,
  /यह GST विभाग का नोटिस नहीं है और न ही किसी वकील का कानूनी नोटिस है/g,
];
const hits = (text) => {
  let t = String(text);
  for (const a of ALLOWED) t = t.replace(a, " ");
  const low = t.toLowerCase();
  return BANNED.filter((w) => (/^[a-z ]+$/.test(w) ? new RegExp(`\\b${w}\\b`, "i").test(low) : low.includes(w)));
};

const vars = {
  customer_name: "Mehta & Sons Pvt Ltd", business_name: "Arora Auto Components", invoice_numbers: "INV/26-27/0042", amount: "₹1,18,000",
  due_date: "15 Oct 2026", days_overdue: 7, pay_link: "https://x.example/pay/t", verify_link: "https://x.example/v/0123456789abcdef", contact: "Harpreet Arora",
};

test("every customer message, in English and Hindi, is free of threatening phrases", () => {
  for (const name of TEMPLATE_NAMES) {
    for (const lang of ["en", "hi"]) {
      const r = render(name, lang, vars);
      for (const [part, text] of Object.entries({ ...r, whatsapp: renderWhatsAppText(name, lang, vars) })) {
        assert.deepEqual(hits(text), [], `${name} ${lang} ${part}`);
      }
    }
  }
});

test("every screen, letter and print string (EN and HI) is free of threatening phrases", () => {
  const bad = [];
  for (const [lang, dict] of [["en", en], ["hi", hi]]) {
    for (const [k, v] of Object.entries(dict)) {
      const text = typeof v === "string" ? v : `${v?.label ?? ""} ${v?.hint ?? ""}`;
      const h = hits(text);
      if (h.length) bad.push(`${lang} ${k}: ${h.join(", ")}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("letter and print source files carry no banned phrase in literal text", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(js|jsx)$/.test(f) && files.push(p); } };
  walk("app/print"); walk("components/print"); walk("app/pay");
  files.push("lib/services/letters.js", "lib/templates.js");
  const bad = [];
  for (const f of files) {
    const strings = readFileSync(f, "utf8").match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? [];
    for (const s of strings) { const h = hits(s); if (h.length) bad.push(`${f}: ${s.slice(0, 80)} → ${h.join(", ")}`); }
  }
  assert.deepEqual(bad, []);
});
