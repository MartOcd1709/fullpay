import { parseBankCsv, matchCredits, dedupeHash } from "../recon.js";
import { isISODate } from "../time.js";
import { event, stamp, loadInvoice, INVOICE_SELECT, refreshStatus, recomputePause } from "./common.js";
import { badRequest, conflict, notFound } from "./errors.js";

const MAX_CSV_BYTES = 2_000_000;

async function matcherInputs(client) {
  const inv = await client.query(`${INVOICE_SELECT} WHERE i.status IN ('sent','part_paid','disputed','paid')`);
  const cust = await client.query("SELECT id, name FROM customers WHERE anonymized_at IS NULL");
  const fys = [...new Set(inv.rows.map((r) => r.fy))].sort().reverse();
  return { invoices: inv.rows, customers: cust.rows, fys };
}

async function insertPayment(client, ctx, p, proposals) {
  const { rows } = await client.query(
    `INSERT INTO payments (customer_id, source, paid_on, amount_paise, reference, narration, dedupe_hash, status,
                           match_confidence, match_reason, flags, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11)
     ON CONFLICT (dedupe_hash) DO NOTHING RETURNING id`,
    [p.customer_id, p.source, p.paid_on, p.amount_paise, p.reference, p.narration, p.dedupe_hash ?? null, p.match_confidence, p.match_reason, p.flags, stamp(ctx)],
  );
  if (!rows.length) return null;
  for (const m of proposals) {
    await client.query("INSERT INTO payment_proposals (payment_id, invoice_id, amount_paise) VALUES ($1,$2,$3)", [rows[0].id, m.invoice_id, m.amount_paise]);
  }
  return rows[0].id;
}

// Bank CSV -> pending payments with proposals. Debits and bad rows come back in skipped[]; re-import is a no-op (dedupe_hash).
export async function importCsv(client, ctx, text) {
  if (typeof text !== "string" || !text.trim()) throw badRequest("empty_file", "The file is empty");
  if (text.length > MAX_CSV_BYTES) throw badRequest("file_too_large", "The statement is too large (2 MB max)");
  const { rows, skipped } = parseBankCsv(text);
  const credits = rows.filter((r) => r.credit_paise > 0);
  for (const r of rows) if (!(r.credit_paise > 0)) skipped.push({ line: r.line, reason: "debit" });
  const { invoices, customers, fys } = await matcherInputs(client);
  const matches = matchCredits(credits, invoices, customers, { fys });
  const imported = [];
  let duplicates_skipped = 0;
  for (const m of matches) {
    const c = m.credit;
    const dedupe_hash = dedupeHash(c);
    const id = await insertPayment(
      client,
      ctx,
      {
        customer_id: m.customer_id,
        source: "csv",
        paid_on: c.date,
        amount_paise: c.credit_paise,
        reference: c.reference,
        narration: c.narration,
        dedupe_hash,
        match_confidence: m.confidence,
        match_reason: m.reason,
        flags: m.flags,
      },
      m.matches,
    );
    if (id == null) {
      duplicates_skipped++;
      continue;
    }
    await event(client, ctx, m.matches[0]?.invoice_id ?? null, "payment_imported", "owner", { payment_id: id, dedupe: dedupe_hash });
    imported.push(id);
  }
  return {
    imported: await getMany(client, ctx, imported),
    skipped: skipped.sort((a, b) => a.line - b.line),
    duplicates_skipped,
  };
}

const isInt = (v, min = 0) => Number.isSafeInteger(v) && v >= min;

// Owner types a payment in. With invoice_id the proposal is that invoice; otherwise the matcher reads the narration.
export async function addManual(client, ctx, input = {}) {
  const { paid_on, amount_paise, invoice_id = null } = input;
  if (!isISODate(paid_on) || paid_on > ctx.asOf) throw badRequest("invalid_date", "paid_on must be a date on or before today");
  if (!isInt(amount_paise, 1)) throw badRequest("invalid_amount", "amount_paise must be a positive whole number of paise");
  const reference = typeof input.reference === "string" ? input.reference.trim().slice(0, 100) || null : null;
  const narration = typeof input.narration === "string" ? input.narration.trim().slice(0, 300) || null : null;
  let row;
  if (invoice_id != null) {
    const inv = await loadInvoice(client, invoice_id);
    if (!["sent", "part_paid", "disputed"].includes(inv.status)) throw conflict("not_open", "That invoice is not open");
    const take = Math.min(amount_paise, inv.outstanding_paise);
    const flags = amount_paise > inv.outstanding_paise ? ["overpaid"] : amount_paise < inv.outstanding_paise ? ["part"] : [];
    row = { customer_id: inv.customer_id, matches: [{ invoice_id: inv.id, amount_paise: take }], confidence: 100, reason: `Entered by the owner against ${inv.number}`, flags };
  } else {
    const { invoices, customers, fys } = await matcherInputs(client);
    const credit = { line: 0, date: paid_on, narration: narration ?? "", reference, debit_paise: 0, credit_paise: amount_paise };
    const [m] = matchCredits([credit], invoices, customers, { fys });
    row = { customer_id: input.customer_id ?? m.customer_id, matches: m.matches, confidence: m.confidence, reason: m.reason, flags: m.flags };
  }
  const id = await insertPayment(
    client,
    ctx,
    { customer_id: row.customer_id, source: "manual", paid_on, amount_paise, reference, narration, match_confidence: row.confidence, match_reason: row.reason, flags: row.flags },
    row.matches,
  );
  return get(client, ctx, id);
}

export async function get(client, ctx, id) {
  if (!/^\d+$/.test(String(id))) throw notFound("payment");
  const { rows } = await client.query(
    "SELECT p.*, c.name AS customer_name FROM payments p LEFT JOIN customers c ON c.id = p.customer_id WHERE p.id = $1",
    [id],
  );
  if (!rows.length) throw notFound("payment");
  const proposals = await client.query(
      "SELECT pp.invoice_id, pp.amount_paise, i.number FROM payment_proposals pp JOIN invoices i ON i.id = pp.invoice_id WHERE pp.payment_id = $1 ORDER BY i.due_date, i.id",
      [id],
    );
  const allocations = await client.query(
      "SELECT pa.invoice_id, pa.amount_paise, pa.allocated_on, i.number FROM payment_allocations pa JOIN invoices i ON i.id = pa.invoice_id WHERE pa.payment_id = $1 ORDER BY pa.id",
      [id],
    );
  return { ...rows[0], proposals: proposals.rows, allocations: allocations.rows };
}

// status: 'pending' | 'confirmed' | 'rejected' | undefined (all)
export async function list(client, ctx, { status } = {}) {
  const { rows } = await client.query("SELECT id FROM payments WHERE ($1::text IS NULL OR status = $1) ORDER BY paid_on DESC, id DESC", [status ?? null]);
  return getMany(client, ctx, rows.map((r) => r.id));
}

async function getMany(client, ctx, ids) {
  const out = [];
  for (const id of ids) out.push(await get(client, ctx, id));
  return out;
}

async function lockPayment(client, id) {
  if (!/^\d+$/.test(String(id))) throw notFound("payment");
  const { rows } = await client.query("SELECT * FROM payments WHERE id = $1 FOR UPDATE", [id]);
  if (!rows.length) throw notFound("payment");
  if (rows[0].status !== "pending") throw conflict("not_pending", `This payment is already ${rows[0].status}`);
  return rows[0];
}

async function resolveClaimItems(client, ctx, paymentId, resolution, reply = null) {
  const { rows } = await client.query(
    `UPDATE inbox_items SET status = 'resolved', resolution = $2, resolved_on = $3, reply = $4
     WHERE payment_id = $1 AND status = 'open' RETURNING invoice_id`,
    [paymentId, resolution, ctx.asOf, reply],
  );
  return rows.map((r) => r.invoice_id);
}

// The gate: nothing is allocated (or marked paid) until the owner confirms. allocations default to the matcher's proposals.
export async function confirm(client, ctx, id, allocations = null) {
  const pay = await lockPayment(client, id);
  if (allocations == null) {
    const { rows } = await client.query("SELECT invoice_id, amount_paise FROM payment_proposals WHERE payment_id = $1 ORDER BY invoice_id", [pay.id]);
    allocations = rows;
  }
  if (!Array.isArray(allocations) || allocations.length === 0) throw badRequest("no_allocations", "Choose at least one invoice for this payment");
  const seen = new Set();
  let total = 0;
  const invs = [];
  for (const a of allocations) {
    if (!isInt(a?.amount_paise, 1)) throw badRequest("invalid_amount", "Each allocation needs a positive amount in paise");
    if (seen.has(String(a.invoice_id))) throw badRequest("duplicate_invoice", "An invoice appears twice in the allocations");
    seen.add(String(a.invoice_id));
    const inv = await loadInvoice(client, a.invoice_id, { lock: true });
    if (!["sent", "part_paid", "disputed"].includes(inv.status)) throw conflict("not_open", `${inv.number ?? "That invoice"} is not open`);
    if (a.amount_paise > inv.outstanding_paise) throw badRequest("over_allocated", `${inv.number} has only ${inv.outstanding_paise} paise outstanding`);
    total += a.amount_paise;
    invs.push({ inv, amount_paise: a.amount_paise });
  }
  if (total > pay.amount_paise) throw badRequest("over_allocated", "Allocations add up to more than the payment");
  for (const { inv, amount_paise } of invs) {
    await client.query("INSERT INTO payment_allocations (payment_id, invoice_id, amount_paise, allocated_on) VALUES ($1,$2,$3,$4)", [
      pay.id,
      inv.id,
      amount_paise,
      pay.paid_on,
    ]);
  }
  await client.query("UPDATE payments SET status = 'confirmed', confirmed_at = $2, customer_id = COALESCE(customer_id, $3) WHERE id = $1", [
    pay.id,
    stamp(ctx),
    invs[0].inv.customer_id,
  ]);
  const claimInvoices = await resolveClaimItems(client, ctx, pay.id, "mark_paid");
  for (const { inv, amount_paise } of invs) {
    await event(client, ctx, inv.id, "payment_confirmed", "owner", {
      payment_id: pay.id,
      amount_paise,
      paid_on: pay.paid_on,
      source: pay.source,
      unallocated_paise: pay.amount_paise - total,
    });
    await refreshStatus(client, ctx, inv.id);
    await recomputePause(client, inv.id);
  }
  for (const invId of claimInvoices) if (!seen.has(String(invId))) await recomputePause(client, invId);
  return get(client, ctx, pay.id);
}

export async function reject(client, ctx, id, { reply = null } = {}) {
  const pay = await lockPayment(client, id);
  await client.query("UPDATE payments SET status = 'rejected' WHERE id = $1", [pay.id]);
  const invoiceIds = await resolveClaimItems(client, ctx, pay.id, "reject", typeof reply === "string" ? reply.slice(0, 1000) : null);
  for (const invId of invoiceIds) {
    await event(client, ctx, invId, "claim_rejected", "owner", { payment_id: pay.id, reply: typeof reply === "string" ? reply.slice(0, 1000) : null });
    await recomputePause(client, invId);
  }
  return get(client, ctx, pay.id);
}
