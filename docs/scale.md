# FullPay at scale: what we measured, what broke, what we fixed

A small supplier sends a few hundred invoices a month. To make sure FullPay doesn't fall over when a business grows, or when
many customers pay at once after a reminder run, we built a book about **40 times bigger than a typical MSME's** and pushed
it through the real code: the same service layer, the same database rules, the same hash-chained record. No mocks.

## The test book

| | Count |
|---|---|
| Customers | 1,014 (60% prompt payers, 30% slow, 10% chronic) |
| Invoices | 20,065, issued over 200 days, created through `createDraft` + `send` |
| Bank lines imported | 40,000 across four statements (5,000 and 15,000 lines, twice) |
| Payments | 54,526 |
| Record (hash-chain) entries | 98,308 |
| Database size | 121 MB |

Machine: a laptop (Intel i7-1355U, 12 threads, 16 GB), Node 22.22, PostgreSQL 17.6, app and database on the same machine.
Render's free plan is slower (shared CPU, separate database host), so expect live numbers to be roughly 2-4× these.

Reproduce (uses a **separate** database and refuses to touch the demo one):

```bash
createdb -p 5434 fullpay_scale
SCALE_DATABASE_URL=postgres://fullpay@localhost:5434/fullpay_scale node scripts/scale.js 1000 20000 5000   # build + benchmark
SCALE_DATABASE_URL=… node scripts/scale.js                                                               # again: a later day on the same book
DATABASE_URL=…fullpay_scale DEMO_MODE=1 npx next start -p 3200 &
SCALE_DATABASE_URL=… node scripts/load.js http://localhost:3200 15 20                                    # HTTP load + race tests
SCALE_DATABASE_URL=… node scripts/verify-chain.js                                                        # re-hash the whole record
```

Raw results: [`scale-results-first-run.json`](scale-results-first-run.json) (before the fixes), [`scale-results.json`](scale-results.json)
(after), [`load-results.json`](load-results.json).

## Results

Server-side timings, median of 5 reads, on the 20k-invoice book:

| What | Before | After | Fix |
|---|---|---|---|
| Match 1,500 bank credits | 8,515 ms | **18 ms** | Exact-name fast path, memoised fuzzy lookups, open invoices indexed by customer. A differential test of 1,200 varied credits gives identical results to the old matcher |
| Import a 5,000-line statement | 14.4 s | **5.5 s** | Matcher fix + all record entries appended in one batch |
| Import a 15,000-line statement | 39 s | **20.6 s** | Same |
| Re-import the same 5,000-line file | 4.6 s | **204 ms** | Known lines are dropped with one lookup before matching; nothing is added twice |
| Today's follow-ups | 3,854 ms | **356 ms** | One balances read per page, not two per message |
| Dashboard | 706 ms | **235 ms** | Forecast reads open invoices only; week lookups memoised (143 → 23 ms); interest total in 2 queries, not 2 per overdue invoice |
| Cash forecast | 1,059 ms | **185 ms** | Same |
| Chase these first | 786 ms | **177 ms** | Same |
| Payments screen (27k pending) | 4.3 s at 1k invoices | **118 ms** | 3 queries for any number of payments (was 3 per payment); history capped in SQL |
| Invoice detail | – | **2 ms** | Per-invoice indexes |
| Daily run, first day (6,270 open) | 26.5 s | – | Worst case: every overdue invoice evaluated at once; 3,046 advanced, 2,157 letters drafted |
| Daily run, a normal day (5,835 open) | – | **4.2 s** | 543 advanced, 216 messages queued, 1 per customer per day |
| Re-hash the whole record (98k entries) | – | **0.34 s** at 74k | `scripts/verify-chain.js` |
| Analytics (DSO, CEI, on time) | 1,282 ms | 817 ms | SQL-side; acceptable for a report page |

Page weight (what a phone downloads):

| Page | Before | After |
|---|---|---|
| Chase these first | 14 MB | 715 KB (top 100, ranked over all) |
| Today's follow-ups | 8.9 MB | 1.7 MB (100 per section) |
| Cash forecast | 4.7 MB | 649 KB (25 biggest inflows per week + the rest summed) |
| Customers | 2.9 MB | 321 KB (100 per page) |
| Invoices | all 20,065 rows | 100 per page; counts and filters still cover every invoice |

## Many people paying at once

HTTP, one Node process, 15-second runs ([`load-results.json`](load-results.json)):

| Scenario | 3 at a time | 20 at a time |
|---|---|---|
| Customers opening their pay link | p50 **48 ms**, p95 84 ms, 58 req/s, 0 errors | p50 279 ms, p95 416 ms, 70 req/s, 0 errors |
| Owner screens (dashboard, payments, invoices, analytics, follow-ups, customers) | p50 781 ms, p95 1.7 s | p50 5.9 s (CPU-bound single process) |
| Health check | 754 req/s | 812 req/s |

Correctness under concurrency, the part that matters for money:

- **20 simultaneous confirmations of the same payment:** exactly **1** succeeds, 19 get `409`, one allocation row is written
  (`SELECT … FOR UPDATE` on the payment).
- **200 different payments confirmed by 20 parallel clients:** all 200 succeed in 3.9 s; **0 invoices over-allocated**.
- **Bulk approvals:** the owner approves 500 queued confirmations in 5.4 s. Ones whose invoice was settled in the meantime are
  recorded as *failed* with the reason, never applied twice and never lost.
- **Confirm all exact matches:** 2,000 payments in one action (21 s). Each runs on its own savepoint, so one that no longer fits
  is reported and the rest go through.

## Real-life changes the test forced

- **Bulk confirmation.** At volume nobody can confirm 20,000 bank lines one by one. *Payments → Confirm all exact matches*
  clears every 95%+ match with nothing flagged. For an accountant it prepares one approval per payment for the owner.
- **The payments queue shows the first 60** cards plus a count; each card carries only its payer's invoices (it used to carry
  the whole open book, 5,800 invoices, per card).
- **Paging** on invoices and customers; **render caps** on chase-first, follow-ups and the forecast's week lists, with exact totals.
- **Indexes** on credit notes, inbox items and promises by invoice; a unique index on invoice numbers (import dedupe).
- **Request body cap 2 MB**, matching what the importers accept (about 20,000 bank lines).

## Known limits and the upgrade path

- One Node process renders the owner screens. At 20 concurrent owner sessions the median is ~6 s; a business that size would
  run 2-4 instances (Render scales horizontally; there is no in-process state besides the pg pool).
- Invoice and record pages re-hash the record from the first entry (0.34 s at 74k entries, linear). Past ~500k entries, verify
  from a daily checkpoint instead.
- The invoices list still reads every row to count statuses (243 ms at 20k); past ~100k invoices, move the counts to SQL.
- The daily run's first day on a freshly imported large book is the worst case (26 s here). cron-job.org gives up waiting after
  30 s but the server finishes the transaction; the run shows on `/status` either way.
