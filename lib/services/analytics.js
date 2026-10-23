import { listWithReliability } from "./customers.js";

const CHASED = ["overdue_gentle", "overdue_firm", "demand_letter", "odr_guidance"];

// Receivables KPIs for the last `months` calendar months up to ctx.asOf, all computed in SQL (one pass per query).
// DSO (count-back over 90 days) = receivable at month end / billed in the 90 days before × 90.
// CEI = (opening + billed − closing) / (opening + billed − closing current) × 100, the standard collection-effectiveness index.
export async function overview(client, ctx, { months = 6 } = {}) {
  const { rows: series } = await client.query(
    `WITH m AS (
       SELECT d::date AS start, LEAST((d + interval '1 month' - interval '1 day')::date, $1::date) AS end_
       FROM generate_series(date_trunc('month', $1::date) - make_interval(months => $2), date_trunc('month', $1::date), interval '1 month') d
     ),
     settle AS (
       SELECT pa.invoice_id, pa.amount_paise, pa.allocated_on AS on_ FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed'
       UNION ALL SELECT invoice_id, amount_paise, issue_date FROM credit_notes
     ),
     settled AS (SELECT m.start, s.invoice_id, sum(s.amount_paise) AS amt FROM m JOIN settle s ON s.on_ <= m.end_ GROUP BY 1, 2),
     ib AS (
       SELECT m.start, m.end_, i.issue_date, i.due_date, i.total_paise, GREATEST(i.total_paise - coalesce(st.amt, 0), 0) AS bal
       FROM m JOIN invoices i ON i.status <> 'draft' AND i.issue_date <= m.end_
       LEFT JOIN settled st ON st.start = m.start AND st.invoice_id = i.id
     ),
     agg AS (
       SELECT start, end_,
              sum(bal) AS receivable,
              sum(bal) FILTER (WHERE due_date >= end_) AS current_recv,
              sum(total_paise) FILTER (WHERE issue_date >= start) AS billed,
              sum(total_paise) FILTER (WHERE issue_date > end_ - 90) AS billed90
       FROM ib GROUP BY start, end_
     ),
     coll AS (
       SELECT m.start, sum(pa.amount_paise) AS collected FROM m
       JOIN payment_allocations pa ON pa.allocated_on BETWEEN m.start AND m.end_
       JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed' GROUP BY 1
     ),
     ontime AS (
       SELECT m.start, sum(i.total_paise) AS due_value, sum(LEAST(i.total_paise, coalesce(x.amt, 0))) AS on_time_value
       FROM m JOIN invoices i ON i.status <> 'draft' AND i.due_date BETWEEN m.start AND m.end_ AND i.due_date < $1::date
       LEFT JOIN LATERAL (
         SELECT sum(pa.amount_paise) AS amt FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed'
         WHERE pa.invoice_id = i.id AND pa.allocated_on <= i.due_date
       ) x ON true GROUP BY 1
     )
     SELECT to_char(m.start, 'YYYY-MM') AS month, m.end_::text AS month_end,
            coalesce(a.receivable, 0)::bigint AS receivable, coalesce(a.current_recv, 0)::bigint AS current_recv,
            coalesce(a.billed, 0)::bigint AS billed, coalesce(a.billed90, 0)::bigint AS billed90,
            coalesce(c.collected, 0)::bigint AS collected,
            coalesce(o.due_value, 0)::bigint AS due_value, coalesce(o.on_time_value, 0)::bigint AS on_time_value,
            lag(coalesce(a.receivable, 0)) OVER (ORDER BY m.start)::bigint AS opening
     FROM m LEFT JOIN agg a ON a.start = m.start LEFT JOIN coll c ON c.start = m.start LEFT JOIN ontime o ON o.start = m.start
     ORDER BY m.start`,
    [ctx.asOf, months],
  );
  const out = series.slice(1).map((r) => {
    const opening = r.opening ?? 0;
    const denom = opening + r.billed - r.current_recv;
    return {
      month: r.month, month_end: r.month_end, billed_paise: r.billed, collected_paise: r.collected, receivable_paise: r.receivable,
      dso_days: r.billed90 > 0 ? Math.round((r.receivable / r.billed90) * 90) : null,
      cei_pct: denom > 0 ? Math.round(((opening + r.billed - r.receivable) / denom) * 100) : null,
      on_time_pct: r.due_value > 0 ? Math.round((r.on_time_value / r.due_value) * 100) : null,
    };
  });

  const { rows: [rec] } = await client.query(
    `SELECT coalesce(sum(pa.amount_paise), 0)::bigint AS paise, count(DISTINCT pa.invoice_id)::int AS invoices
     FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'confirmed'
     JOIN invoices i ON i.id = pa.invoice_id
     WHERE pa.allocated_on > i.due_date AND EXISTS (
       SELECT 1 FROM escalation_events e WHERE e.invoice_id = i.id AND e.type = 'rung_advanced'
         AND (e.ts AT TIME ZONE 'Asia/Kolkata')::date <= pa.allocated_on AND e.payload::jsonb->>'to' = ANY($1))`,
    [CHASED],
  );
  const { rows: [prom] } = await client.query(
    `SELECT count(*) FILTER (WHERE status = 'kept')::int AS kept, count(*) FILTER (WHERE status = 'broken')::int AS broken,
            count(*) FILTER (WHERE status = 'open')::int AS open FROM promises`,
  );

  const customers = await listWithReliability(client, ctx);
  const rank = { C: 0, B: 1, A: 2 };
  const at_risk = customers
    .filter((c) => c.total_owed_paise > 0 && !c.anonymized_at && c.grade !== "A")
    .sort((a, b) => rank[a.grade] - rank[b.grade] || b.total_owed_paise - a.total_owed_paise)
    .slice(0, 8)
    .map(({ id, name, grade, avg_late_days, pct_on_time, total_owed_paise, reason }) => ({ id, name, grade, avg_late_days, pct_on_time, total_owed_paise, reason }));

  return { as_of: ctx.asOf, months: out, recovered: rec, promises: prom, at_risk };
}
