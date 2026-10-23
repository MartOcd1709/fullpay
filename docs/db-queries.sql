-- FullPay: queries to look around the database. Read-only, except the last one, which shows the record refusing an edit.
-- "Today" below is the app's demo date (real date + the demo clock offset), so the numbers match the screens.
-- Money is stored as whole paise (₹1 = 100 paise); the queries divide by 100 to show rupees.
-- Local:  psql "postgres://fullpay@localhost:5434/fullpay" -f docs/db-queries.sql
-- Live:   Render → fullpay-db → Connect → copy the "PSQL Command" and run it in your own terminal (it contains the password).

\echo '== 1. Every table and how many rows it holds'
SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY relname;

\echo '== 2. The business profile (one row of settings)'
SELECT data->'business'->>'name' AS business, data->'business'->>'gstin' AS gstin, data->'business'->>'state_code' AS state,
       data->'business'->>'udyam_class' AS udyam, data->'demo'->>'offset_days' AS demo_offset_days
FROM config;

\echo '== 3. Customers and what each one owes'
SELECT c.id, c.name, c.gstin, c.state_code, c.credit_days,
       count(i.id) FILTER (WHERE i.status IN ('sent','part_paid','disputed')) AS open_invoices,
       (coalesce(sum(b.outstanding_paise) FILTER (WHERE i.status IN ('sent','part_paid','disputed')), 0) / 100.0)::numeric(14,2) AS owed_rupees
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id
LEFT JOIN invoice_balances b ON b.invoice_id = i.id
GROUP BY c.id ORDER BY owed_rupees DESC;

\echo '== 4. Invoices: total, paid, still owed, days late'
SELECT i.number, c.name AS customer, i.issue_date, i.due_date, i.status, i.rung AS reminder_stage,
       (i.total_paise / 100.0)::numeric(14,2) AS total, (b.paid_paise / 100.0)::numeric(14,2) AS paid,
       (b.outstanding_paise / 100.0)::numeric(14,2) AS owed,
       GREATEST((SELECT CURRENT_DATE + coalesce((data->'demo'->>'offset_days')::int, 0) FROM config) - i.due_date, 0) AS days_late
FROM invoices i JOIN customers c ON c.id = i.customer_id JOIN invoice_balances b ON b.invoice_id = i.id
ORDER BY i.due_date DESC LIMIT 25;

\echo '== 5. GST on one invoice, line by line (INV/26-27/0042)'
SELECT ii.position, ii.description, ii.hsn_sac, ii.qty_milli / 1000.0 AS qty, ii.unit, (ii.rate_paise / 100.0)::numeric(14,2) AS rate,
       ii.gst_bps / 100.0 AS gst_pct, (ii.taxable_paise / 100.0)::numeric(14,2) AS taxable,
       (ii.cgst_paise / 100.0)::numeric(14,2) AS cgst, (ii.sgst_paise / 100.0)::numeric(14,2) AS sgst, (ii.igst_paise / 100.0)::numeric(14,2) AS igst
FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.number = 'INV/26-27/0042' ORDER BY ii.position;

\echo '== 6. Payments: pending (waiting for the owner) and confirmed, with the match reason'
SELECT p.id, p.paid_on, (p.amount_paise / 100.0)::numeric(14,2) AS amount, p.status, p.match_confidence AS confidence, p.flags,
       left(p.match_reason, 70) AS why
FROM payments p ORDER BY p.status, p.paid_on DESC LIMIT 25;

\echo '== 7. Where confirmed money went (payment → invoice)'
SELECT p.id AS payment, i.number AS invoice, (pa.amount_paise / 100.0)::numeric(14,2) AS applied, pa.allocated_on
FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id JOIN invoices i ON i.id = pa.invoice_id
ORDER BY pa.allocated_on DESC LIMIT 20;

\echo '== 8. Reminders: what was queued or sent, by stage and channel'
SELECT o.id, c.name AS customer, o.rung AS stage, o.channel, o.status, o.lang, left(o.subject, 50) AS subject, o.sent_at, left(o.error, 50) AS error
FROM outbox o JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 20;

\echo '== 9. Disputes and "already paid" claims from the pay link; payment promises'
SELECT x.kind, x.status, i.number, x.opened_on, left(x.reason, 60) AS reason FROM inbox_items x JOIN invoices i ON i.id = x.invoice_id ORDER BY x.id DESC;
SELECT i.number, pr.promised_date, (pr.amount_paise / 100.0)::numeric(14,2) AS amount, pr.status FROM promises pr JOIN invoices i ON i.id = pr.invoice_id ORDER BY pr.id DESC;

\echo '== 10. Ageing: money owed by how late it is'
SELECT CASE WHEN t.d <= i.due_date THEN '0 not yet due' WHEN t.d - i.due_date <= 30 THEN '1-30 days'
            WHEN t.d - i.due_date <= 60 THEN '31-60 days' WHEN t.d - i.due_date <= 90 THEN '61-90 days' ELSE '90+ days' END AS bucket,
       count(*) AS invoices, (sum(b.outstanding_paise) / 100.0)::numeric(14,2) AS owed
FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id CROSS JOIN (SELECT CURRENT_DATE + coalesce((data->'demo'->>'offset_days')::int, 0) AS d FROM config) t
WHERE i.status IN ('sent','part_paid','disputed') AND b.outstanding_paise > 0 GROUP BY 1 ORDER BY 1;

\echo '== 11. The tamper-evident record: the latest entries and their hashes'
SELECT id, type, actor, invoice_id, ts, left(prev_hash, 12) AS prev, left(entry_hash, 12) AS hash FROM escalation_events ORDER BY id DESC LIMIT 10;

\echo '== 12. Is every entry linked to the one before it? (0 = the chain is unbroken)'
SELECT count(*) AS broken_links FROM (SELECT prev_hash, lag(entry_hash) OVER (ORDER BY id) AS before FROM escalation_events) t
WHERE before IS NOT NULL AND prev_hash <> before;

\echo '== 13. Daily runs (the 10:00 IST chase)'
SELECT ts, payload::jsonb->>'source' AS source, payload::jsonb->>'as_of' AS demo_date, payload::jsonb->>'evaluated' AS evaluated,
       payload::jsonb->>'advanced' AS advanced, payload::jsonb->>'queued' AS queued
FROM escalation_events WHERE type = 'tick_run' ORDER BY id DESC LIMIT 10;

\echo '== 14. Team, approvals waiting for the owner, and who did what'
SELECT id, name, email, role, active FROM users ORDER BY id;
SELECT a.id, a.kind, a.status, left(a.summary, 60) AS summary, (a.amount_paise / 100.0)::numeric(14,2) AS amount, r.name AS prepared_by, d.name AS decided_by
FROM approvals a LEFT JOIN users r ON r.id = a.requested_by LEFT JOIN users d ON d.id = a.decided_by ORDER BY a.id DESC LIMIT 10;
SELECT a.at, u.name, a.role, a.action, a.target, a.status FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 15;

\echo '== 15. Try to edit the record: the database refuses (append-only); nothing changes'
BEGIN;
UPDATE escalation_events SET actor = 'someone' WHERE id = (SELECT min(id) FROM escalation_events);
ROLLBACK;
