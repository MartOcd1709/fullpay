# MVP Scope & 48-Hour Execution Plan

Window assumed: **Fri 23 Oct 9:30 PM → Sun 25 Oct 9:30 PM IST** (confirm officially; submit by ~8:30 PM Sun).
Team: Dev A (engine/backend-lean), Dev B (UI/UX/story-lean) — both full-stack, swap freely.

## MVP boundaries

**Must have (the demo dies without these)**
1. Invoice + customer CRUD with seed data; aging dashboard (buckets, totals, top debtors).
2. Escalation ladder engine, auto-advancing via scheduled tick (Render Workflow), full event log per invoice.
3. MSMED demand-letter PDF with computed statutory interest table; GST-format invoice PDF + schema-valid JSON + QR.
4. Cash-flow forecast: 8-week expected-inflow line vs outflows, shortfall alert.
5. Deployed on Render; seed-reset button (demo insurance).

**Should have (in descending order, only if green)**
6. Simulated WhatsApp-style thread per customer (big demo value, cheap).
7. Real email send via Resend free tier.
8. LLM-drafted reminder tone (Hindi/English) with template fallback.
9. Dispute flag on an invoice (pauses ladder) — one button + state.
10. Mobile-polish pass.

**Explicitly out of scope (say so in the deck)**
Real IRN/GSTN, real WhatsApp API, payments, auth/multi-tenant, OCR import, ML forecasting, accounting ledger.

## Schedule (IST)

| Block | Hours | Dev A | Dev B |
|---|---|---|---|
| Fri 9:30 PM–12 AM | 0–2.5 | Repo, Next.js+Postgres scaffold, schema, seed script | Design tokens, dashboard wireframe, copy voice |
| Sat 12–3 AM | 2.5–5.5 | Invoice/customer CRUD APIs | Dashboard UI on seed data |
| *Sleep* | 5.5–12 | — | — |
| Sat 9 AM–1 PM | 11.5–15.5 | **Escalation state machine + tick + event log**; deploy to Render (web+DB+workflow) by hour 14 | Invoice detail + escalation timeline UI |
| Sat 1–2 PM | lunch/buffer | | |
| Sat 2–6 PM | 16.5–20.5 | Interest calculator (+unit tests), demand-letter PDF | GST invoice PDF+QR; thread UI |
| Sat 6–10 PM | 20.5–24.5 | Forecast engine | Forecast chart + shortfall alert UX |
| Sat 10 PM–12 AM | 24.5–26.5 | Integration pass: full ladder runs end-to-end on deployed app | Same (pairing) |
| *Sleep* | 26.5–33 | — | — |
| Sun 9 AM–12 PM | 35.5–38.5 | Bug triage; should-haves 7/8 only if zero red | Should-have 6; polish; empty/error states |
| Sun 12–2:30 PM | 38.5–41 | **Feature freeze 12 PM.** Seed-reset + demo-clock rehearsal | Record ≤3-min demo video (2 takes) |
| Sun 2:30–5 PM | 41–43.5 | Deck (7 slides, template from dashboard) | Deck + video edit |
| Sun 5–7 PM | 43.5–45.5 | README, repo tidy, license, live-URL smoke test on 4G + another device | Dry-run submission form, check all 4 links in incognito |
| **Sun 7–8:30 PM** | 45.5–47 | **SUBMIT** (≥1h before deadline). Verify confirmation | Same |
| Sun 8:30–9:30 PM | 47–48 | Untouched buffer | |

Rules: deploy early (hour ~14), freeze at hour ~38.5, the last 25% of the clock is testing/video/deck/submission — never features. If the ladder engine isn't demoable by Sat 10 PM, cut features 3's GST-PDF half (keep demand letter) and 4 down to a static-forecast view; never cut the ladder — it is the pitch.

## Risk register

| Risk | L×I | Mitigation |
|---|---|---|
| Render deploy friction late | M×H | deploy hour 14; local video insurance |
| Interest math wrong on a slide | M×H | unit tests + verify MSMED §16 text Day 0; show formula in UI |
| "Another invoice app" judge reaction | M×H | pitch leads with the ladder + ₹7.34 L-cr; comparison slide vs Vyapar/Chaser |
| Scope creep into should-haves | H×M | freeze rule; should-haves only when must-haves green on *deployed* app |
| Deadline ambiguity | M×H | confirm in WhatsApp group Day 0; plan for the earlier reading |
| Demo-clock looks fake | L×M | label it on screen: "demo clock: 1 day = 5 s"; honesty reads as competence |

---

## ADDENDUM — plan deltas after reading the official prompt pack

- **Hour 0 decision:** rebrand (name, persona, seed data, palette) — never demo as "Baaki"/Sharma Packaging.
- Treat the pack's **"BEFORE YOU FINISH, CHECK" list as our acceptance test suite** (judges hold the same list): GST split/rounding cases, GSTIN check-digit, consecutive invoice numbers, ladder pause/no-repeat, 6 CSV matching cases incl. TDS %, forecast week-chaining, full EN/HI i18n, 360px, reload-safe.
- Must-have list unchanged, plus: **real email send via the backend is promoted from should-have to must-have** (it's the clearest visible break from the localStorage clones) — demand letters still manual-send only, per the pack's own safety rule.
- Should-haves reordered: ① invoice-from-photo OCR add-on ② Marathi ③ dispute flow (already in pack baseline — keep) ④ mobile polish.
- Keep the pack's customer-facing `/pay/:token` page — it demos the dispute pause and is cheap with a real backend.
