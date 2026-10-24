// The pack's design checks, automated: every screen at 360 px (normal and largest text) and at laptop width, in English and
// Hindi. Fails on console errors, an error screen, sideways scrolling, buttons under 44 px, or English left on Hindi pages.
//   DATABASE_URL=… node scripts/acceptance.js http://localhost:3100      (server running with DEMO_MODE=1)
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const base = process.argv[2] ?? "http://localhost:3100";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const one = async (sql) => (await db.query(sql)).rows[0] ?? {};
const inv = await one("SELECT id, pay_token FROM invoices WHERE number = 'INV/26-27/0042'");
const cust = await one("SELECT customer_id AS id FROM invoices WHERE number = 'INV/26-27/0042'");
const stmt = await one(`UPDATE customers SET statement_token = COALESCE(statement_token, md5(random()::text)) WHERE id = ${Number(cust.id)} RETURNING statement_token AS t`);
const letter = await one("SELECT left(entry_hash, 16) AS p, entry_hash AS h FROM escalation_events WHERE type = 'letter_generated' ORDER BY id DESC LIMIT 1");
await db.end();

const OWNER = ["/dashboard", "/followups", "/invoices", `/invoices/${inv.id}`, "/invoices/new", "/customers", `/customers/${cust.id}`, "/inbox",
  "/payments", "/forecast", "/chase-first", "/documents", "/approvals", "/analytics", "/team", "/activity", "/settings", "/runs", "/search?q=bhatia"];
const PUBLIC = ["/", "/login", `/pay/${inv.pay_token}`, "/verify", `/v/${letter.p}`, `/verify/${letter.h}`, "/status", "/proof", "/calculator?amount=117186&due=2026-09-19&on=2026-10-24", `/s/${stmt.t}`];
const PRINT = [`/print/invoice/${inv.id}`, `/print/letter/${inv.id}`, `/print/bundle/${inv.id}`];

const PORT = 9334;
const chrome = spawn(process.env.CHROME ?? "chromium", ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--hide-scrollbars",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "fp-acc-"))}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { await wait(200); if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false)) break; }
const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map(), listeners = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) listeners.forEach((l) => l(m));
});
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const loaded = () => new Promise((r) => { const l = (m) => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");

let errors = [];
let docStatus = 0;
listeners.push((m) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.split("\n")[0] ?? m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 160));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon/.test(m.params.entry.url ?? "")) errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ""}`.slice(0, 160));
  if (m.method === "Network.responseReceived" && m.params.type === "Document") docStatus = m.params.response.status;
});

const host = new URL(base).hostname;
const cookie = (name, value) => send("Network.setCookie", { name, value, domain: host, path: "/" });
const r = await fetch(`${base}/api/auth/demo`, { method: "POST", body: new URLSearchParams({ as: "owner" }), redirect: "manual" });
const session = r.headers.getSetCookie().map((c) => c.split(";")[0].split("="));

// In the page: sideways overflow (with the elements that stick out), small buttons, error screen, English left on a Hindi page.
const PROBE = `(() => {
  const vw = innerWidth, out = [];
  const over = document.documentElement.scrollWidth > vw + 1;
  if (over) for (const el of document.querySelectorAll("body *")) {
    const b = el.getBoundingClientRect();
    if (b.width && b.right > vw + 1 && getComputedStyle(el).position !== "fixed" && !el.closest("[data-allow-scroll], .overflow-x-auto, .overflow-auto, table")) {
      out.push((el.tagName + "." + String(el.className).split(" ").slice(0, 2).join(".") + " '" + (el.textContent || "").trim().slice(0, 30) + "'"));
      if (out.length > 2) break;
    }
  }
  const small = [...document.querySelectorAll("button, a[class*='min-h'], [role=button], select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file])")]
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 43.5 && !e.closest("nav[aria-label] ul.grid, .sr-only, dialog:not([open])"); })
    .map((e) => (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 24) + " " + Math.round(e.getBoundingClientRect().height) + "px");
  const text = document.body.innerText;
  const errorScreen = /This screen could not load|यह स्क्रीन नहीं खुल सकी|Application error/.test(text);
  let english = [];
  if (/[ऀ-ॿ]/.test(text.slice(0, 4000))) {
    // Data is not interface text: skip anything marked translate="no", text in another language (lang attribute), links, code.
    const KEEP = /^(GST|GSTIN|UPI|HSN|SAC|IFSC|TDS|DSO|CEI|MSME|MSMED|RBI|ODR|NEFT|IMPS|RTGS|CSV|PDF|QR|ID|CA|FullPay|Tally|Vyapar|Excel|WhatsApp|SMS|Udyam|IRN|CGST|SGST|IGST|INV|Pvt|Ltd|Co|NOS|PCS|BOX|SET|HRS|Act|Section|Rule)$/;
    const blocks = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('[translate="no"], [lang]:not([lang="hi"]):not(html), a[href^="http"], code, script, style, .mono, .sr-only')) continue;
      const block = el.closest("p, li, td, th, dd, dt, h1, h2, h3, label, button, option, span, div") ?? el;
      blocks.set(block, (blocks.get(block) ?? "") + n.textContent);
    }
    for (const line of blocks.values()) {
      const words = (line.match(/[A-Za-z][A-Za-z']{2,}/g) || []).filter((w) => !KEEP.test(w));
      if (words.length >= 4 && !/[ऀ-ॿ]/.test(line)) english.push(line.trim().slice(0, 70));
    }
  }
  return JSON.stringify({ over, out, small: small.slice(0, 4), smallN: small.length, errorScreen, english: english.slice(0, 4), englishN: english.length });
})()`;

const rows = [];
// The pack's required wording on the printed documents (checked in English).
const MUST = {
  "/print/letter/": ["Payment Demand Letter", "It is not a notice from the GST department and not a legal notice from a lawyer.", "UPI", "contact"],
  "/print/invoice/": ["Tax Invoice", "Round off", "Authorised signatory", "Place of supply", "reverse charge", "Rupees", "GSTIN"],
};
async function check(path, { lang, size, w, print = false }) {
  errors = []; docStatus = 0;
  await send("Network.clearBrowserCookies");
  for (const [n, v] of session) await cookie(n, v);
  await cookie("lang", lang); await cookie("text_size", size);
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 500 });
  const l = loaded();
  await send("Page.navigate", { url: base + path });
  await Promise.race([l, wait(15000)]);
  await send("Runtime.evaluate", { expression: `try{localStorage.setItem("fullpay.tour","off")}catch{}` });
  await wait(500);
  const p = JSON.parse((await send("Runtime.evaluate", { expression: PROBE, returnByValue: true })).result.value);
  const problems = [];
  if (docStatus >= 400) problems.push(`HTTP ${docStatus}`);
  if (errors.length) problems.push(`console: ${errors[0]}`);
  if (p.errorScreen) problems.push("error screen");
  const must = Object.entries(MUST).find(([prefix]) => path.startsWith(prefix))?.[1];
  if (must && lang === "en") {
    const text = (await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true })).result.value;
    const missing = must.filter((m) => !text.toLowerCase().includes(m.toLowerCase()));
    if (missing.length) problems.push(`missing required text: ${missing.join(", ")}`);
  }
  if (!print && p.over) problems.push(`sideways scroll: ${p.out.join("; ")}`);
  if (!print && w < 500 && p.smallN) problems.push(`${p.smallN} small targets: ${p.small.join(", ")}`);
  // Print pages stay in English by design (the pack keeps invoices and letters in English, the second language under headings).
  if (lang === "hi" && !print && p.englishN) problems.push(`${p.englishN} English lines: ${p.english.join(" | ")}`);
  rows.push({ path: path.replace(/[A-Za-z0-9_-]{20,}/g, "…"), lang, size, w, ok: problems.length === 0, problems });
  process.stdout.write(problems.length ? "x" : ".");
}

for (const path of [...OWNER, ...PUBLIC]) {
  for (const lang of ["en", "hi"]) {
    await check(path, { lang, size: "md", w: 360 });
    await check(path, { lang, size: "xl", w: 360 });
    await check(path, { lang, size: "md", w: 1280 });
  }
}
for (const path of PRINT) for (const lang of ["en", "hi"]) await check(path, { lang, size: "md", w: 1280, print: true });
ws.close(); chrome.kill();

const bad = rows.filter((r) => !r.ok);
const md = [`# Acceptance sweep`, ``, `${rows.length} checks (${OWNER.length + PUBLIC.length} screens × EN/HI × 360 px normal, 360 px largest text, 1280 px; ${PRINT.length} print pages × EN/HI). Passed: ${rows.length - bad.length}. Failed: ${bad.length}.`, ``,
  `Checks: page loads (no HTTP error, no console error, no error screen) · nothing scrolls sideways · buttons and fields at least 44 px tall on a phone · Hindi pages have no untranslated English lines.`, ``,
  ...(bad.length ? [`| Screen | Lang | Text | Width | Problem |`, `|---|---|---|---|---|`, ...bad.map((r) => `| ${r.path} | ${r.lang} | ${r.size} | ${r.w} | ${r.problems.join("<br>").replaceAll("|", "/")} |`)] : ["All passed."])];
writeFileSync("docs/acceptance.md", md.join("\n") + "\n");
console.log(`\n${rows.length - bad.length}/${rows.length} passed`);
for (const r of bad.slice(0, 60)) console.log(`${r.path} ${r.lang} ${r.size} ${r.w}: ${r.problems.join(" || ")}`);
