import { randomBytes } from "node:crypto";
import { invoiceTotals, isInterstate, docTypeFor, validateHSN, invoiceNumber, STATE_CODES } from "../gst.js";
import { addDays, daysBetween, fyOf, isISODate } from "../time.js";
import { upiString } from "../upi.js";
import {
  event, stamp, loadInvoice, INVOICE_SELECT, interestInputs, interestFor, displayStatus, isDueSoon, isOverdue, tokenExpiry,
} from "./common.js";
import { badRequest, conflict } from "./errors.js";

const MAX_CREDIT_DAYS = 45;
const DEFAULT_CREDIT_DAYS = 15; // MSMED s.15: nothing agreed in writing => 15 days
const SEQ_LOCK = 43;
const TOKEN_DAYS = 60;

const int = (v, name, min = 0) => {
  if (!Number.isSafeInteger(v) || v < min) throw badRequest("invalid_item", `${name} must be a whole number >= ${min}`);
  return v;
};

function cleanItems(items, cfg, docType) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw badRequest("items_required", "An invoice needs 1 to 100 items");
  return items.map((it, i) => {
    const description = typeof it?.description === "string" ? it.description.trim() : "";
    if (!description || description.length > 300) throw badRequest("invalid_item", `Item ${i + 1}: description is required`);
    const hsn_sac = it.hsn_sac == null || it.hsn_sac === "" ? null : String(it.hsn_sac).trim();
    if (docType === "tax_invoice" && !validateHSN(hsn_sac, cfg.business.turnover_paise)) {
      throw badRequest("invalid_hsn", `Item ${i + 1}: HSN/SAC must be 4, 6 or 8 digits`);
    }
    const gst_bps = int(it.gst_bps ?? 0, `Item ${i + 1}: gst_bps`);
    if (!cfg.gst.rates_bps.includes(gst_bps)) throw badRequest("invalid_gst_rate", `Item ${i + 1}: ${gst_bps / 100}% is not a GST rate`);
    const qty_milli = int(it.qty_milli, `Item ${i + 1}: qty_milli`, 1);
    const rate_paise = int(it.rate_paise, `Item ${i + 1}: rate_paise`);
    const discount_paise = int(it.discount_paise ?? 0, `Item ${i + 1}: discount_paise`);
    if (discount_paise > Math.round((qty_milli * rate_paise) / 1000)) throw badRequest("invalid_item", `Item ${i + 1}: discount is more than the amount`);
    const unit = typeof it.unit === "string" && it.unit.trim() ? it.unit.trim().toUpperCase().slice(0, 8) : "PCS";
    return { description, hsn_sac, qty_milli, unit, rate_paise, discount_paise, gst_bps };
  });
}

async function customerRow(client, id) {
  const { rows } = await client.query("SELECT * FROM customers WHERE id = $1", [id]);
  if (!rows.length) throw badRequest("unknown_customer", "Pick an existing customer");
  return rows[0];
}

export const effectiveCreditDays = (customer) => Math.min(customer.credit_days ?? DEFAULT_CREDIT_DAYS, MAX_CREDIT_DAYS);

async function computeDraft(client, cfg, input) {
  const customer = await customerRow(client, input.customer_id);
  if (!isISODate(input.issue_date)) throw badRequest("invalid_date", "issue_date must be YYYY-MM-DD");
  if (input.delivery_date != null && !isISODate(input.delivery_date)) throw badRequest("invalid_date", "delivery_date must be YYYY-MM-DD");
  const place_of_supply = String(input.place_of_supply ?? customer.state_code).padStart(2, "0");
  if (!Object.hasOwn(STATE_CODES, place_of_supply)) throw badRequest("invalid_place_of_supply", "place_of_supply must be a GST state code");
  const registration = cfg.business.registration ?? "regular";
  const doc_type = docTypeFor(registration);
  const items = cleanItems(input.items, cfg, doc_type);
  const totals = invoiceTotals(items, { interstate: isInterstate(cfg.business.state_code, place_of_supply), registration });
  const credit_days = effectiveCreditDays(customer);
  const delivery_date = input.delivery_date ?? null;
  return {
    customer,
    row: {
      customer_id: customer.id,
      fy: fyOf(input.issue_date),
      issue_date: input.issue_date,
      delivery_date,
      credit_days,
      due_date: addDays(delivery_date ?? input.issue_date, credit_days),
      place_of_supply,
      reverse_charge: input.reverse_charge === true,
      ship_to: typeof input.ship_to === "string" && input.ship_to.trim() ? input.ship_to.trim().slice(0, 500) : null,
      doc_type,
      taxable_paise: totals.taxable_paise,
      cgst_paise: totals.cgst_paise,
      sgst_paise: totals.sgst_paise,
      igst_paise: totals.igst_paise,
      round_off_paise: totals.round_off_paise,
      total_paise: totals.total_paise,
      notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
    },
    items: items.map((it, i) => ({ ...it, ...totals.lines[i], position: i + 1 })),
  };
}

const ITEM_COLS = ["position", "description", "hsn_sac", "qty_milli", "unit", "rate_paise", "discount_paise", "gst_bps", "taxable_paise", "cgst_paise", "sgst_paise", "igst_paise"];

async function writeItems(client, invoiceId, items) {
  await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);
  for (const it of items) {
    await client.query(
      `INSERT INTO invoice_items (invoice_id, ${ITEM_COLS.join(", ")}) VALUES ($1, ${ITEM_COLS.map((_, i) => `$${i + 2}`).join(", ")})`,
      [invoiceId, ...ITEM_COLS.map((k) => it[k])],
    );
  }
}

export async function createDraft(client, ctx, input) {
  const { row, items } = await computeDraft(client, ctx.cfg, input ?? {});
  const cols = Object.keys(row);
  const { rows } = await client.query(
    `INSERT INTO invoices (${cols.join(", ")}, status, created_at) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}, 'draft', $${cols.length + 1})
     RETURNING id`,
    [...cols.map((k) => row[k]), stamp(ctx)],
  );
  await writeItems(client, rows[0].id, items);
  return get(client, ctx, rows[0].id);
}

export async function updateDraft(client, ctx, id, input) {
  const inv = await loadInvoice(client, id, { lock: true });
  if (inv.status !== "draft") throw conflict("not_draft", "Only a draft can be edited; issue a credit note instead");
  const { rows: items } = await client.query("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position", [inv.id]);
  const merged = {
    customer_id: inv.customer_id,
    issue_date: inv.issue_date,
    delivery_date: inv.delivery_date,
    place_of_supply: inv.place_of_supply,
    reverse_charge: inv.reverse_charge,
    ship_to: inv.ship_to,
    notes: inv.notes,
    items,
    ...input,
  };
  const { row, items: next } = await computeDraft(client, ctx.cfg, merged);
  const cols = Object.keys(row);
  await client.query(`UPDATE invoices SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [inv.id, ...cols.map((k) => row[k])]);
  await writeItems(client, inv.id, next);
  return get(client, ctx, inv.id);
}

// Draft -> sent. The number is allocated here, gap-free per FY, under one advisory lock (43).
export async function send(client, ctx, id, { token = null } = {}) {
  await client.query(`SELECT pg_advisory_xact_lock(${SEQ_LOCK})`);
  const inv = await loadInvoice(client, id, { lock: true });
  if (inv.status !== "draft") throw conflict("already_sent", "This invoice has already been sent");
  const customer = await customerRow(client, inv.customer_id);
  const { rows } = await client.query("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM invoices WHERE fy = $1", [inv.fy]);
  const seq = rows[0].seq;
  const number = invoiceNumber(inv.fy, seq);
  const credit_days = effectiveCreditDays(customer);
  const acceptance_date = inv.delivery_date ?? inv.issue_date;
  const due_date = addDays(acceptance_date, credit_days);
  const pay_token = token ?? randomBytes(24).toString("base64url");
  const sentAt = stamp(ctx);
  await client.query(
    `UPDATE invoices SET seq = $2, number = $3, acceptance_date = $4, credit_days = $5, due_date = $6, status = 'sent',
            pay_token = $7, pay_token_expires_at = $8, sent_at = $9 WHERE id = $1`,
    [inv.id, seq, number, acceptance_date, credit_days, due_date, pay_token, tokenExpiry(addDays(ctx.asOf, TOKEN_DAYS)), sentAt],
  );
  const b = ctx.cfg.business;
  const payee = { vpa: b.vpa ?? null, bank_last4: b.bank?.account_last4 ?? null };
  await event(client, ctx, inv.id, "invoice_created", "owner", {
    number,
    total_paise: inv.total_paise,
    due_date,
    payee,
    payee_vpa: payee.vpa, // flat copies: lib/chain.js verifyEntry reads these for /verify
    bank_last4: payee.bank_last4,
  });
  return get(client, ctx, inv.id);
}

function decorate(inv, asOf) {
  const days = inv.status === "draft" ? 0 : daysBetween(inv.due_date, asOf);
  return {
    ...inv,
    days_overdue: Math.max(0, days),
    display_status: displayStatus(inv, asOf),
  };
}

const STATUS_FILTERS = {
  due_soon: isDueSoon,
  overdue: isOverdue,
};

// filters: { customer_id, status (any of the 7 display statuses), due_from, due_to, min_days_overdue, max_days_overdue, q }
export async function list(client, ctx, filters = {}) {
  const { rows } = await client.query(`${INVOICE_SELECT} ORDER BY i.issue_date DESC, i.id DESC`);
  const q = typeof filters.q === "string" ? filters.q.trim().toLowerCase() : "";
  const minOver = filters.min_days_overdue == null || filters.min_days_overdue === "" ? null : Number(filters.min_days_overdue);
  const maxOver = filters.max_days_overdue == null || filters.max_days_overdue === "" ? null : Number(filters.max_days_overdue);
  // ponytail: filters run in JS over every invoice; push into SQL past a few thousand invoices.
  return rows
    .map((r) => decorate(r, ctx.asOf))
    .filter((r) => filters.customer_id == null || filters.customer_id === "" || String(r.customer_id) === String(filters.customer_id))
    .filter((r) => {
      if (!filters.status) return true;
      return STATUS_FILTERS[filters.status] ? STATUS_FILTERS[filters.status](r, ctx.asOf) : r.display_status === filters.status;
    })
    .filter((r) => !filters.due_from || r.due_date >= filters.due_from)
    .filter((r) => !filters.due_to || r.due_date <= filters.due_to)
    .filter((r) => minOver == null || (r.status !== "draft" && r.status !== "paid" && r.days_overdue >= minOver))
    .filter((r) => maxOver == null || (r.status !== "draft" && r.status !== "paid" && r.days_overdue <= maxOver))
    .filter((r) => !q || (r.number ?? "").toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q))
    .map(({ pay_token, ...r }) => r);
}

export async function timeline(client, invoiceId) {
  const { rows } = await client.query(
    `SELECT id, type, actor, payload, run_id, to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ts, prev_hash, entry_hash
     FROM escalation_events WHERE invoice_id = $1 ORDER BY id`,
    [invoiceId],
  );
  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}

export async function get(client, ctx, id) {
  const inv = await loadInvoice(client, id);
  const q = (text) => client.query(text, [inv.id]);
  const items = await q("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position");
  const allocations = await q(
    `SELECT pa.id, pa.payment_id, pa.amount_paise, pa.allocated_on, p.reference, p.source FROM payment_allocations pa
     JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed' WHERE pa.invoice_id = $1 ORDER BY pa.allocated_on, pa.id`,
  );
  const promises = await q("SELECT * FROM promises WHERE invoice_id = $1 ORDER BY id");
  const credit_notes = await q("SELECT * FROM credit_notes WHERE invoice_id = $1 ORDER BY id");
  const inbox = await q("SELECT * FROM inbox_items WHERE invoice_id = $1 ORDER BY id");
  const events = await timeline(client, inv.id);
  const inputs = await interestInputs(client, inv.id);
  const b = ctx.cfg.business;
  const upi =
    inv.status !== "draft" && inv.outstanding_paise > 0 && b.vpa
      ? upiString({ pa: b.vpa, pn: b.name, am_paise: inv.outstanding_paise, tn: inv.number })
      : null;
  return {
    ...decorate(inv, ctx.asOf),
    net_total_paise: inv.total_paise - inv.credited_paise,
    items: items.rows,
    allocations: allocations.rows,
    promises: promises.rows,
    credit_notes: credit_notes.rows,
    inbox: inbox.rows,
    timeline: events,
    interest: interestFor(ctx.cfg, inv, inputs, ctx.asOf),
    upi,
  };
}

