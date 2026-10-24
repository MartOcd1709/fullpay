// n8n (or any webhook receiver): FullPay sends a short, signed notice for the business events an owner or a CA cares
// about, after the change is committed. Off unless N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET are set on the server (never
// editable on a screen: on a public demo that would let a visitor redirect the data or make the server call any address).
// Least data: bill number, customer name, amounts, dates and links; never a phone number, email address or bank detail.
// A slow or broken receiver never slows, blocks or undoes anything: 3 s timeout, one retry, then a line in the delivery log.
import { createHmac, randomUUID } from "node:crypto";
import { pool } from "../db.js";
import { receiptNo } from "../receipts.js";
import { toIST } from "../time.js";

// Record event type -> notice type.
const MAP = {
  invoice_created: "bill.sent",
  payment_confirmed: "payment.confirmed",
  claim_submitted: "customer.claimed_paid",
  dispute_opened: "customer.disputed",
  promise_made: "customer.promised",
  plan_proposed: "customer.plan_offered",
  balance_confirmed: "customer.balance_confirmed",
  promise_broken: "promise.broken",
  plan_broken: "plan.broken",
  letter_generated: "letter.ready",
  tick_run: "daily_run",
};
export const WEBHOOK_TYPES = new Set(Object.keys(MAP));

// Only news: the customer's own promise (not one the owner typed, nor a plan's next part), and a missed plan part once.
const wanted = (e) =>
  !(e.type === "promise_made" && (e.actor !== "customer" || e.payload?.plan_id)) && !(e.type === "promise_broken" && e.payload?.plan_id);

export function webhookSetup() {
  const raw = process.env.N8N_WEBHOOK_URL ?? "";
  const secret = process.env.N8N_WEBHOOK_SECRET ?? "";
  let u = null;
  try { u = raw ? new URL(raw) : null; } catch { u = null; }
  const loopback = u && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  const configured = Boolean(u && secret.length >= 16 && (u.protocol === "https:" || (loopback && u.protocol === "http:")));
  return { configured, host: configured ? u.host : null, url: configured ? u.toString() : null, secret: configured ? secret : null };
}

const rupees = (paise) => (Number.isSafeInteger(Number(paise)) ? Number(paise) / 100 : null);
const appUrl = () => (process.env.APP_URL || "").replace(/\/+$/, "");

function details(e) {
  const p = e.payload ?? {};
  switch (e.type) {
    case "invoice_created": return { imported: Boolean(p.imported) };
    case "payment_confirmed": return { amount: rupees(p.amount_paise), paid_on: p.paid_on ?? null, receipt_no: p.payment_id ? receiptNo(p.payment_id) : null };
    case "claim_submitted": return { amount: rupees(p.amount), date: p.date ?? null, reference: p.ref ?? null };
    case "dispute_opened": return { reason: p.reason ?? null };
    case "promise_made": return { date: p.date ?? null };
    case "plan_proposed": return { parts: (p.parts ?? []).map((x) => ({ date: x.date, amount: rupees(x.amount_paise) })) };
    case "balance_confirmed": return { amount: rupees(p.amount_paise) };
    case "promise_broken":
    case "plan_broken": return { date: p.date ?? null };
    case "letter_generated": return { interest: rupees(p.interest_paise ?? 0), reply_by: p.deadline_date ?? null };
    case "tick_run": return {
      as_of: p.as_of, reminders_ready: (p.queued ?? 0) + (p.awaiting_owner ?? 0), emailed: p.queued ?? 0, waiting_for_tap: p.awaiting_owner ?? 0,
      calls: p.calls ?? 0, letters: p.letters ?? 0, promises_broken: p.promises_broken ?? 0,
      cash: p.cash ? { first_short_week: p.cash.first_short_week, lowest: rupees(p.cash.lowest_paise), buffer: rupees(p.cash.buffer_paise) } : null,
    };
    default: return {};
  }
}

// The notice for one noted event, read after the commit so it shows the bill as it now stands.
async function build(e, business) {
  const app = appUrl();
  const notice = {
    id: `evt_${String(e.hash).slice(0, 12)}`, type: MAP[e.type], at: toIST(e.at), business,
    invoice: null, customer: null, details: details(e),
    links: { verify: `${app}/v/${String(e.hash).slice(0, 16)}` },
  };
  if (e.type === "tick_run") return { ...notice, links: { ...notice.links, followups: `${app}/followups` } };
  if (e.invoice_id == null) return notice;
  const { rows } = await pool.query(
    `SELECT i.number, i.total_paise, i.due_date, i.status, b.outstanding_paise, c.name AS customer_name
     FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id JOIN customers c ON c.id = i.customer_id WHERE i.id = $1`,
    [e.invoice_id],
  );
  const r = rows[0];
  if (!r) return notice;
  return {
    ...notice,
    invoice: { number: r.number, total: rupees(r.total_paise), outstanding: rupees(Math.max(0, r.outstanding_paise)), due_date: r.due_date, status: r.status },
    customer: { name: r.customer_name },
    links: { ...notice.links, invoice: `${app}/invoices/${e.invoice_id}` },
  };
}

export const sign = (body, secret) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

async function post(setup, notice) {
  const body = JSON.stringify(notice);
  const headers = {
    "content-type": "application/json", "user-agent": "FullPay-webhook/1",
    "x-fullpay-event": notice.type, "x-fullpay-delivery": notice.id,
    "x-fullpay-signature": sign(body, setup.secret), // HMAC of the exact body, for receivers that verify it
    "x-fullpay-token": setup.secret, // for n8n's built-in Header Auth on the Webhook node
  };
  let last = { status: "failed", http: null, error: null };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(setup.url, { method: "POST", headers, body, signal: AbortSignal.timeout(3000), redirect: "error" });
      if (res.ok) return { status: "sent", http: res.status, error: null };
      last = { status: "failed", http: res.status, error: null };
      if (res.status < 500 && res.status !== 429) break; // a refusal will not change on a retry
    } catch (err) {
      last = { status: "failed", http: null, error: err?.name === "TimeoutError" ? "timeout" : "network" };
    }
  }
  return last;
}

async function log(type, r) {
  try {
    await pool.query("INSERT INTO webhook_deliveries (event_type, status, http_status, error) VALUES ($1,$2,$3,$4)", [type, r.status, r.http, r.error]);
    await pool.query("DELETE FROM webhook_deliveries WHERE id <= (SELECT max(id) - 200 FROM webhook_deliveries)");
  } catch (err) {
    console.error("[webhooks] log", err?.message);
  }
}

// Sends every notice a committed transaction noted (ctx.webhooks), one after another, and logs each result.
export async function deliver(ctx) {
  const setup = webhookSetup();
  const notes = (ctx?.webhooks ?? []).filter(wanted);
  if (!setup.configured || !notes.length) return [];
  const results = [];
  for (const e of notes) {
    const notice = await build(e, ctx.cfg?.business?.name ?? null);
    const r = await post(setup, notice);
    await log(notice.type, r);
    results.push({ type: notice.type, ...r });
  }
  return results;
}

// Fire and forget, after the commit: the owner's request never waits for the receiver.
export function deliverSoon(ctx) {
  if (!ctx?.webhooks?.length || !webhookSetup().configured) return;
  deliver(ctx).catch((err) => console.error("[webhooks]", err?.message));
}

// "Send a test event" in Settings: at most one a minute, so a shared demo cannot flood the receiver.
export async function sendTest(client, ctx) {
  const setup = webhookSetup();
  if (!setup.configured) return { status: "not_configured" };
  const { rows } = await client.query("SELECT 1 FROM webhook_deliveries WHERE event_type = 'test' AND created_at > now() - interval '60 seconds'");
  if (rows.length) return { status: "too_soon" };
  const notice = {
    id: `evt_test_${randomUUID().slice(0, 8)}`, type: "test", at: toIST(typeof ctx.ts === "function" ? ctx.ts() : ctx.ts), business: ctx.cfg.business?.name ?? null,
    invoice: null, customer: null, details: { message: "FullPay is connected" }, links: { app: appUrl() },
  };
  const r = await post(setup, notice);
  await log("test", r);
  return r;
}

export async function recent(client, limit = 8) {
  const { rows } = await client.query(
    `SELECT event_type, status, http_status, error, to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') AS at
     FROM webhook_deliveries ORDER BY id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}
