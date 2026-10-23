// Click every button and link on every screen, one at a time from a fresh load, and report what breaks:
// console errors, failed requests (HTTP 5xx, or 4xx other than expected validation answers), navigation off the site
// (e.g. to an internal host), or an error screen. Destructive buttons (sign out, reset, delete, reject…) are skipped.
//   node scripts/clicks.js https://fullpay-web.onrender.com [pathFilter]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const only = process.argv[3] ?? "";
const origin = new URL(base).origin;
const PAGES = ["/", "/login", "/dashboard", "/followups", "/invoices", "/invoices/new", "/customers", "/inbox", "/payments", "/forecast",
  "/chase-first", "/documents", "/approvals", "/analytics", "/team", "/activity", "/settings", "/runs", "/status", "/proof",
  "/pay/whoZYlu9YOc2d-scWQ-yx1mX1ukgynkn", "/verify", "/invoices/42", "/customers/3"].filter((p) => p.includes(only));
// Role switches are tested once, separately; clicking them mid-run would change who is signed in for the rest.
const ROLE = /^(Owner|Accountant|View only \(CA\)|मालिक|अकाउंटेंट|सिर्फ़ देखें \(CA\)|Switch to the owner|मालिक के रूप में जाएं)$/;
const SKIP = /sign out|log ?out|reset|remove access|deactivat|delete|anonymi|reject|not for us|start over|साइन आउट|रीसेट|हटाएं|नामंज़ूर|^×$|close|cancel|रद्द/i;
// SKIP_EXTRA (regex) leaves more controls alone, e.g. the demo clock on a shared live demo: SKIP_EXTRA="\\+1|\\+7|jump|day"
const EXTRA = process.env.SKIP_EXTRA ? new RegExp(process.env.SKIP_EXTRA, "i") : null;

const PORT = Number(process.env.CDP_PORT ?? 9335);
const chrome = spawn(process.env.CHROME ?? "chromium", ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "fp-clk-"))}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { await wait(200); if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false)) break; }
const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map(), listeners = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) listeners.forEach((l) => l(m)); });
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");
await send("Page.setLifecycleEventsEnabled", { enabled: true });
// window.print and confirm dialogs would block a headless run; answer dialogs automatically.
listeners.push((m) => { if (m.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true }); });

let events = [];
listeners.push((m) => {
  if (m.method === "Runtime.exceptionThrown") events.push(`JS error: ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).split("\n")[0]}`);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") events.push(`console: ${m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 140)}`);
  if (m.method === "Network.responseReceived") {
    const { status, url } = m.params.response;
    const okish = status < 400 || [401, 404].includes(status) && /favicon|\.map$/.test(url) || [409, 422].includes(status);
    if (!okish) events.push(`HTTP ${status} ${url.replace(origin, "").slice(0, 80)}`);
  }
  if (m.method === "Network.loadingFailed" && !m.params.canceled && m.params.type !== "Ping") events.push(`request failed: ${m.params.errorText}`);
  if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) {
    const u = m.params.frame.url;
    if (!u.startsWith(origin) && !u.startsWith("about:") && !u.startsWith("data:") && !u.startsWith("chrome-error:") ) events.push(`left the site: ${u.slice(0, 80)}`);
    if (u.startsWith("chrome-error:")) events.push(`navigation error page`);
  }
});

async function signIn() {
  await send("Network.clearBrowserCookies");
  await go("/");
  // Use the real button, as a visitor would.
  await evaluate(`(() => { const b = [...document.querySelectorAll("form[action='/api/auth/demo'] button")][0]; b && b.click(); })()`);
  await wait(3500);
  return evaluate("location.href");
}
async function go(path) {
  const done = new Promise((r) => { const l = (m) => { if (m.method === "Page.lifecycleEvent" && m.params.name === "networkIdle") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
  await send("Page.navigate", { url: base + path });
  await Promise.race([done, wait(20000)]);
  await evaluate(`try{localStorage.setItem("fullpay.tour","off")}catch{}`);
}
const LIST = `[...document.querySelectorAll("main button, main a[href], main summary, header button, header a[href], [role=dialog] button, aside button")]
  .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.disabled; })`;

const report = [];
const landed = await signIn();
report.push({ page: "/", control: "Open the live demo", problems: landed.startsWith(origin + "/dashboard") ? [] : [`landed on ${landed}`] });
console.log("sign-in landed on", landed);

// The role switch in the header: Accountant lands on Payments with the accountant banner; back to Owner.
{
  events = [];
  await go("/dashboard");
  await evaluate(`(() => { const b = [...document.querySelectorAll("header form button")].find((x) => /Accountant|अकाउंटेंट/.test(x.textContent)); b && b.click(); })()`);
  await wait(3500);
  const at = await evaluate("location.href");
  const banner = await evaluate(`!!document.querySelector('[role=note]')`);
  const problems = [...events];
  if (!at.startsWith(origin + "/payments")) problems.push(`accountant switch landed on ${at}`);
  if (!banner) problems.push("no accountant banner");
  report.push({ page: "/dashboard", control: "View as → Accountant", problems });
  await signIn();
}

for (const page of PAGES) {
  events = [];
  await go(page);
  const controls = await evaluate(`${LIST}.map((e, i) => ({ i, text: (e.innerText || e.getAttribute("aria-label") || e.title || e.tagName).trim().replace(/\\s+/g, " ").slice(0, 40), href: e.getAttribute("href") }))`);
  const load = [...events];
  if (load.length) report.push({ page, control: "(page load)", problems: load });
  const seen = new Set();
  for (const c of controls.slice(0, 40)) {
    const key = c.text + "|" + (c.href ?? "");
    if (seen.has(key) || SKIP.test(c.text) || ROLE.test(c.text) || EXTRA?.test(c.text) || /^(tel:|mailto:|sms:|https:\/\/wa\.me|whatsapp:)/.test(c.href ?? "")) continue;
    seen.add(key);
    if (c.href && /^https?:/.test(c.href) && !c.href.startsWith(origin)) continue; // outside links (rbi.org.in…) open in a new tab
    events = [];
    await go(page);
    const clicked = await evaluate(`(() => { const all = ${LIST}; const e = all.find((x) => ((x.innerText || x.getAttribute("aria-label") || x.title || x.tagName).trim().replace(/\\s+/g, " ").slice(0, 40)) === ${JSON.stringify(c.text)}); if (!e) return false; e.removeAttribute("target"); e.click(); return true; })()`);
    if (!clicked) continue;
    await wait(1800);
    const screen = await evaluate(`/This screen could not load|यह स्क्रीन नहीं खुल सकी|Application error|could not open this page/.test(document.body.innerText)`);
    const problems = [...events, ...(screen ? ["error screen after click"] : [])];
    process.stdout.write(problems.length ? "x" : ".");
    if (problems.length) report.push({ page, control: c.text + (c.href ? ` → ${c.href}` : ""), problems: [...new Set(problems)] });
  }
}
ws.close(); chrome.kill();
const bad = report.filter((r) => r.problems.length);
console.log(`\n${bad.length} problems`);
for (const r of bad) console.log(`${r.page} · ${r.control}: ${r.problems.slice(0, 3).join(" | ")}`);
writeFileSync(process.env.CLICKS_OUT ?? "docs/clicks.md", [`# Click test: ${base}`, ``, bad.length ? `| Page | Control | Problem |\n|---|---|---|\n${bad.map((r) => `| ${r.page} | ${r.control.replaceAll("|", "/")} | ${r.problems.slice(0, 3).join("<br>").replaceAll("|", "/")} |`).join("\n")}` : "Every button and link worked."].join("\n") + "\n");
