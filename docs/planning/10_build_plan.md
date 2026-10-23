# LOCKED BUILD PLAN — HackCache '26, PS4 Invoice Chase

Status: FROZEN upon Ved's approval. Changes after Fri 9:30 PM require both teammates to agree the demo is at risk without it.
All licenses/claims below verified 2026-10-22 (sources in `sources.md` + research notes); items marked ⚠ must be re-verified during the event.

## 1. Identity (anti-clone, anti-collision)

- **Name:** "Vasooli" is DEAD — a Product Hunt product "Vasuli" (Tungsten Technologies) already pitches this exact ladder. Candidates, in order: **Taqaada** (तक़ाज़ा — the act of repeatedly demanding owed money; perfect domain word), **Chukta** (चुकता — settled/paid in full). ⚠ 10-min collision check (Play Store, PH, GitHub, domain) before branding, Fri 9:30 PM.
- **Persona:** NOT "Baaki / Sharma Packaging, Pune" (the handout everyone gets). Ours: **Arora Auto Components, Ludhiana (Punjab)** — 9 employees, GST-regular, Udyam-registered small enterprise, 14 B2B customers on 30–45-day credit, one customer in Haryana (inter-state IGST case), one unregistered. New seed data generated to the same archetypes the pack tests (prompt payer / chronic late / disputer / TDS deductor).
- **Visual identity:** our own tokens (not Tailwind defaults, not the pack look). Hindi-first toggle kept.

## 2. Novelty thesis (validated, carefully worded)

Two levers survived adversarial research. Exact claims — never say "first ever":

1. **Statutorily-correct, ODR-ready escalation.** "We found no tool that generates MSMED §15/§16 demand letters with **period-correct compound interest across RBI bank-rate changes**, and assembles a **filing-ready bundle for the MSME ODR portal** — which replaced Samadhaan for new filings on **15 Oct 2025** (ministry notice 3 Oct 2025)." Incumbents' marketing (incl. Vyapar's own page) still says Samadhaan; free §16 calculators use a single flat rate and warn they're wrong across rate changes. Preempt the judge: name-check Vasuli and FundRaksha ourselves — "they pitch ladders; neither evidences period-correct interest or an ODR bundle; both are Samadhaan-era."
2. **Promise-aware cash engine.** "We found no India-priced SMB tool where a customer's **payment promise reflows the cash-flow forecast** and a **broken promise auto-resumes escalation**." (Chaser payment plans = £135+/mo UK; My DSO Manager/CashPundit = EU/enterprise.)

Dropped as novelty (still features where cheap): OCR intake (Vyapar ships it), customer pay/dispute portal (Zoho free — we keep the portal because the pack's judges expect it, and our wrinkle "dispute pauses the interest clock" is one line of logic), B2B credit-score network (Recordent/CreditQ own it; cold-start unfixable in 48h — mention as roadmap only).

## 3. What we build (three layers)

**Layer 1 — the handout baseline, passed completely.** Every team has the same spec and judges hold its checklist; most one-shot builds will fail parts of it. We implement the pack's 13 screens *as scoped below* and pass every "BEFORE YOU FINISH, CHECK" item: GST split/rounding (₹10,000@18% → CGST 900/SGST 900 vs IGST 1,800), GSTIN check digit, consecutive FY invoice numbers, ladder pause/no-repeat, all 6 bank-CSV cases incl. TDS 1/2/10%, forecast week-chaining, EN/HI full i18n, 360px, reload-safe.

**Layer 2 — beyond the pack's ceiling (the demo spine).**
- Real backend (Postgres) instead of localStorage; audit-logged sends.
- **Scheduled autonomy:** Render cron ($1/mo, UTC) triggers → **Render Workflow** orchestrates the dunning run (fan-out per overdue invoice: evaluate → draft → send/queue → log, with retries). ⚠ Workflows have NO built-in scheduler (verified render.com/docs) — cron is the trigger; this combo is the honest Render-track qualification. Fallback if Workflows SDK fights us by Sat 2 PM: node-cron in the web service (still deployed on Render; we lose track eligibility, not the demo).
- **Real email sends** via Resend (verified free tier: 100/day, 3,000/mo — ample): heads-up + due-date stages auto-send; demand letters always manual-send (pack's safety rule, keep).
- **Interest engine v2 (the correctness wedge):** compound, monthly rests, 3× RBI bank rate, **segmented by rate period** — config holds the RBI bank-rate series with effective dates ⚠(pull series from rbi.org.in Day 0); UI shows the per-period breakdown table; unit-tested incl. a rate-change-mid-delay case and partial payments.
- **ODR filing bundle:** one click on a 45+ day invoice → print-ready pack: parties + Udyam number, invoice schedule, days-overdue computation, per-period interest table, reminder/dispute history timeline, document checklist mapped to the ODR portal's asks ⚠(verify field list at odr.msme.gov.in during event; screenshot ministry notice for the deck).
- **Promise-to-pay objects:** promise {invoice, date, amount} pauses ladder, shifts that inflow in the forecast, shows "promise at risk" when the date nears, and broken-promise auto-resumes the ladder at the next rung + reflows forecast. One toggle demo moment.

**Layer 3 — only if everything above is green on the deployed app (Sun 10 AM gate):** invoice-from-photo OCR (server endpoint, review-before-save), Marathi, LLM-tone drafting (template fallback exists regardless).

**Cut forever (deck's non-goals):** real IRN/GSTN, WhatsApp Business API (wa.me links only), payments processing, auth/multi-tenant, OCR bulk import, ML forecasting, credit-score network.

## 4. Reuse map (licenses verified — embed only permissive)

| Component | Use | License | Mode |
|---|---|---|---|
| shadcn/ui | all UI primitives | MIT | copy-paste embed |
| **Invoify** (al1abb/invoify) | invoice template components, live preview | MIT | fork/embed — biggest saver (~8h) |
| recharts | forecast + aging charts | MIT | embed |
| to-words v7.4 | amount-in-words en-IN (⚠ test hi-IN) | MIT | embed |
| gstin-validator | mod-36 check-digit fn | MIT | copy fn into repo |
| papaparse | bank CSV | MIT | embed |
| fuse.js | payer-name fuzzy match | Apache-2.0 | embed |
| qrcode | UPI QR (`upi://pay?pa&pn&am&tn&cu=INR`, URL-encode pn/tn) | MIT | embed |
| react-to-print + @page A4 CSS | invoices/letters/bundle PDFs — browser print = correct ₹ + Devanagari shaping | MIT | embed |
| node-cron | local dev tick + fallback | ISC | embed |
| ERPNext Dunning doctype, india-compliance | escalation data model, GST rounding rules | GPL-3.0 | **read-only reference, never copy code** |
| Recon pattern (mint/ReconBanker) | pass 1 exact amount+date → pass 2 fuzzy name → residual rules (part-pay / TDS 1·2·10%) | — | pattern, ~200 LOC ours |
| Resend | email | SaaS free | service |
| HSN list | curated ~50-row JSON from CBIC | — | build (1h) |

**Never:** Invoice Ninja code (Elastic 2.0), InvoiceShelf/Crater (AGPL/dead), InvoicePlane (license murky), jsPDF/pdf-lib for Indic text (no Devanagari shaping), Kill Bill (overkill), hsn-code-package (license unverified), Tremor npm (post-acquisition limbo).

## 5. Revised 48h schedule (reuse-adjusted)

| Window (IST) | Dev A (engine) | Dev B (product) |
|---|---|---|
| Fri 9:30 PM–12 | Scaffold Next.js+Postgres on Render; schema; name check; RBI rate series | shadcn setup, tokens, seed-data generator (our persona) |
| Sat 12–3 AM | CRUD APIs; ladder state machine v1 | Dashboard + invoice list on live API |
| Sat 9 AM–2 PM | **Interest engine v2 + unit tests; cron→Workflow tick live on Render by 2 PM (fallback gate)** | Invoify-based invoice template + print CSS; new-invoice flow w/ live GST math |
| Sat 2–7 PM | Recon import (6 cases + TDS); Resend integration + audit log | Escalation timeline UI; follow-ups screen; /pay/:token portal |
| Sat 7–11 PM | Promise objects + forecast reflow; ODR bundle generator | Forecast chart + what-ifs; demand-letter + bundle print pages; HI i18n pass |
| Sat 11 PM | **Integration checkpoint: full ladder runs unattended on deployed app** | same (pair) |
| Sun 9 AM–12 | Pack-checklist run as acceptance tests; bug triage | Polish; empty/error states; 360px pass |
| Sun 10 AM | **Layer-3 gate** (only if all green) | |
| Sun 12 PM | **FREEZE.** Demo-clock rehearsal | Record ≤3-min video |
| Sun 2:30–5 PM | Deck (incl. "handout vs ours" + name-check slide) | Video edit; README |
| Sun 5–7 PM | Repo tidy; live URL smoke on 4G + second device | All 4 links in incognito; dry-run form |
| **Sun 7–8:30 PM** | **SUBMIT** | verify confirmation |

## 6. Acceptance tests (append to pack's checklist)

1. Interest: invoice crossing an RBI rate change computes per-period segments; partial payment mid-way reduces principal from its date; totals match hand calc.
2. Promise: recording a promise pauses rung + moves forecast inflow; passing the date unfulfilled resumes at next rung and restores forecast.
3. ODR bundle: every artifact for one invoice present, dated, paginated, printable; "not a legal notice" line on letters.
4. Unattended run: with demo-clock off and cron live, a seeded almost-due invoice receives its real email with zero clicks; audit log shows the workflow run id.

## 7. Demo (3 min) — revised order

1. (0:00) Hook: ₹7.34 L-cr + Arora Auto's ₹11.8L stuck, salaries on the 1st.
2. (0:25) **Autonomy proof first:** workflow run log + the real reminder email opened in an inbox. "This ran at 10 AM without us."
3. (0:55) Ladder on screen; invoice crosses 30 days on the demo clock → demand letter PDF with the **per-period interest table**. "Free calculators get this wrong when RBI changes rates. We don't."
4. (1:35) 45-day rung → **ODR bundle** print view: "Samadhaan closed to new filings on 15 Oct. Every competitor's site still says Samadhaan. This bundle is ready for the portal that replaced it."
5. (2:10) Promise demo: customer promises Friday → forecast gap moves; break it → ladder resumes itself.
6. (2:40) Close: handout-vs-ours line + non-goals honesty + "built and running on Render."

## 8. Open verifications (owner: Dev A, Fri evening)

⚠ Name collision check for Taqaada/Chukta · ⚠ RBI bank-rate series values+dates · ⚠ ODR portal document list (screenshot notice) · ⚠ Render Workflows pricing/SDK friction (fallback ready) · ⚠ to-words hi-IN output · ⚠ official deadline + video length (WhatsApp group).

---

## Deltas from the complete pack review (see 11_prompt_pack_review.md)

- **Demo additions (non-negotiable, they're in the official evaluation focus):** same-state vs other-state GST invoice side-by-side; bank-CSV import with the TDS flag caught on camera. Folded into beats 3 and 5; autonomy-first order unchanged.
- **Acceptance additions:** CSV re-import idempotency (date+amount+reference); part payment updates reminder amounts but not the stage; invoice-no matching tolerant of separators; customer-name normalization (M/s, Pvt Ltd, case); 360px AND largest-text-size pass; `/pay/:token` deep link works on the deployed Render URL after refresh.
- **README mirrors the pack's enumerated structure** and includes the five WhatsApp Business message templates (pack asks; free points most teams skip).
- **Per-customer preferred language** field promoted to Layer 2 (templates + pay page in customer's language).
- **Unit-test set from the pack's debug prompts:** ₹10,000@18% same/other state; 3×₹333@5%; 10% discount line; composition (no GST); 0% item; paise-only arithmetic; separate CGST/SGST rounding; round-off + words match.
- **Pitch framing:** the organizer's own pack still points the 45-day step at Samadhaan — our ODR-ready bundle is framed as "the law moved on 15 Oct 2025" (respectful; screenshot the ministry notice).

---

## Trust & Security Layer (see 12_trust_and_security_layer.md) — "Evidence-grade by design"

- **Hash-chained audit log** over every event; demand letters + ODR bundle carry chain-head hash + **QR → /verify/:hash** public verification page (judge scans → "record unaltered"). Not blockchain; say so.
- **DPDP-aligned handling** (Rules notified 13–14 Nov 2025, phased to ~May 2027 — wording: "designed to DPDP principles", never "compliant"): pay-page notice in customer's language, minimization, per-contact opt-out honored by the engine, anonymize-delete with CGST s.36 ⚠ retention carve-out (ledger stays, PII goes), one-click export, field-level AES-256-GCM on phone/email, expiring revocable pay tokens, no PII in logs, CSV-injection-safe exports.
- **n8n webhook** on escalation events (sponsor synergy, 15 LOC).
- Costs +~5.5h, paid by demoting LLM-tone drafting and trimming what-ifs to two. Acceptance adds: tampered row breaks /verify; opted-out contact never emailed unattended; anonymize keeps totals; expired token fails friendly. Demo beat 4 ends on the QR-scan verify. Deck: one "Trust by design" slide + threat-model appendix.

---

## REV B — adversarial-panel resolutions (canonical detail now lives in the Build Dossier artifact)

Three hostile reviews (hackathon-judge, domain-accuracy, delivery-realist lenses) produced 30 findings; all resolved:
1. **Deadline corrected: Sun 25 Oct 9:30 PM IST** (25 Oct 2026 is a Sunday; "Sat 25" was wrong in two files — fixed). Conflict stated precisely: API = Sun 25 Oct 9:30 PM; guide's literal words = "Saturday 24 October, before midnight". Day-0 confirmation mandatory; if the Saturday reading is confirmed → compressed plan: freeze Sat ~6 PM, video 7–9 PM, submit by Sat ~10:30 PM.
2. **Trust layer now has named hours** (was unscheduled): hash-chain append inside Sat 12–3 AM CRUD (+1h, entry_hash in schema from Fri scaffold); /verify+QR with Dev B's print pages Sat 7–11 PM (1h); 2h trust-behavior block Dev A Sun 9–12 (opt-out enforcement, anonymize-delete, token expiry, tamper-breaks-verify). **Demoted to roadmap:** AES field encryption, one-click export. Threat-model updated accordingly.
3. **Interest accrual fixed:** §16 interest runs from the day after each invoice's agreed due date (statute caps agreed credit at 45 days from acceptance; day 16 where nothing is written) — NOT a fixed day 46. Engine reads per-invoice credit terms. Added ⚠: payment-appropriation order (interest-first vs principal-first) verified + unit-tested.
4. **Ladder states renamed to the pack's rungs:** heads_up(−3) → due_date(0) → overdue_gentle(+7) → overdue_firm(+15) → demand_letter(+30) → odr_guidance(+45).
5. **Async judging readiness** (6 judges score online from links, later): keep-alive ping via existing cron, nightly auto-reseed, README "2-minute guided tour for judges" + sent-log/outbox view as the inbox proof, Q&A moved into README FAQ + deck; video is the primary artifact with every beat baked in. Day-0 WhatsApp question added: is there any live judging round?
6. **Demo cut 6→4 beats** (hook 15s → autonomy 40s → interest+letter 60s with an 8s GST/TDS captioned overlay → ODR+QR hero 45s → promise-break close 20s).
7. **Impact gets a product number:** seed-spec targets pinned (overnight run: 3 reminders, 1 letter drafted, 1 bundle-ready; DSO 58→41 target; statutory-interest claim computed from frozen seed at the Sat 11 PM checkpoint, arithmetic in deck appendix).
8. **AI story decided now:** LLM-tone drafting pre-wired behind a flag (30–60 min, Sat 2–7 PM, template fallback) + standing deck line: "No LLM in the money path, by design — statutory math must be reproducible."
9. **i18n keys wired at scaffold** (no Sunday retrofit); what-ifs top of cut list.
10. **One ordered cut list** (trigger: any slot >1h over): n8n webhook → per-customer language (now roadmap) → what-ifs → HI depth (demo screens only) → forecast→static → invoice print-PDF polish (on-screen GST view always survives) → ODR bundle→pre-rendered sample. Sat 11 PM red: pair ≤2h then apply. NEVER cut: ladder, interest engine, /verify, on-screen GST math.
11. **Unscheduled features placed or cut:** e-invoice JSON+QR → Dev B Sat 9–2 (+1h); customers+import UI → Dev B Sat 2–7; settings (minimal) + seed-reset route + hero-screen polish (escalation timeline w/ hash stamps = the named Design&UX signature, deck slide 4) → Dev B Sun 9–12; simulated WhatsApp thread UI deleted everywhere (wa.me links only); per-customer language → roadmap; OCR + Marathi → roadmap-only.
12. **Entire ⚠ checklist moved PRE-EVENT** (research is legal before Fri; build-fresh bars code, not reading): name lock, RBI series, ODR fields+notice screenshot, §16 accrual+appropriation, CGST s.36, Workflows pricing + hello-world, to-words hi-IN, deadline/video/live-round questions in WhatsApp. CashPundit dropped from claims.
13. **Wording fixes:** "Vyapar's own page — and even the organizer's handout — still point to Samadhaan" (never "every competitor"); "we found no shipped tool with the statutory rungs — Vasuli/FundRaksha pitch ladders but evidence neither…"; no digs at other teams; Render-track line = "strong fit at small, gated extra scope"; backup = one line; hedged Invoice Ninja/Crater claim.

## n8n Pro voucher (team has it — claim before Fri; expires 1 Nov)
Pre-event: claim voucher, build 3-node n8n Cloud receiver (Webhook → format → escalation-register sheet/notify). Event: the planned 15-LOC POST fires into it. Demo: 5-second flash in the overlay beat. Guardrail: n8n is an OUTPUT integration only — scheduler stays Render cron→Workflow (track qualifier). Voucher code stays private to the team.

## NAME LOCKED: FullPay (team decision, 22 Oct)
Web pre-screen clean (no exact-match company; FinPay/FamPay/Fpay are neighbors, nothing owns "FullPay"). Rejected en route: Vasooli/Vasuli (live rival), Taqaada/Chukta (team disliked), Payfull (live Turkish gateway), ChaseLess (exists), Rokda (Rokdi/Rokadaa adjacent), Munim (taken), Bakaya/Poora/PaidFull/ZeroDue (clean but not chosen). Positioning line that defuses the "-Pay = processor" signal, use everywhere: "Every -Pay app helps you pay. FullPay is for getting paid — in full, with the interest the law owes you." Final Play-Store/domain sweep stays in the pre-event checklist.

---

## REV C — HLD design review pins (HLD artifact: https://claude.ai/artifact/RuZtaqSWQ29ZywPkegVBB7)

Three-lens review of the HLD (~40 findings) produced these binding design decisions:
1. **Tick is SERIAL, not fan-out** (concurrent appends would fork the hash chain): one /api/tick invocation loops invoices grouped by customer; Workflow = retried steps around it (track story intact). Idempotency designed: single-flight advisory lock · CAS rung transitions in the same txn as the event append · max one rung per invoice per tick, no backfill sends.
2. **Hash chain hardened:** payload stored as canonical TEXT (sorted keys; paise/bps ints; ISO timestamps), hash framing hex(prev_hash)+"\n"+payload, genesis 64 zeros, BIGSERIAL order, UNIQUE(prev_hash & entry_hash), advisory-lock appends. /verify returns type/invoice-no/ts/hash/chain-status only — no PII; walks from genesis ("chain intact through this entry").
3. **ALL sends route through outbox** (queued/awaiting_owner/sent/failed) with Idempotency-Key = outbox.id; auto = first two rungs only; +7/+15 one-tap (wa.me/mailto/sms + mark-as-sent); n8n fire-and-forget.
4. **Schema adds:** per-invoice credit_days + acceptance_date (due = acceptance + invoice terms); pay_token + expiry on invoices; snoozed_until; payments.allocations [{invoice_id, amount_paise}] + source 'claim' + dedupe_hash; events.actor; **expenses table + opening_balance_paise** (forecast outflows — was a blocker); invoice_items the only line-item home; UNIQUE(fy, number).
5. **Money-rule pins:** TDS = % of TAXABLE value (excl GST), rates [0.1,1,2,10]%, ±₹1, checked before part-payment; interest conventions: actual/365, monthly rests on due-date anniversaries, pro-rata final period, round at output, appropriation interest-first (⚠ verify); customer dispute pauses rungs only — interest clock stops only on OWNER-accepted dispute; forecast = 13 weeks (pack), week-chaining by construction.
6. **New small scope:** owner-app shared-password signed cookie + middleware (~30 min, Dev A Sat 2–7); /api/reseed behind secret header + DEMO_MODE; deterministic seed (same hashes every reseed — QR in video survives judging week); **Resend domain verification = first Friday task** (DNS hours); seed emails demo+name@ourdomain → one inbox.
7. Demo-clock advance synchronously calls /api/tick; cron = judging-week realism. Day-0: seed writes rung pointers + backdated events; no catch-up blasts.

## Demo-data collection checklist (pre-event, split A/B/C)
A. COLLECT REAL (public): RBI bank-rate series+dates · GST rates + INV-1 schema · auto-parts HSN codes · ODR field list + 3 Oct 2025 notice screenshot · MSMED §15/§16 text + appropriation practice · one real bank CSV FORMAT (structure only) · optional 2–3 real shop-owner quotes for one deck slide.
B. GENERATE FAKE (pack rule: made-up businesses/customers/GSTINs/phones/bank details only): deterministic seed — Arora Auto, 14 customers (GSTINs pass check digit), ~40 invoices/4 months, 6-case bank CSV incl. 2% TDS, expenses, pinned demo numbers (3 reminders/1 letter/1 bundle; DSO 58→41). Same seed → same hashes (QR survives reseed).
C. CAPTURE DURING EVENT: workflow run log · real email in demo+name@ourdomain inbox · n8n event screenshot · QR→/verify scan. All baked into the ≤3-min video.
Rule: NEVER real credentials/PII — pack requirement + our DPDP story.

---

## REV D — LLD review pins (LLD artifact: https://claude.ai/artifact/QE9xURcCu1U3GczYBL9PAA)

Three-lens LLD review (~45 findings, 5 blockers) → binding code-level decisions, now in the LLD Rev B and synced to the HLD:
1. **Money is Number integer paise end-to-end** (pg BIGINT/NUMERIC parsers → Number; asPaise() guards 2^53); BigInt nowhere; qty stored as qty_milli INT.
2. **Interest rounding pinned:** each segment Math.round to integer paise; total = Σ segments (letter table sums exactly). Dispute spans = rate-0 segments (rests still fire); span = [dispute_opened, dispute_accepted). Shared date: compound first, then allocate. credit_days NULL ⇒ statutory 15 days (interest from day 16). addMonths clamps to month-end.
3. **Demo letter hash is SEEDED** (INV/26-27/0042 at rung=demand_letter with full backdated chain incl. letter_generated, pinned ts) — reseed asserts THAT hash; the video QR points at it. Seed assertions split: static state after seed, then one deterministic tick at T0 ⇒ exactly 3 queued sends. Rungs due ON or after T0 fire.
4. **Status enum shrunk** to draft/sent/part_paid/paid/disputed; due_soon/overdue are display-only. Ladder entry/unpause = highest rung already due, intermediates skipped with events only; promise-break bypasses the date guard one step.
5. **Transactions:** appendEvent(client) inside the caller's txn; advance = CAS + event + outbox row in one txn; tick = one txn with pg_try_advisory_xact_lock(7).
6. **Schema adds:** payment_allocations table (replaces JSONB), invoices.seq (allocated at /send; drafts unnumbered), reverse_charge, ship_to, letter_include_interest; customers.address; events.ts caller-supplied + index(invoice_id,id); outbox.lang; config: messaging cap, letter.deadline_days=7, gst_rates with source, ui {lang,text_size}.
7. **Pay tokens** minted at /send, expiry extended on every queue; 404/410 semantics; drafts refused. Claim body includes amount.
8. **Recon regex fixed** (FY-whitelisted capture groups); amounts match OUTSTANDING; CSV format pinned (Date,Narration,Ref,Debit,Credit) with skipped-row reporting; seed CSV gains a debit + malformed row.
9. **Outbox merge key** = (customer, rung, channel); per-invoice message events carry outbox_id; Follow-ups shows failed rows with Retry.
10. **Letter spec enumerated** (title, disclaimer, schedule w/ part-payments, 7-day deadline, bank+UPI QR, dispute contact, Udyam-gated MSMED paragraph + interest, add-interest checkbox persisted, verify QR). >₹5cr: IRN banner + 6-digit HSN enforcement. Bundle contents enumerated.
11. **Added surfaces:** Customers API/screen; manual payment route; demo controls (cookie + DEMO_MODE) /api/demo/advance|reset; health public {ok:true}; OWNER_PASSWORD env + login rate limit; lib/upi.js + lib/i18n.js contracts; third what-if (big order); invoice_adjusted & rung_skipped events.

## Production stance (team ask: "complete, scalable, deployable, production system")
Ship PRODUCTION-SHAPED in 48h (already designed: real Postgres + migration, auth boundaries, transactional integrity, idempotent jobs, ~50 money-path tests, deployed w/ health/keep-alive/reseed, error contract, i18n). Do NOT attempt production-SCALE this weekend; instead ship a specific "Path to production" README section + deck slide: multi-tenant orgs/roles → field encryption + backups/retention → monitoring/alerting → queue-based tick (current ceiling: single-txn serial loop, fine for any single MSME) → WhatsApp Business API → real IRN → data residency → load tests → consent manager. Post-event hardening sprint (2–3 weeks) follows that order; engines need no rewrite.

## REV E — "both sides safe" additions (~2h; team ask: more novelty + user safety)
1. Buyer-side invoice verification: invoice_created event records payee {vpa, bank_last4, total}; /verify shows "Pay only to:" block → protects the CUSTOMER from invoice-tampering/redirection fraud. Claim wording: "we found no Indian SMB billing tool that lets the buyer verify payee details against a tamper-evident record." (Dev A, 45 min, extends existing /verify.)
2. Scam-aware messaging footer on every template: never OTP/PIN, never changed payment details by message, verify link. (15 min, i18n.)
3. Privacy card in Settings: data map, GST 72-month retention rule ⚠, opt-outs in force, anonymize action, notice_shown log (notice-delivery evidence per DPDP Rules). (Dev B, ~1h, Sun 9–12.)
Funding: these sit ahead of "big order" what-if and HI depth in the cut list; still roadmap (honesty slide): AES field encryption, encrypted backups, owner 2FA, data export, consent manager.
Pitch line: "FullPay protects both sides of the invoice."

## REV F — Research deltas (Fri 23 Oct 2026, Day 0; full 30-item list with sources: `13_reference_library.md` Part E, config block Part D)
Four research passes (144 sources, verified 22 Oct) → **no new runtime dependency**; the items below change code, config, seed or pitch:
1. **RBI series in the LLD was wrong** — `{2025-02-07, 625}` is the *repo* rate. Bank Rate series (bps): 675@2023-02-08 · 650@2025-02-07 · 625@2025-04-09 · 575@2025-06-06 · 550@2025-12-05 · **575@2026-10-07**. §16 today = **17.25%**. The seed window crosses the 7 Oct hike → demo both segments.
2. `gst_rates_bps = [0,25,150,300,500,1800,4000]` — the pack's list (0/5/18/3/40) never had 28% (withdrawn 1 Feb 2026 anyway); we add 0.25/1.5 for completeness and note the withdrawal on the method page.
3. Demo turnover `turnover_paise ≤ 5000000000` (₹4.5 cr): above ₹5 cr a printed B2B invoice without IRN "shall not be treated as an invoice" (Rule 48(5)). HSN 4 digits required, 6 allowed. Add `udyam_number` and `pin` to the business config.
4. TDS `rates_bps [10,100,200,1000]` unchanged; labels = Income-tax Act 2025 s.393(1) Sl. 6(i)/6(iii)/8(ii) "(was 194C/194J/194Q)", in force 1 Apr 2026.
5. Credit = `Math.min(credit_days ?? 15, 45)` (§15); acceptance defaults to delivery date (§2(b)); §16 line only for micro/small suppliers (§2(n)); appropriation `interest_first` cites *Gurpreet Singh* (SC 2006); rate switches on the RBI change date (*V.K. Patel*, Cal HC 2024). Golden test: ₹5,00,000 @ 19.5% × 365 d = ₹1,06,704 ± ₹5; footnote the 6-month ₹430 day-count gap (days/365 vs months/12).
6. pg parsers: add `setTypeParser(1082, v => v)` (DATE stays `'YYYY-MM-DD'` — default JS Date breaks `lib/time.js`) and `(1184, v => v)`; `pool.on('error')`. Advisory-lock keys are constants (42 chain, 7 tick) — `hashtext()` is undocumented.
7. `escalation_events` gets an append-only trigger (Solana SDP, MIT, with notice); `/api/reseed` wraps `DISABLE TRIGGER USER … ENABLE TRIGGER USER`. `/verify` ignores BIGSERIAL id gaps (retries burn ids); result `{ok, reason, breakAtSeq}`. Add JCS `weird`/`french` vectors (Apache-2.0) to the canonicalize tests.
8. Aging: due today = `not_due` (pin in a test; ERPNext puts it in the first overdue bucket).
9. Next.js 16: `proxy.js` (middleware deprecated), `await cookies()`, re-check the session cookie in every owner API route (CVE-2025-29927); Node ≥20.9 via `.node-version`.
10. Render: create the free Postgres on Day 0 (expires 30 days after creation); web on **Starter** for judging (free spins down); cron ≥$1/mo, schedule in UTC; Workflow task `daily-tick` `timeoutSeconds:120, retry:{maxRetries:0}`; Blueprint may reject `type: workflow` → create in Dashboard; cron start command = one curl to `POST https://api.render.com/v1/task-runs`.
11. Resend: a **verified domain is mandatory** (`resend.dev` only reaches our own inbox) → DNS on Day 0; `from` matches the verified (sub)domain exactly; serial flush (10 req/s); idempotency key `outbox-<id>-<attempt>`; errors are *returned*, not thrown.
12. cron-job.org: `/api/reseed` replies 202 then works (30 s timeout); no secrets in any response body (stored 2 days); 25 consecutive failures auto-disable the job.
13. WhatsApp copy (Meta rules): footer ≤60 chars → EN "We never ask for OTP/PIN or change bank details." · HI "हम कभी OTP/PIN नहीं मांगते, न बैंक विवरण बदलते हैं।"; body never starts/ends with a variable; no "legal action" wording; frame as payment updates ("debt collection" is restricted); templates `invoice_sent / payment_due_soon / payment_due_today / payment_overdue / payment_overdue_final`; buttons Pay `/pay/{{1}}`, Verify `/verify/{{1}}`; letter by email/print only.
14. Letter: **add** Udyam number, per-invoice acceptance dates, "please confirm receipt"; **drop** "without further notice", 43B(h), MSEFC/ODR threats. ODR card = Scheme Guidelines §12.1.4 (a)–(h) checklist + gates (Udyam registered before supply; micro/small; not traders NIC 45–47; Limitation Act); cite MoMSME Annual Report "w.e.f. 15 Oct 2025" + Samadhaan banner.
15. Privacy card: retention 72 months from 31 Dec after the FY (FY26-27 → 31-12-2033; CGST s.36 + Rule 80); DPDP phases 13-11-2025 / 13-11-2026 / 13-05-2027; s.8(7) anonymise-keep; wording "designed to DPDP principles — duties not yet in force".
16. Seed & matching: bank CSV uses an HDFC-style header (`Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance`), DD/MM/YY, narrations `UPI/<ref>/<note>/<vpa>/…` and `NEFT CR-…`, a zero-amount opening-balance row → `skipped[]` with reasons; label it "HDFC-like". Name-normalise = one regex applied twice, then fuse ≤0.35. `STATE_CODES` from gst-states (MIT; relabel/drop 99, add 96); UQC unit list from the e-invoice Master Codes.
17. UX tokens (UX4G): body ≥16 px, line-height 1.5 / 1.8 Devanagari, Noto Sans, status colours #00522c / #8a1a16 / #ad4e00 / #006d75, icon + word on every status, one fixed help button.
18. Pitch: ₹8.1 lakh crore stuck (Economic Survey via MoMSME AR 2025-26; keep ₹7.34 L-cr 2024 as the trend) · ODR disposed 17 cases in 8 months · prior-art slide adds **PayUpPal (Aug–Sep 2026)** and **SirigangaBS/InvoiceChaser (17 Oct 2026)** beside Vasuli/FundRaksha. Say "we found none that…", never "first".
19. Repo `fullpay`: MIT + `NOTICE` (gst-states MIT · Solana trigger MIT · JCS vectors Apache-2.0 · burnrate header synonyms Apache-2.0 if used · Free-GST `openWhatsAppShare` MIT if copied); README declares the pre-event planning docs; first code commit after 9:30 PM IST.
Demo-data checklist **A (collect real) is now done** — RBI series, GST rates + INV-1 schema, HSN source, ODR list + cutover evidence, MSMED text + appropriation, real bank CSV format — values sit in `13_reference_library.md` Part D.

## REV F.1 — Pack conformance check (23 Oct; coverage matrix in `13_reference_library.md` Part G)
Re-read `problemstatement/chase` end to end against this plan: all 11 "possible areas", all 13 Build-1 screens, the money and demand-letter rules, the 10-point finish list and the 18-point Build-2 list are covered in Layer 1; the only deviation is the suggested stack. Twelve small additions, none a scope change:
1. Forecast shows "invoices that would cover the gap" under the shortfall week (LLD lacks it; ~15 lines).
2. All three what-ifs stay (pays 30 days later · big order · supplier delayed) unless the Sat 11 PM red trigger fires.
3. Settings exposes the pack's full list: ladder offsets, buffer, per-rung auto-send toggles, language, text size, Demo date, Reset demo, business profile incl. registration type / turnover / Udyam / bank / UPI / logo (URL, initials fallback).
4. Inbox accept → `credit_note_no` in the `invoice_adjusted` event; mark-paid and reject-with-reply stay.
5. Email in the business's name, `reply_to` = owner, invoice + pay links; `.env.example` in the first commit.
6. `MAIL_TEST_MODE=1` routes every email to the owner's inbox (add-on asks; de-risks the demo).
7. Keep the Tax Invoice signature line (pack asks; Rule 46 note is informational).
8. Invoice filters show all seven pack statuses (due soon / overdue derived).
9. Plain-word labels with the accounting term as a tooltip (i18n label + hint pairs).
10. Seed expenses: salaries 1st, rent 5th, supplier bills, electricity, GST payment 20th; one disputed invoice; e-invoice banner demoed by raising turnover in Settings.
11. README "where the pack's files live" table (src/data → db/seed.js; config.js → config row; templates.js → lib/templates.js; src/i18n → lib/i18n).
12. Demo: pack judges expect dashboard, shortfall week + covering invoices, one-tap WhatsApp send, dispute-pause via /pay. Proposal: 20-second guided montage before the four novelty beats, hook trimmed to 10 s — team decides Day 0.
Known, declared deviations: stack; ODR "formerly Samadhaan"; GST list adds 0.25/1.5 and omits 28; dated RBI series; five stored / seven displayed statuses.
