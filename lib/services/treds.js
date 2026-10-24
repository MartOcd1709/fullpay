// "Cash today from big buyers": open, not-yet-due invoices of buyers on TReDS and what selling them there could raise.
import { tredsEstimate, sellerReady } from "../treds.js";
import { daysBetween } from "../time.js";
import { INVOICE_SELECT } from "./common.js";

export async function view(client, ctx) {
  const f = ctx.cfg.finance ?? {};
  const low_bps = f.treds_rate_low_bps ?? 700, high_bps = f.treds_rate_high_bps ?? 1000;
  const { rows } = await client.query(
    `${INVOICE_SELECT} WHERE c.treds_buyer AND i.status IN ('sent','part_paid') AND i.paused_by IS NULL
       AND b.outstanding_paise > 0 AND i.due_date > $1::date ORDER BY i.due_date, i.id`,
    [ctx.asOf],
  );
  const invoices = rows.map((r) => {
    const e = tredsEstimate({ outstanding_paise: r.outstanding_paise, today: ctx.asOf, due_date: r.due_date, low_bps, high_bps, daysBetween });
    return { id: r.id, number: r.number, customer_name: r.customer_name, outstanding_paise: r.outstanding_paise, due_date: r.due_date, ...e };
  }).filter((r) => r.days);
  const sum = (k) => invoices.reduce((a, r) => a + r[k], 0);
  const { rows: buyers } = await client.query("SELECT count(*)::int AS n FROM customers WHERE treds_buyer AND anonymized_at IS NULL");
  return {
    seller: sellerReady(ctx.cfg.business), buyers: buyers[0].n, low_bps, high_bps, invoices,
    outstanding_paise: sum("outstanding_paise"), cash_low_paise: sum("cash_low_paise"), cash_high_paise: sum("cash_high_paise"),
  };
}
