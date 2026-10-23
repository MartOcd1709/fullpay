# Proposed Solution Architecture — "Vasooli"

Minimal, credible, nothing speculative.

```
┌─────────────────────────────── Render ───────────────────────────────┐
│  Next.js app (UI + API routes)          Postgres (Render managed)    │
│  ├─ Dashboard (aging, forecast)         ├─ invoices, customers       │
│  ├─ Invoice/customer CRUD               ├─ escalation_events (log)   │
│  ├─ Escalation timeline view            └─ outbox (messages/letters) │
│  ├─ Letter/invoice PDF endpoints                                     │
│  └─ Simulated WhatsApp/email thread UI                               │
│                                                                      │
│  Render Workflow (cron): escalation tick                             │
│  └─ scans overdue invoices → advances ladder state →                 │
│     drafts message/letter → writes outbox + event log                │
└──────────────────────────────────────────────────────────────────────┘
Optional sidecars (each degrades gracefully):
- LLM API (any key): tone-adapted reminder drafting (Hindi/English). Fallback: handwritten templates. 
- Resend/SMTP free tier: actually send the reminder emails. Fallback: outbox view.
```

## Components and purpose

| Component | Purpose | Choice & why |
|---|---|---|
| Next.js (App Router) | one deployable for UI+API | team's fastest stack; single service = less deploy risk |
| Postgres on Render | invoices, ladder state, event log | managed, free tier fine; SQLite acceptable fallback if Render Postgres misbehaves |
| Escalation engine | per-invoice state machine: `current → due_soon → overdue_gentle → overdue_firm → demand_letter → samadhaan_guidance` | pure functions + DB; a "demo clock multiplier" env var compresses days→seconds for live demos (disclose it) |
| Render Workflow (cron) | runs the tick every minute | *this is the Render-track qualification*; locally, a `setInterval` dev loop |
| PDF generation | GST invoice (INV-1 field layout + QR of schema-valid JSON) and MSMED demand letter with interest table | `pdf-lib` or `@react-pdf/renderer`; no external service |
| Interest calculator | MSMED Act §16: compound interest, monthly rests, 3× RBI bank rate from day 46 (§15) — **verify against Act text; show the formula in the UI** | deterministic, unit-tested |
| Forecast | per-invoice collection probability from aging bucket + customer history → weekly expected inflow vs fixed outflows → 8-week cash line + shortfall flag | transparent heuristic, shown in UI ("how we compute this"), honest > ML theater |
| Seed data | ~60 invoices, 12 customers, 3 archetypes (prompt payer, chronic late, disputer) | makes every chart/ladder state demonstrable |

## Data/API dependencies & fallbacks

| Dependency | Needed? | Fallback |
|---|---|---|
| GST INV-1 schema | copy of official JSON schema (static) | bundled locally |
| WhatsApp | no — simulated thread UI | n/a (Meta sandbox only if time remains) |
| Email (Resend free) | optional | outbox-only mode |
| LLM key | optional (draft tone) | static templates per ladder rung |
| RBI bank rate | one constant, cited | hardcoded with source + date |
| UPI deep link in letters | `upi://pay?pa=...` QR on letters | plain bank details block |

## Security/safety requirements

- Demand letters carry "This is a payment reminder/demand under MSMED Act provisions — not a statutory notice or legal advice" footer.
- No real GSTINs/credentials; fictional businesses only; no real-brand imitation.
- Input validation on amounts/dates (money path); interest math unit tests are non-negotiable.

## Testing plan

- Unit: interest calculator (edge: partial payments, multi-month, pre/post due-date), ladder transitions, forecast arithmetic.
- One Playwright smoke: seed → dashboard renders → escalate → PDF downloads.
- Manual: full demo script run on deployed URL twice before recording.

## Deployment strategy

Deploy to Render on Day 1 Hour 6 (not the end): web service + Postgres + workflow. Every later push redeploys. Keep the live URL in the submission draft from Hour 6 onward. Keep a 90-second local screen-recording of the full flow as insurance against deploy-day failures.
