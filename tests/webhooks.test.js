// n8n notices: sent after the commit, signed, least data, never on a rollback, never blocking; a local receiver stands in for n8n.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { addDays } from "../lib/time.js";

const skip = !process.env.DATABASE_URL;
const SECRET = "test-secret-0123456789abcdef";
let db, seedMod, ctxMod, pub, promises, T, W, server;
const got = []; // { headers, body }
let reply = 200;

before(async () => {
  if (skip) return;
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { got.push({ headers: req.headers, raw, body: JSON.parse(raw) }); res.writeHead(reply); res.end("ok"); });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.N8N_WEBHOOK_URL = `http://127.0.0.1:${server.address().port}/webhook/fullpay`;
  process.env.N8N_WEBHOOK_SECRET = SECRET;
  db = await import("../lib/db.js");
  seedMod = await import("../db/seed.js");
  ctxMod = await import("../lib/services/context.js");
  pub = await import("../lib/services/public.js");
  promises = await import("../lib/services/promises.js");
  T = await import("../lib/services/tick.js");
  W = await import("../lib/services/webhooks.js");
  await db.withTxn((c) => seedMod.seed(c));
});
after(async () => {
  if (skip) return;
  await new Promise((r) => setTimeout(r, 300)); // let a last fire-and-forget delivery finish
  delete process.env.N8N_WEBHOOK_URL;
  await db.withTxn((c) => seedMod.seed(c));
  await db.pool.end();
  server.close();
});

const waitFor = async (pred, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const hit = got.find(pred); if (hit) return hit; await new Promise((r) => setTimeout(r, 50)); }
  return null;
};
const openBill = async (n = 0) => (await db.pool.query(
  `SELECT i.id, i.number, i.pay_token, c.name FROM invoices i JOIN customers c ON c.id = i.customer_id
   WHERE i.status = 'sent' AND i.paused_by IS NULL AND i.pay_token IS NOT NULL ORDER BY i.id`)).rows[n];

test("a customer's dispute reaches n8n once committed: signed, with the bill and the link, and no contact details", { skip }, async () => {
  const bill = await openBill(0);
  await ctxMod.run((c, ctx) => pub.dispute(c, ctx, bill.pay_token, { reason: "Rate is higher than our PO" }));
  const hit = await waitFor((g) => g.body.type === "customer.disputed" && g.body.invoice?.number === bill.number);
  assert.ok(hit, "the notice arrived");
  assert.equal(hit.headers["x-fullpay-signature"], W.sign(hit.raw, SECRET), "HMAC of the exact body");
  assert.equal(hit.headers["x-fullpay-token"], SECRET, "for n8n Header Auth");
  assert.equal(hit.headers["x-fullpay-event"], "customer.disputed");
  assert.deepEqual([hit.body.customer.name, hit.body.details.reason], [bill.name, "Rate is higher than our PO"]);
  assert.match(hit.body.links.verify, /\/v\/[0-9a-f]{16}$/);
  assert.match(hit.body.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+05:30$/, "India time, for the sheet");
  assert.match(hit.body.links.invoice, new RegExp(`/invoices/${bill.id}$`));
  assert.doesNotMatch(hit.raw, /@|\+91|\b\d{10}\b|ifsc|account/i, "no email, phone or bank detail");
});

test("a rolled-back change sends nothing, and an owner-typed promise is not news", { skip }, async () => {
  const bill = await openBill(1);
  const before = got.length;
  await assert.rejects(ctxMod.run(async (c, ctx) => {
    await pub.dispute(c, ctx, bill.pay_token, { reason: "never saved" });
    throw new Error("roll back");
  }));
  await ctxMod.run((c, ctx) => promises.create(c, ctx, { invoice_id: bill.id, promised_date: addDays(ctx.asOf, 3), actor: "owner" }));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(got.slice(before).filter((g) => g.body.invoice?.number === bill.number).length, 0);
});

test("the daily run sends one morning digest with counts and the cash picture", { skip }, async () => {
  const s = await ctxMod.run((c, ctx) => T.tick(c, ctx, { source: "test" }));
  const hit = await waitFor((g) => g.body.type === "daily_run" && g.body.details.as_of === s.as_of);
  assert.ok(hit);
  assert.equal(hit.body.details.calls, s.calls);
  assert.equal(hit.body.details.reminders_ready, s.queued + s.awaiting_owner);
  assert.ok("first_short_week" in hit.body.details.cash && typeof hit.body.details.cash.lowest === "number");
});

test("a failing receiver is retried once, logged, and never throws", { skip }, async () => {
  reply = 500;
  const before = got.length;
  const r = await W.deliver({ cfg: { business: { name: "X" } }, webhooks: [{ type: "letter_generated", actor: "system", invoice_id: null, payload: {}, hash: "a".repeat(64), at: "2026-10-24T10:00:00" }] });
  reply = 200;
  assert.deepEqual(r.map((x) => [x.type, x.status, x.http]), [["letter.ready", "failed", 500]]);
  assert.equal(got.length - before, 2, "one retry after a 5xx");
  const [row] = (await db.pool.query("SELECT status, http_status FROM webhook_deliveries ORDER BY id DESC LIMIT 1")).rows;
  assert.deepEqual([row.status, row.http_status], ["failed", 500]);
});

test("Send a test event: delivered, then refused for a minute; plain http or a short secret is not accepted", { skip }, async () => {
  await db.pool.query("DELETE FROM webhook_deliveries WHERE event_type = 'test'"); // a test sent by hand just now must not decide this
  const first = await ctxMod.run((c, ctx) => W.sendTest(c, ctx));
  assert.equal(first.status, "sent");
  assert.ok(await waitFor((g) => g.body.type === "test"));
  assert.equal((await ctxMod.run((c, ctx) => W.sendTest(c, ctx))).status, "too_soon");
  const url = process.env.N8N_WEBHOOK_URL;
  process.env.N8N_WEBHOOK_URL = "http://example.com/webhook/fullpay";
  assert.equal(W.webhookSetup().configured, false, "http only on this machine");
  process.env.N8N_WEBHOOK_URL = url;
  process.env.N8N_WEBHOOK_SECRET = "short";
  assert.equal(W.webhookSetup().configured, false);
  process.env.N8N_WEBHOOK_SECRET = SECRET;
});
