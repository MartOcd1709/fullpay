// One search box for the whole app: customers, bills and payments by name, number, GSTIN, phone, UTR or amount.
import { rupeesToPaise } from "../money.js";
import * as invoices from "./invoices.js";

const LIMIT = 10;

// "50,000", "₹1,17,186.00" or "117186" also finds bills and payments of exactly that amount.
function asAmount(q) {
  if (!/\d/.test(q)) return null;
  try { const p = rupeesToPaise(q); return p > 0 ? p : null; } catch { return null; }
}

export async function search(client, ctx, raw) {
  const q = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
  if (q.length < 2) return { q, customers: [], invoices: [], payments: [] };
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const amount = asAmount(q);

  const { rows: customers } = await client.query(
    `SELECT id, name, gstin, phone FROM customers
     WHERE anonymized_at IS NULL AND (name ILIKE $1 OR gstin ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1)
     ORDER BY name LIMIT ${LIMIT}`,
    [like],
  );

  const all = await invoices.list(client, ctx, {});
  const lower = q.toLowerCase();
  const bills = all
    .filter((r) => (r.number ?? "").toLowerCase().includes(lower) || r.customer_name.toLowerCase().includes(lower)
      || (amount != null && (r.total_paise === amount || r.outstanding_paise === amount)))
    .slice(0, LIMIT);

  const { rows: payments } = await client.query(
    `SELECT p.id, p.paid_on, p.amount_paise, p.reference, p.status, c.name AS customer_name,
            (SELECT pa.invoice_id FROM payment_allocations pa WHERE pa.payment_id = p.id ORDER BY pa.id LIMIT 1) AS invoice_id
     FROM payments p LEFT JOIN customers c ON c.id = p.customer_id
     WHERE p.reference ILIKE $1 OR p.narration ILIKE $1 OR c.name ILIKE $1 OR p.amount_paise = $2
     ORDER BY p.paid_on DESC, p.id DESC LIMIT ${LIMIT}`,
    [like, amount ?? -1],
  );

  return { q, customers, invoices: bills, payments };
}
