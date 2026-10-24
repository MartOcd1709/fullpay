// Statement of account: one link per customer with every open bill, the total, and a pay-everything UPI QR.
import { randomBytes } from "node:crypto";
import { upiString } from "../upi.js";
import { INVOICE_SELECT, displayStatus } from "./common.js";
import { notFound } from "./errors.js";

// The customer's statement token, created the first time it is needed (unguessable, like the per-invoice pay tokens).
export async function ensureToken(client, customerId) {
  const { rows } = await client.query(
    "UPDATE customers SET statement_token = COALESCE(statement_token, $2) WHERE id = $1 AND anonymized_at IS NULL RETURNING statement_token",
    [customerId, randomBytes(18).toString("base64url")],
  );
  return rows[0]?.statement_token ?? null;
}

export async function byToken(client, ctx, token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw notFound("statement");
  const { rows: cust } = await client.query("SELECT id, name FROM customers WHERE statement_token = $1 AND anonymized_at IS NULL", [token]);
  if (!cust.length) throw notFound("statement");
  const { rows } = await client.query(
    `${INVOICE_SELECT} WHERE i.customer_id = $1 AND i.status IN ('sent','part_paid','disputed') AND b.outstanding_paise > 0 ORDER BY i.due_date, i.id`,
    [cust[0].id],
  );
  const b = ctx.cfg.business;
  const payable = rows.filter((r) => r.status !== "disputed");
  const total = payable.reduce((a, r) => a + r.outstanding_paise, 0);
  return {
    as_of: ctx.asOf,
    customer: { name: cust[0].name },
    business: { name: b.name, vpa: b.vpa, bank: b.bank ? { name: b.bank.name, account_last4: b.bank.account_last4 } : null, phone: b.phone, email: b.email },
    invoices: rows.map((r) => ({ number: r.number, issue_date: r.issue_date, due_date: r.due_date, outstanding_paise: r.outstanding_paise,
      display_status: displayStatus(r, ctx.asOf), pay_token: r.pay_token, disputed: r.status === "disputed" })),
    total_paise: total,
    upi: total > 0 && b.vpa ? upiString({ pa: b.vpa, pn: b.name, am_paise: total, tn: `Statement ${cust[0].name}`.slice(0, 40) }) : null,
  };
}
