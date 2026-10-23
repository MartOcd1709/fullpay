// Bring an existing book of unpaid invoices (Tally / Vyapar / Excel export) into FullPay. preview() is read-only;
// commit() writes. Re-importing the same file is a no-op: invoice numbers already in FullPay are skipped.
import { createHash, randomBytes } from "node:crypto";
import { parseInvoiceCsv } from "../invoiceImport.js";
import { normalizeName } from "../recon.js";
import { validateGSTIN, docTypeFor } from "../gst.js";
import { addDays, daysBetween, fyOf } from "../time.js";
import { event, stamp, tokenExpiry } from "./common.js";
import { effectiveCreditDays } from "./invoices.js";
import * as customers from "./customers.js";
import * as payments from "./payments.js";
import { badRequest } from "./errors.js";

const MAX_BYTES = 2_000_000;

export async function preview(client, ctx, text) {
  if (typeof text !== "string" || !text.trim()) throw badRequest("empty_file", "The file is empty");
  if (text.length > MAX_BYTES) throw badRequest("file_too_large", "The file is too large (2 MB max)");
  const parsed = parseInvoiceCsv(text);
  if (!parsed.ok) throw badRequest("no_header", "Could not find the column headings: the file needs at least a customer name and an amount column");

  const numbers = parsed.rows.map((r) => r.value.number?.toLowerCase()).filter(Boolean);
  const { rows: existing } = await client.query("SELECT lower(number) AS n FROM invoices WHERE lower(number) = ANY($1::text[])", [numbers]);
  const taken = new Set(existing.map((r) => r.n));
  const { rows: known } = await client.query("SELECT id, name, gstin FROM customers WHERE anonymized_at IS NULL ORDER BY id");
  const byGstin = new Map(known.filter((c) => c.gstin).map((c) => [c.gstin, c]));
  const byName = new Map();
  for (const c of known) if (!byName.has(normalizeName(c.name))) byName.set(normalizeName(c.name), c);
  const fresh = new Map(); // normalised name -> first row that introduces a new customer

  const rows = parsed.rows.map((r) => {
    const v = r.value;
    const errors = [...r.errors];
    if (v.number && taken.has(v.number.toLowerCase())) errors.push("already_in_fullpay");
    if (v.gstin && !validateGSTIN(v.gstin).valid) errors.push("bad_gstin");
    if (v.date && v.date > ctx.asOf) errors.push("future_date");
    const settled = !errors.length && v.balance_paise === 0;
    const match = (v.gstin && byGstin.get(v.gstin)) || byName.get(normalizeName(v.customer));
    const key = normalizeName(v.customer);
    if (!match && !errors.length && !settled && !fresh.has(key)) fresh.set(key, v);
    return { line: r.line, value: v, errors, settled, customer: match ? { id: match.id, name: match.name } : { id: null, name: v.customer, new: true } };
  });
  const ok = rows.filter((r) => !r.errors.length && !r.settled);
  return {
    header_line: parsed.header_line, mapping: parsed.mapping, unmapped: parsed.unmapped, truncated: parsed.truncated,
    file_sha256: createHash("sha256").update(text).digest("hex"),
    rows,
    summary: {
      rows: rows.length, importable: ok.length, with_problems: rows.filter((r) => r.errors.length).length,
      already_paid: rows.filter((r) => r.settled).length,
      new_customers: fresh.size, matched_customers: new Set(ok.filter((r) => r.customer.id).map((r) => r.customer.id)).size,
      total_paise: ok.reduce((a, r) => a + r.value.total_paise, 0), outstanding_paise: ok.reduce((a, r) => a + r.value.balance_paise, 0),
      overdue: ok.filter((r) => (r.value.due_date ?? r.value.date) < ctx.asOf).length,
    },
  };
}

export async function commit(client, ctx, text) {
  const p = await preview(client, ctx, text);
  const cfg = ctx.cfg;
  const b = cfg.business ?? {};
  const payee = { vpa: b.vpa ?? null, bank_last4: b.bank?.account_last4 ?? null };
  const made = new Map(); // normalised name -> new customer row
  const created = [];
  for (const r of p.rows) {
    if (r.errors.length || r.settled) continue;
    const v = r.value;
    let customer = r.customer.id ? { id: r.customer.id } : made.get(normalizeName(v.customer));
    if (!customer) {
      const g = v.gstin ? validateGSTIN(v.gstin) : null;
      customer = await customers.create(client, ctx, {
        name: v.customer, gstin: g?.valid ? g.gstin : null, state_code: g?.state_code ?? b.state_code,
        email: v.email, phone: v.phone, credit_days: null,
      });
      made.set(normalizeName(v.customer), customer);
    }
    const full = (await client.query("SELECT * FROM customers WHERE id = $1", [customer.id])).rows[0];
    const credit_days = v.due_date ? Math.max(0, daysBetween(v.date, v.due_date)) : effectiveCreditDays(full);
    const due_date = v.due_date ?? addDays(v.date, credit_days);
    const { rows } = await client.query(
      `INSERT INTO invoices (customer_id, fy, seq, number, issue_date, acceptance_date, credit_days, due_date, place_of_supply, doc_type,
                             status, taxable_paise, total_paise, pay_token, pay_token_expires_at, notes, imported, created_at, sent_at)
       VALUES ($1,$2,NULL,$3,$4,$4,$5,$6,$7,$8,'sent',$9,$9,$10,$11,$12,true,$13,$13) RETURNING id`,
      [full.id, fyOf(v.date), v.number, v.date, credit_days, due_date, full.state_code, docTypeFor(b.registration ?? "regular"),
       v.total_paise, randomBytes(24).toString("base64url"), tokenExpiry(addDays(ctx.asOf, 60)),
       `Imported on ${ctx.asOf} from line ${r.line} of a file (sha256 ${p.file_sha256.slice(0, 16)})`, stamp(ctx)],
    );
    const id = rows[0].id;
    await client.query(
      `INSERT INTO invoice_items (invoice_id, position, description, hsn_sac, qty_milli, unit, rate_paise, gst_bps, taxable_paise)
       VALUES ($1, 1, $2, NULL, 1000, 'NOS', $3, 0, $3)`,
      [id, `Invoice ${v.number} as per your books (imported)`, v.total_paise],
    );
    await event(client, ctx, id, "invoice_created", "owner", {
      number: v.number, total_paise: v.total_paise, due_date, payee, payee_vpa: payee.vpa, bank_last4: payee.bank_last4,
      imported: { file_sha256: p.file_sha256, line: r.line, outstanding_paise: v.balance_paise },
    });
    // Money already received before FullPay: dated on the invoice date, so MSMED interest is never overstated.
    const received = v.total_paise - v.balance_paise;
    if (received > 0) {
      const pay = await payments.addManual(client, ctx, {
        invoice_id: id, paid_on: v.date, amount_paise: received, reference: `Received before FullPay (${v.number})`,
      });
      await payments.confirm(client, ctx, pay.id);
    }
    created.push(id);
  }
  return { imported: created.length, new_customers: made.size, summary: p.summary, invoice_ids: created };
}
