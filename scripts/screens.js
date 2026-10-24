// Screenshots of the running app for the README and the deck, through headless Chromium's DevTools protocol (no extra deps).
//   node scripts/screens.js http://localhost:3100 docs/screenshots
// Needs DEMO_MODE=1 on the server (demo sign-in). It changes demo data: queues one approval and loads the sample statement.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:3100", out = "docs/screenshots"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const PORT = 9333;
const chrome = spawn(process.env.CHROME ?? "chromium", [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "fp-shots-"))}`, "about:blank",
], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ver;
for (let i = 0; i < 50 && !ver; i++) { await wait(200); ver = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map(), listeners = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) listeners.forEach((l) => l(m));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const loaded = () => new Promise((r) => { const l = (m) => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
await send("Page.enable");
await send("Network.enable");

const host = new URL(base).hostname;
async function signIn(as) {
  const r = await fetch(`${base}/api/auth/demo`, { method: "POST", body: new URLSearchParams({ as }), redirect: "manual" });
  const cookies = r.headers.getSetCookie().map((c) => c.split(";")[0]);
  await send("Network.clearBrowserCookies");
  for (const c of cookies) { const [name, ...v] = c.split("="); await send("Network.setCookie", { name, value: v.join("="), domain: host, path: "/" }); }
  return cookies.join("; ");
}
async function go(path, { w = 1440, h = 900, mobile = false, tour = "off", wait: ms = 600 } = {}) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  const l = loaded();
  await send("Page.navigate", { url: base + path });
  await l;
  // The tour card reads its state when the page mounts: set it, then reload once if it changed.
  const was = (await send("Runtime.evaluate", { expression: `(() => { try { const v = localStorage.getItem("fullpay.tour"); localStorage.setItem("fullpay.tour", ${JSON.stringify(tour)}); return v; } catch { return null; } })()`, returnByValue: true })).result.value;
  if (was !== tour) { const l2 = loaded(); await send("Page.reload"); await l2; }
  await wait(ms);
}
const js = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true });
const click = (text) => js(`(() => { const b = [...document.querySelectorAll("button,a,label")].find((e) => e.textContent.trim().startsWith(${JSON.stringify(text)})); if (b) b.click(); return !!b; })()`);
async function shot(name, { full = false } = {}) {
  let clip;
  if (full) {
    const m = await send("Page.getLayoutMetrics");
    const vw = m.cssVisualViewport.clientWidth;
    clip = { x: 0, y: 0, width: vw, height: Math.min(m.cssContentSize.height, 2600), scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  writeFileSync(join(out, `${name}.png`), Buffer.from(data, "base64"));
  console.log("saved", `${name}.png`);
}

// Set the scene: the sample statement is loaded, and the accountant has prepared one confirmation for the owner.
const ownerCookie = await signIn("owner");
await fetch(`${base}/api/payments/sample`, { method: "POST", headers: { cookie: ownerCookie } });
const acctCookie = await (async () => {
  const r = await fetch(`${base}/api/auth/demo`, { method: "POST", body: new URLSearchParams({ as: "accountant" }), redirect: "manual" });
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
})();
const list = await fetch(`${base}/api/payments?status=pending`, { headers: { cookie: acctCookie } }).then((r) => r.json());
const target1 = list.find?.((p) => p.proposals?.length && p.match_confidence >= 90) ?? list[0];
if (target1) await fetch(`${base}/api/payments/${target1.id}/confirm`, { method: "POST", headers: { cookie: acctCookie, "content-type": "application/json" }, body: "{}" });

await signIn("owner");
await go("/dashboard"); await shot("01-dashboard", { full: true });
await go("/dashboard"); await click("Review and send"); await wait(900); await shot("17-diwali-drive");
await go("/settings"); await js(`document.querySelector("input[type=date]")?.scrollIntoView({block:"center"})`); await wait(300); await shot("18-festival-calendar");
await go("/dashboard", { tour: "0" }); await shot("02-guided-tour");
await go("/followups"); await shot("03-followups", { full: true });
await go("/payments"); await shot("04-payments-matched", { full: true });
await go("/approvals"); await shot("05-approvals-owner", { full: true });
await go("/analytics"); await shot("06-analytics", { full: true });
await go("/team"); await shot("07-team", { full: true });
await go("/activity"); await shot("08-activity-log", { full: true });
await go("/invoices"); await click("Import from Tally"); await wait(400); await click("Try the Tally sample"); await wait(1500); await shot("09-import-tally-preview");
await go("/customers"); await shot("10-customers", { full: true });
await go("/forecast"); await shot("11-forecast", { full: true });
await go("/forecast"); await js(`document.getElementById("treds-h")?.scrollIntoView({block:"start"})`); await wait(300); await shot("21-treds-cash-today");
// A pay-early offer on the first invoice that would close the cash gap, then the customer's view of it.
{
  const fc = await fetch(`${base}/api/forecast`, { headers: { cookie: ownerCookie } }).then((r) => r.json());
  const g = (fc.cover_gap ?? []).find((x) => x.offer_suggestion || x.open_offer);
  if (g) {
    if (!g.open_offer) await fetch(`${base}/api/invoices/${g.invoice_id}/offer`, { method: "POST", headers: { cookie: ownerCookie, "content-type": "application/json" }, body: JSON.stringify({ discount_paise: g.offer_suggestion.discount_paise, pay_by: g.offer_suggestion.pay_by }) });
    // The API never returns pay tokens; the owner's invoice page shows the customer's link.
    const html = await fetch(`${base}/invoices/${g.invoice_id}`, { headers: { cookie: ownerCookie } }).then((r) => r.text());
    const inv = { pay_token: (html.match(/\/pay\/([A-Za-z0-9_-]{20,})/) ?? [])[1] };
    await go("/forecast"); await js(`[...document.querySelectorAll("h3")].find((h) => /cover|पूरा/.test(h.textContent))?.scrollIntoView({block:"start"})`); await wait(300); await shot("19-forecast-offers");
    await go(`/pay/${inv.pay_token}`, { w: 390, h: 844, mobile: true }); await shot("20-pay-early-offer-phone");
  }
}
// Statement link on the customer page, then what the customer sees on a phone; search; credit check; setup; calculator.
{
  const j = await fetch(`${base}/api/customers`, { headers: { cookie: ownerCookie } }).then((r) => r.json());
  const list = Array.isArray(j) ? j : j.data ?? j.customers ?? [];
  const c = [...list].sort((a, b) => (b.total_owed_paise ?? 0) - (a.total_owed_paise ?? 0))[0];
  const slow = list.find((x) => x.grade === "C") ?? [...list].sort((a, b) => (b.avg_late_days ?? 0) - (a.avg_late_days ?? 0))[0];
  await go(`/customers/${c.id}`); await js(`document.querySelector("[data-testid=statement-url]")?.scrollIntoView({block:"center"})`); await wait(300); await shot("22-statement-link");
  const html = await fetch(`${base}/customers/${c.id}`, { headers: { cookie: ownerCookie } }).then((r) => r.text());
  const token = (html.match(/\/s\/([A-Za-z0-9_-]{16,})/) ?? [])[1];
  if (token) { await go(`/s/${token}`, { w: 390, h: 844, mobile: true }); await shot("23-statement-phone", { full: true }); }
  await go(`/invoices/new?customer=${slow.id}`); await shot("25-credit-check");
}
await go("/search?q=bhatia"); await shot("24-search", { full: true });
await go("/settings"); await shot("26-setup-checklist");
await go("/calculator?amount=117186&due=2026-09-19&on=2026-10-24", { w: 390, h: 844, mobile: true }); await shot("27-interest-calculator-phone", { full: true });
// The owner confirms one matched payment; its thank-you receipt waits in Today's follow-ups.
{
  const pend = await fetch(`${base}/api/payments?status=pending`, { headers: { cookie: ownerCookie } }).then((r) => r.json());
  const p = pend.find?.((x) => x.proposals?.length && x.match_confidence >= 90);
  if (p) {
    await fetch(`${base}/api/payments/${p.id}/confirm`, { method: "POST", headers: { cookie: ownerCookie, "content-type": "application/json" }, body: "{}" });
    await go("/followups"); await js(`[...document.querySelectorAll("article")].find((a) => /RCPT-/.test(a.textContent))?.scrollIntoView({block:"start"})`); await wait(300); await shot("28-payment-receipt");
  }
}
// Pay in parts: the customer's form (a customer who reads English), the owner's Inbox card, then the agreed plan.
{
  const custs = await fetch(`${base}/api/customers`, { headers: { cookie: ownerCookie } }).then((r) => r.json());
  const english = new Set((Array.isArray(custs) ? custs : []).filter((c) => c.preferred_lang !== "hi").map((c) => String(c.id)));
  const sent = await fetch(`${base}/api/invoices?status=sent`, { headers: { cookie: ownerCookie } }).then((r) => r.json());
  const bill = sent.find((i) => !i.paused_by && i.outstanding_paise > 300000 && english.has(String(i.customer_id)));
  const page = bill ? await fetch(`${base}/invoices/${bill.id}`, { headers: { cookie: ownerCookie } }).then((r) => r.text()) : "";
  const token = (page.match(/\/pay\/([A-Za-z0-9_-]{20,})/) ?? [])[1];
  if (token) {
    await go(`/pay/${token}`, { w: 390, h: 844, mobile: true });
    await js(`(() => { const d = [...document.querySelectorAll("details")].find((x) => /Pay in parts/.test(x.textContent)); if (d) { d.open = true; d.scrollIntoView({ block: "start" }); } })()`);
    await wait(300); await shot("29-pay-in-parts-phone");
    const half = Math.floor(bill.outstanding_paise / 2 / 100) * 100;
    const today = (await fetch(`${base}/api/forecast`, { headers: { cookie: ownerCookie } }).then((r) => r.json())).today;
    const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
    await fetch(`${base}/api/pay/${token}`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "plan", parts: [{ date: day(7), amount: (half / 100).toFixed(2) }, { date: day(21), amount: ((bill.outstanding_paise - half) / 100).toFixed(2) }] }) });
    await go("/inbox"); await js(`document.getElementById("sec-plans")?.scrollIntoView({ block: "start" })`); await wait(300); await shot("30-plan-in-inbox");
    const items = await fetch(`${base}/api/inbox`, { headers: { cookie: ownerCookie } }).then((r) => r.json());
    const item = items.open?.find((i) => i.kind === "plan");
    if (item) await fetch(`${base}/api/inbox/${item.id}/resolve`, { method: "POST", headers: { cookie: ownerCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "approve_plan" }) });
    await go(`/pay/${token}`, { w: 390, h: 844, mobile: true }); await shot("31-plan-agreed-phone", { full: true });
  }
}
// Automatic reminder calls (simulated): run one demo day, then the calls section in Today's follow-ups.
await fetch(`${base}/api/demo/advance`, { method: "POST", headers: { cookie: ownerCookie, "content-type": "application/json" }, body: JSON.stringify({ days: 1 }) });
await go("/followups"); await js(`document.getElementById("sec-autocalls")?.scrollIntoView({ block: "start" })`); await wait(300); await shot("32-automatic-calls");
await signIn("accountant");
await go("/approvals"); await shot("12-approvals-accountant-view");
await signIn("viewer");
await go("/dashboard"); await shot("13-viewer-read-only");
await signIn("owner");
await go("/analytics", { w: 390, h: 844, mobile: true }); await shot("14-analytics-phone", { full: true });
await go("/approvals", { w: 390, h: 844, mobile: true }); await shot("15-approvals-phone", { full: true });
await go("/login"); await shot("16-login-roles");

ws.close();
chrome.kill();
