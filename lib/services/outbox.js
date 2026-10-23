// Outbox: every customer message is a row here first. Auto email rows are 'queued' and flush() sends them through Resend;
// owner-tap rows are 'awaiting_owner' until the owner taps WhatsApp / SMS / email in Today's follow-ups.
import { pool, withTxn } from "../db.js";
import { sendMail } from "../mail.js";
import { fmtINR } from "../money.js";
import { render, RUNG_TEMPLATE } from "../templates.js";
import { daysBetween, formatDate } from "../time.js";
import { getContext } from "./context.js";
import { event, stamp, INVOICE_SELECT } from "./common.js";
import { badRequest, conflict, notFound } from "./errors.js";

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const CHANNELS = ["email", "whatsapp", "sms"];

function contactLine(b) {
  return [b.name, b.phone, b.email].filter(Boolean).join(", ");
}

// Renders one message (subject, long body, short SMS) for one customer and one or more of their invoices.
export function compose(ctx, { customer, invoices, template, verifyHash = null }) {
  const lang = customer.preferred_lang === "hi" ? "hi" : "en";
  const first = invoices[0];
  const minDue = invoices.reduce((d, i) => (i.due_date < d ? i.due_date : d), first.due_date);
  const amount = invoices.reduce((s, i) => s + (template === "invoice_sent" ? i.total_paise : i.outstanding_paise), 0);
  const days = Math.max(0, ...invoices.map((i) => daysBetween(i.due_date, ctx.asOf)));
  const b = ctx.cfg.business;
  const vars = {
    customer_name: customer.name,
    business_name: b.name,
    invoice_numbers: invoices.map((i) => i.number).join(", "),
    amount: fmtINR(amount),
    due_date: formatDate(minDue, lang),
    days_overdue: days,
    pay_link: first.pay_token ? `${appUrl()}/pay/${first.pay_token}` : appUrl(),
    verify_link: verifyHash ? `${appUrl()}/verify/${verifyHash}` : `${appUrl()}/status`,
    contact: contactLine(b),
  };
  return { lang, ...render(template, lang, vars, ctx.cfg.messaging) };
}

// Inserts one outbox row for (customer, rung, channel) covering every invoice in the group, appends one message_queued
// event per invoice, then renders the body with a verify link to the first of those events (so the customer can check it).
export async function queue(client, ctx, { customer, invoices, rung, channel, status }) {
  if (!CHANNELS.includes(channel)) throw badRequest("invalid_channel", "Channel must be email, whatsapp or sms");
  const template = rung === "invoice_sent" ? "invoice_sent" : RUNG_TEMPLATE[rung];
  if (!template) throw badRequest("invalid_rung", `No message template for ${rung}`);
  const recipient = channel === "email" ? customer.email ?? null : customer.phone ?? null;
  const { rows } = await client.query(
    `INSERT INTO outbox (customer_id, invoice_ids, rung, channel, recipient, body, lang, status, run_id, created_at)
     VALUES ($1, $2, $3, $4, $5, '', $6, $7, $8, $9) RETURNING id`,
    [customer.id, invoices.map((i) => i.id), rung, channel, recipient, customer.preferred_lang === "hi" ? "hi" : "en", status, ctx.run_id ?? null, stamp(ctx)],
  );
  const outbox_id = rows[0].id;
  let verifyHash = null;
  for (const inv of invoices) {
    const ev = await event(client, ctx, inv.id, "message_queued", "system", { outbox_id, channel, rung, status });
    verifyHash ??= ev.entry_hash;
  }
  const msg = compose(ctx, { customer, invoices, template, verifyHash });
  const { rows: out } = await client.query("UPDATE outbox SET subject = $2, body = $3, lang = $4 WHERE id = $1 RETURNING *", [
    outbox_id, msg.subject, msg.body, msg.lang,
  ]);
  return out[0];
}

// SERVICE_API deviation 3: invoices.send() does not queue the invoice email; the invoice route calls this right after send().
export async function queueInvoiceEmail(client, ctx, invoiceId) {
  const { rows } = await client.query(`${INVOICE_SELECT} WHERE i.id = $1`, [invoiceId]);
  const inv = rows[0];
  if (!inv) throw notFound("invoice");
  if (inv.status === "draft") throw conflict("not_sent", "Send the invoice before emailing it");
  const customer = (await client.query("SELECT * FROM customers WHERE id = $1", [inv.customer_id])).rows[0];
  const status = customer.email ? "queued" : "awaiting_owner";
  return queue(client, { ...ctx, run_id: ctx.run_id ?? `invoice-${inv.id}` }, {
    customer, invoices: [inv], rung: "invoice_sent", channel: customer.email ? "email" : "whatsapp", status,
  });
}

const digits = (phone) => String(phone ?? "").replace(/\D/g, "");
const waNumber = (phone) => {
  const d = digits(phone);
  return d.length === 10 ? `91${d}` : d;
};

// One-tap links for the owner's own apps (no approval needed): WhatsApp click-to-chat, sms: and mailto:.
function actions(row) {
  const short = row.sms ?? row.body;
  return {
    whatsapp_url: row.customer_phone ? `https://wa.me/${waNumber(row.customer_phone)}?text=${encodeURIComponent(row.body)}` : null,
    sms_url: row.customer_phone ? `sms:+${waNumber(row.customer_phone)}?body=${encodeURIComponent(short)}` : null,
    mailto_url: row.customer_email
      ? `mailto:${row.customer_email}?subject=${encodeURIComponent(row.subject ?? "")}&body=${encodeURIComponent(row.body)}`
      : null,
  };
}

// list(c, ctx, {status: 'queued'|'awaiting_owner'|'sent'|'failed'|[...], run_id, invoice_id, customer_id, limit})
// Rows carry invoice_numbers, customer_name, sms (short text) and one-tap action links.
export async function list(client, ctx, { status = null, run_id = null, invoice_id = null, customer_id = null, limit = 200 } = {}) {
  const statuses = status == null ? null : Array.isArray(status) ? status : String(status).split(",");
  const { rows } = await client.query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.opt_out AS customer_opt_out,
            to_char(o.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS created_on,
            (SELECT array_agg(i.number ORDER BY i.id) FROM invoices i WHERE i.id = ANY(o.invoice_ids)) AS invoice_numbers,
            (SELECT COALESCE(sum(b.outstanding_paise), 0) FROM invoice_balances b WHERE b.invoice_id = ANY(o.invoice_ids))::bigint AS outstanding_paise
     FROM outbox o JOIN customers c ON c.id = o.customer_id
     WHERE ($1::text[] IS NULL OR o.status = ANY($1)) AND ($2::text IS NULL OR o.run_id = $2)
       AND ($3::bigint IS NULL OR $3 = ANY(o.invoice_ids)) AND ($4::bigint IS NULL OR o.customer_id = $4)
     ORDER BY o.id DESC LIMIT $5`,
    [statuses, run_id, invoice_id, customer_id, Math.min(Math.max(1, Number(limit) || 200), 500)],
  );
  const out = [];
  for (const row of rows) {
    let sms = null;
    if (row.status === "awaiting_owner" || row.status === "failed") sms = await shortText(client, ctx, row);
    const full = { ...row, invoice_ids: row.invoice_ids.map(Number), sms };
    out.push({ ...full, actions: actions(full) });
  }
  return out;
}

// The SMS text is not stored (no column); re-render it from the same template for the rows the owner may tap.
async function shortText(client, ctx, row) {
  const template = row.rung === "invoice_sent" ? "invoice_sent" : RUNG_TEMPLATE[row.rung];
  if (!template) return null;
  const { rows: invoices } = await client.query(`${INVOICE_SELECT} WHERE i.id = ANY($1) ORDER BY i.id`, [row.invoice_ids]);
  if (!invoices.length) return null;
  const customer = { id: row.customer_id, name: row.customer_name, preferred_lang: row.lang };
  return compose(ctx, { customer, invoices, template }).sms;
}

export async function get(client, ctx, id) {
  const rows = await client.query("SELECT id FROM outbox WHERE id = $1", [id]);
  if (!rows.rows.length) throw notFound("message");
  const { rows: one } = await client.query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM outbox o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [id],
  );
  return { ...one[0], actions: actions(one[0]) };
}

async function eventsFor(client, ctx, row, type, actor, payload) {
  // BIGINT[] comes back from pg as strings; the chain seals invoice_id as a number, so convert before hashing.
  for (const invoiceId of row.invoice_ids) await event(client, { ...ctx, run_id: row.run_id ?? ctx.run_id }, Number(invoiceId), type, actor, payload);
}

// Owner sent it from their own phone (wa.me / sms / mailto) and taps "Mark as sent".
export async function markSent(client, ctx, id, { channel = null } = {}) {
  if (channel != null && !CHANNELS.includes(channel)) throw badRequest("invalid_channel", "Channel must be email, whatsapp or sms");
  const { rows } = await client.query(
    `UPDATE outbox SET status = 'sent', sent_at = $2, channel = COALESCE($3, channel), error = NULL
     WHERE id = $1 AND status IN ('awaiting_owner','failed') RETURNING *`,
    [id, stamp(ctx), channel],
  );
  if (!rows.length) {
    await get(client, ctx, id);
    throw conflict("not_pending", "This message is not waiting to be sent");
  }
  await eventsFor(client, ctx, rows[0], "reminder_sent", "owner", { outbox_id: rows[0].id, channel: rows[0].channel, rung: rows[0].rung, manual: true });
  return rows[0];
}

// Put a failed (or awaiting) message back in the email queue. The route then calls flush({ ids: [id] }).
export async function retry(client, ctx, id) {
  const { rows } = await client.query(
    `UPDATE outbox o SET status = 'queued', channel = 'email', recipient = c.email, error = NULL
     FROM customers c WHERE o.id = $1 AND c.id = o.customer_id AND o.status IN ('failed','awaiting_owner') RETURNING o.*`,
    [id],
  );
  if (!rows.length) {
    await get(client, ctx, id);
    throw conflict("not_retryable", "Only a failed or waiting message can be sent again");
  }
  return rows[0];
}

// Sends queued email rows one at a time (Resend allows 10 req/s). Each row is its own transaction with the row locked
// (SKIP LOCKED), so two flushes never send the same row. Errors are recorded on the row, never thrown.
export async function flush({ ids = null, limit = 50 } = {}) {
  const { rows } = await pool.query(
    `SELECT id FROM outbox WHERE status = 'queued' AND channel = 'email' AND ($1::bigint[] IS NULL OR id = ANY($1)) ORDER BY id LIMIT $2`,
    [ids, limit],
  );
  const results = [];
  for (const { id } of rows) {
    try {
      const r = await withTxn((client) => sendRow(client, id));
      if (r) results.push(r);
    } catch (err) {
      console.error("[outbox] flush row", id, err?.message);
      results.push({ id, status: "failed", error: "internal" });
    }
  }
  return {
    attempted: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}

async function sendRow(client, id) {
  const ctx = await getContext(client);
  const { rows } = await client.query("SELECT * FROM outbox WHERE id = $1 AND status = 'queued' FOR UPDATE SKIP LOCKED", [id]);
  const row = rows[0];
  if (!row) return null;
  const attempt = row.attempts + 1;
  const res = await sendMail({
    to: row.recipient,
    subject: row.subject ?? "",
    text: row.body,
    fromName: ctx.cfg.business?.name,
    idempotencyKey: `outbox-${row.id}-${attempt}-${row.run_id ?? "manual"}`, // K2: run-scoped, so ids reused after a reseed do not 409
  });
  if (res.error) {
    await client.query("UPDATE outbox SET status = 'failed', attempts = $2, error = $3 WHERE id = $1", [row.id, attempt, res.error.message]);
    await eventsFor(client, ctx, row, "message_failed", "system", { outbox_id: row.id, error: res.error.name });
    return { id: row.id, status: "failed", error: res.error.message };
  }
  await client.query("UPDATE outbox SET status = 'sent', attempts = $2, provider_id = $3, sent_at = $4, error = NULL WHERE id = $1", [
    row.id, attempt, res.data?.id ?? null, stamp(ctx),
  ]);
  await eventsFor(client, ctx, row, "reminder_sent", "system", { outbox_id: row.id, channel: "email", rung: row.rung, provider_id: res.data?.id ?? null });
  return { id: row.id, status: "sent", provider_id: res.data?.id ?? null };
}
