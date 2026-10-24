// First-run setup: the few things a new owner fills in before FullPay can chase well. Each step links to where it is done.
import { mailSetup } from "../mail.js";

export async function steps(client, ctx) {
  const b = ctx.cfg.business ?? {};
  const one = async (sql) => (await client.query(sql)).rows.length > 0;
  return [
    { key: "business", href: "/settings#s-name", done: Boolean(b.name && b.address && (b.registration === "unregistered" || b.gstin)) },
    { key: "upi", href: "/settings#s-vpa", done: Boolean(b.vpa) },
    { key: "udyam", href: "/settings#s-udyam", done: Boolean(b.udyam && b.udyam_number) },
    { key: "customer", href: "/customers", done: await one("SELECT 1 FROM customers WHERE anonymized_at IS NULL LIMIT 1") },
    { key: "invoice", href: "/invoices/new", done: await one("SELECT 1 FROM invoices WHERE status <> 'draft' LIMIT 1") },
    { key: "bank", href: "/payments", done: await one("SELECT 1 FROM payments WHERE source = 'csv' LIMIT 1") },
    { key: "email", href: null, done: mailSetup().configured },
  ];
}
