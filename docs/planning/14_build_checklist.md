# 14 — FullPay Build Checklist (the complete view)

**Updated:** Fri 23 Oct 2026, 11:20 IST · **Build started:** Fri 11:15 AM IST by team decision (declared in the README) · **Official kickoff:** 9:30 PM IST · **Submit by:** Sun 25 Oct 8:30 PM IST (deadline 9:30 PM; confirm P0.1)

This is the single tracking document. Every work item has an ID, an owner, a schedule slot, a status and a "done when" test. Statuses: **TODO** · **DOING** · **DONE** · **BLOCKED** · **CUT**. Owners: **A** = Dev A (engine track), **B** = Dev B (product track), **V** = Ved (accounts, DNS, decisions), **C** = Claude. Claude pairs on every A and B row. Source plan: `10_build_plan.md` (Rev F.1); specs: `lld.html`; research: `13_reference_library.md`.

| Phase | Window (IST) | Items | Gate |
|---|---|---|---|
| P0 Pre-kickoff | Fri, before 9:30 PM | accounts, DNS, research, this checklist | nothing here is application code |
| P1 Scaffold | Fri 11:15 AM onward (started early) | repo, app shell, DB, config, seed v1, first deploy | `/api/health` green on Render |
| P2 Core data + APIs | Sat 12 – 3 AM | CRUD, hash chain, ladder v1, dashboard + list | dashboard reads live data |
| P3 Money engines + invoice UI | Sat 9 AM – 2 PM | GST, interest, tick live, new invoice, print | cron → Workflow → tick runs on Render by 2 PM |
| P4 Collections | Sat 2 – 7 PM | recon, payments, outbox + Resend, follow-ups, /pay, inbox | a real reminder email lands |
| P5 Forecast, documents, i18n | Sat 7 – 11 PM | forecast, chase-first, promises, letter, bundle, verify, Hindi | letter + bundle print with QR |
| P6 Integration checkpoint | Sat 11 PM | unattended ladder run on the deployed app | red-trigger review |
| P7 Acceptance & polish | Sun 9 AM – 12 PM | pack checklist, trust behaviours, states, 360px, README | all A-items green |
| P8 Layer-3 gate | Sun 10 AM | only if P1–P7 green | team decision |
| P9 Freeze & media | Sun 12 – 5 PM | freeze, video, deck, README final | 4 artefacts ready |
| P10 Submit | Sun 5 – 8:30 PM | smoke, links, submit | confirmation screenshot |

---

## P0 — Pre-kickoff (Fri 23 Oct, before 9:30 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P0.1 | Confirm in the organiser group: deadline (Sat midnight vs Sun 9:30 PM), video length (3 vs 5 min), any live round | V | TODO | Screenshot saved to `docs/organiser-answers.png`; plan adjusted if Saturday reading is confirmed |
| P0.2 | Render: sign in, note the $50 participant credit, create the **free Postgres** (30-day clock), generate `RENDER_API_KEY` | V | TODO | External connection string and API key in the team password manager |
| P0.3 | Hello-world Render Workflow in a **scratch** service (not the project): `render workflows init`, one task, one run from the Dashboard; try `type: workflow` in a Blueprint | V + A | TODO | A task run shows in the Dashboard; note whether Blueprint accepted the workflow or the Dashboard path is needed |
| P0.4 | Decide the sending domain; Resend: add domain, publish DKIM/SPF/MX on the `send.` subdomain (DNS-only on Cloudflare), start verification | V | TODO | Resend shows **Verified**; `from` address chosen (e.g. `billing@<domain>`) |
| P0.5 | n8n: claim the team voucher; build the 3-node receiver (Webhook → Set → Google Sheet or notify) | V | TODO | Webhook URL in the password manager; a test POST appears in the sheet |
| P0.6 | cron-job.org account | V | TODO | Logged in; nothing scheduled yet |
| P0.7 | GitHub: reserve repo `fullpay` (public, empty) | V | TODO | Empty repo exists; both devs + Claude have push |
| P0.8 | Win-more research sprint (competitor simulation, judge lens, pre-mortem, CA review, UX spec, demo/deck, quality bar) → `15_win_research.md`; team picks additions | C | DOING | File written; additions accepted or declined by the team, each with a slot |
| P0.9 | This checklist + the tracking page | C | DOING | `14_build_checklist.md` + `checklist.html` published; updated at every phase gate |
| P0.10 | Golden data prepared as **documents** (not code): RBI series JSON, GST test cases, interest golden cases, JCS vector URLs, 10–15 HSN seed rows, HDFC-like CSV header + sample narrations | C | TODO | `docs/golden/` folder with the values and their sources |
| P0.11 | Final name sweep for "FullPay" (Play Store, Product Hunt, GitHub, domain) | V | TODO | No exact-match competitor; result noted in the decisions log |
| P0.12 | Team approves Rev F + Rev F.1 + dossier §0 | V | DONE | 23 Oct: "now it's time to build" |
| P0.13 | Devices: Android phone with a UPI app (QR test, 360px), second laptop for the 4G smoke test | B | TODO | Both on hand Sunday |
| P0.14 | Decide: code commits start at 9:30 PM (build-fresh rule) or earlier with declaration | V | DONE | 23 Oct 11:10: "start now, don't wait till 9:30"; early start declared in the README |

## P1 — Scaffold (Fri 9:30 PM – 12 AM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P1.1 | Repo init: `README.md` (one-liner, team, "Pre-event planning, declared" section), `LICENSE` MIT, `NOTICE`, `.gitignore`, `.node-version` (22), `.env.example` | A | TODO | First commit on `main` after 9:30 PM |
| P1.2 | Next.js 16 App Router (plain JS); `proxy.js` auth boundary with allow-list; `/login` (OWNER_PASSWORD, HMAC-signed httpOnly cookie, rate limit); `/api/health` → `{ok:true}` | A | TODO | Unauthenticated `/` redirects to `/login`; `/api/health` public |
| P1.3 | `lib/db.js`: pool, type parsers 20/1700/1082/1184, `withTxn`, `pool.on('error')`; `db/schema.sql` (10 tables, CHECKs, UNIQUE(fy,seq), partial unique one_open_promise, indexes, append-only trigger on `escalation_events`); `npm run db:migrate` | A | TODO | Migration applies cleanly twice (idempotent) |
| P1.4 | `lib/time.js` (`initTime`, `today`, `addDays`, `addMonths` clamped, `fyOf`, IST) and `lib/money.js` (`asPaise`, `fmtINR` en-IN, `toWords` Indian) with `node:test` | A | TODO | Tests green incl. 31 Jan + 1 month = 28/29 Feb |
| P1.5 | `config` row seeded from Part D (RBI series, GST bps, TDS, MSMED, retention, DPDP, ODR checklist, messaging footers, UI tokens, ladder offsets −3/0/+7/+15/+30/+45, buffer, `letter.deadline_days` 7) | A | TODO | `SELECT` shows every key with `source` and `verified` |
| P1.6 | `render.yaml` (web Starter, db free, cron 04:30 UTC with the task-runs curl); `workflows/` with the `daily-tick` task (`@renderinc/sdk`, `timeoutSeconds 120`, `maxRetries 0`) | A | TODO | Blueprint validates (or Workflow created in Dashboard, noted) |
| P1.7 | shadcn/ui + design tokens (UX4G status colours, Noto Sans + Devanagari, 16px body, 48px buttons, 1.8 line-height for Hindi); app shell with navigation for the 13 screens; 360px first | B | TODO | Shell renders on phone and laptop with no horizontal scroll |
| P1.8 | i18n: `lib/i18n/en.json`, `hi.json`, `t()`; keys as label + hint pairs; language and text size read from `config.ui` | B | TODO | Switching language changes the shell text |
| P1.9 | Seed generator v1 (`db/seed.js`, deterministic): Arora Auto Components (Ludhiana, GST regular, Udyam small, turnover ₹4.5 cr, Udyam number, PIN), 14 customers (GSTINs pass the check digit; one Haryana IGST; one unregistered; one NULL credit terms; archetypes prompt / chronic late / disputer / TDS deductor), ~40 invoices over 4 months incl. exactly one disputed, expenses (salaries 1st, rent 5th, supplier bills, electricity, GST payment 20th), opening balance ₹4.2 L, buffer ₹1.5 L | B | TODO | `npm run db:seed` twice yields identical hashes |
| P1.10 | GitHub Actions: `node --test` on every push | A | TODO | Green check on the first commit |
| P1.11 | First deploy: web + db on Render, env vars set (`sync:false` ones by hand), `/api/health` green on the public URL | A | TODO | URL opens from a phone |

## P2 — Core data + APIs (Sat 12 – 3 AM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P2.1 | Customers API: CRUD, GSTIN mod-36 validation, state from GSTIN, credit days, contacts, opt-out, preferred language field | A | TODO | Invalid check digit rejected with `{error:{code,message}}` |
| P2.2 | Invoices + items API: drafts unnumbered; `seq` allocated at `/send` (UNIQUE fy, seq); due = acceptance (default delivery/issue) + `min(credit_days ?? 15, 45)`; statuses draft / sent / part_paid / paid / disputed; derived due_soon / overdue; pay token minted at send | A | TODO | Two concurrent sends never share a number |
| P2.3 | `lib/chain.js`: `canonicalize` (whitelist; floats and Dates throw), `appendEvent` (advisory lock 42, `prev_hash`, `entry_hash = sha256(prev + "\n" + payload)`), `verify` walk (`{ok, reason, breakAtSeq}`, BIGSERIAL gaps ignored); tests: JCS `weird` + `french` vectors, tamper detection, trigger blocks UPDATE/DELETE | A | TODO | Tests green; a manual UPDATE fails at the DB |
| P2.4 | `lib/ladder.js` v1: rung order, global preconditions, entry/unpause = highest due rung with `rung_skipped` events, max one advance per tick, pause (dispute), snooze, promise | A | TODO | Table test: one invoice through every rung on the demo clock |
| P2.5 | Dashboard on live API: 7 stats (to collect, overdue, expected this week / month, bills due 30 days, cash in bank, lowest forecast point), 5-bucket ageing bar (not due · 1–30 · 31–60 · 61–90 · 90+), top-5 placeholder | B | TODO | Numbers agree with the seed by hand-check |
| P2.6 | Invoices list: filters (customer, status incl. due soon / overdue, due date, days overdue), search; invoice detail with timeline | B | TODO | All seven pack statuses selectable |

## P3 — Money engines + invoice UI (Sat 9 AM – 2 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P3.1 | `lib/gst.js`: per-line taxable value in paise (`qty_milli × rate − discount`), CGST/SGST each half-rate rounded separately vs IGST by state code, round-off line to the rupee, words match the rounded total, document type by registration (Tax Invoice / Bill of Supply with the composition heading / plain), HSN 4 digits ≤ ₹5 cr else 6, `einvoiceRequired()` above ₹5 cr, `einvoiceJson()` with NIC keys + schema shape test | A | TODO | Tests: ₹10,000 @ 18 % PB→PB = 900 + 900 = 11,800 and PB→HR = IGST 1,800; 3 × ₹333 @ 5 %; 10 % discount line; composition; 0 % item |
| P3.2 | `lib/interest.js`: segments at RBI change dates, monthly rests (`addMonths` from the due date), 0 % inside accepted dispute spans, allocations interest-first, `Math.round` per segment, total = Σ; conventions footnote text | A | TODO | Goldens: ₹5,00,000 @ 19.5 %: 365 d = ₹1,06,704 ± ₹5, 181 d ≈ ₹50,344, 120 d ≈ ₹32,838; rate-change-mid-delay case; partial payment mid-way |
| P3.3 | `/api/tick`: one transaction, `pg_try_advisory_xact_lock(7)` else 409, serial loop grouped by customer, `run_id` on events, outbox rows; **cron → Workflow → tick live on Render by 2 PM**; fallback gate: node-cron in the web service if the Workflow fights us | A | TODO | A Workflow run id appears on an event row in production |
| P3.4 | New-invoice flow: pick or add customer, GSTIN validated and state taken from it, items (HSN/SAC, qty, unit from UQC list, rate, discount, GST rate from config), live totals, due date from credit days, save draft or send | B | TODO | Totals match `gst.js` on every keystroke |
| P3.5 | Print template (Invoify-derived): Tax Invoice / Bill of Supply / plain; Rule 46 fields incl. reverse-charge flag, ship-to, **signature line**; UPI QR (`upi://pay?pa&pn&am&tn&cu=INR`); `@page A4` CSS; e-invoice banner when turnover > ₹5 cr | B | TODO | Browser "Save as PDF" prints ₹ and Devanagari correctly |
| P3.6 | Customers screen: credit days, contacts, total owed, avg days late, % on time, grade A/B/C with the reason, opt-out toggle, anonymize | B | TODO | Grade reasons read as sentences |

## P4 — Collections (Sat 2 – 7 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P4.1 | `lib/recon.js`: CSV parse (HDFC-like header synonyms, DD/MM/YY, skip-until-header, zero opening-balance row → `skipped[]` with reasons), invoice-number regex (FY-whitelisted, separator-tolerant: `INV/26-27/0012` ≈ `INV 26-27 12` ≈ `0012`), amounts in paise vs **outstanding**, name normalisation (M/s, Pvt Ltd, case; regex applied twice) + fuse ≤ 0.35, confidence + reason; six cases: exact, part, one-payment-many-invoices (oldest first unless named), TDS 1 / 2 / 10 % of taxable (± ₹1), overpayment, unknown deposit; `dedupe_hash` makes re-import idempotent | A | TODO | Table test over `db/bank-statement.csv`: every line, its match, its reason |
| P4.2 | Payments screen: import CSV, add payment by hand, review matches, **confirm gate** (nothing paid without confirmation), allocations shown | B | TODO | Re-importing the same file changes nothing |
| P4.3 | Outbox + Resend: statuses queued / awaiting_owner / sent / failed; merge key (customer, rung, channel); `Idempotency-Key outbox-<id>-<attempt>`; from the business name with `reply_to` = owner; invoice + pay links; footer = contact + anti-scam line (≤ 60 chars); `MAIL_TEST_MODE` → owner inbox; cap one message per customer per day; auto-send only heads_up + due_date (owner toggles); failed → retry in Follow-ups; `{error}` handled, serial flush | A | TODO | A seeded almost-due invoice produces a real email in the inbox |
| P4.4 | Today's follow-ups: every rung due today with the ready message (EN/HI by customer), one-tap wa.me / mailto / sms, Mark as sent, Snooze, Promise to pay (one open, ≤ today + 14 d) | B | TODO | wa.me opens WhatsApp with the text on a phone |
| P4.5 | `/pay/:token` (no login): invoice, amount owed, Pay by UPI (QR + button, simulated), "I've already paid" (reference + date → `payments.source = claim`), "Something's wrong" (reason) → ladder paused → Inbox; DPDP notice in the customer's language; 404 / 410 token semantics | B | TODO | Dispute from the phone pauses the ladder within one tick |
| P4.6 | Inbox: accept (credit note → `invoice_adjusted` with `credit_note_no`, or mark paid), reject with reply, edit invoice; resolving resumes or stops the ladder; interest clock stops only on owner acceptance | B | TODO | Timeline shows the credit note entry |
| P4.7 | LLM tone drafting behind a flag with template fallback ("no LLM in the money path") | A | TODO | Flag off → templates; flag on → drafted text marked as AI-assisted |
| P4.8 | n8n webhook POST on escalation events (fire-and-forget, 15 lines) | A | TODO | Event row appears in the n8n sheet |

## P5 — Forecast, documents, i18n (Sat 7 – 11 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P5.1 | `lib/forecast.js`: 13 weeks (opening, in = each unpaid invoice at due date + customer's average delay, or the promise date; out = expenses; closing), week-chaining by construction, first week below the buffer, what-ifs × 3 (customer pays 30 days later · big order · supplier payment delayed), **invoices that would cover the gap**, ageing buckets (due today = not_due), `reliability()` | A | TODO | Test: closing(n) = opening(n+1); totals agree with invoices + expenses |
| P5.2 | Chase-these-first: score from amount, days overdue, reliability, cash-gap impact; reason sentence ("₹1,20,000, 38 days overdue, usually pays 20 days late, covers week 6"); dashboard top 5 | A | TODO | Top 5 ordering explainable from the reasons |
| P5.3 | Promise objects: pause rung, shift inflow, "promise at risk" near the date, broken promise auto-resumes at the next rung and restores the forecast | A | TODO | Demo toggle: promise → gap moves; break → ladder resumes |
| P5.4 | Forecast screen (recharts): weekly bars, buffer line, what-if switches, covering invoices list | B | TODO | Switching a what-if redraws within a second |
| P5.5 | Demand letter print page: title "Payment Demand Letter"; the "not a GST / legal notice" line; invoice schedule with part payments and acceptance dates; 7-day deadline; bank + UPI QR; dispute contact; Udyam number; Udyam-gated MSMED paragraph with the per-period interest table (checkbox persisted, interest not demanded unless ticked); "please confirm receipt"; verify QR (`entry_hash`); conventions footnote (actual/365, monthly rests, rate switch on RBI date, 0 % in accepted disputes, interest-first; Gurpreet Singh; V.K. Patel) | B | TODO | Letter for INV/26-27/0042 prints with the pinned hash |
| P5.6 | ODR bundle / evidence pack print page: parties + Udyam, invoice schedule, days-overdue computation, interest table, timeline with hash stamps, §12.1.4 (a)–(h) checklist, eligibility gates, "MSME ODR portal (formerly Samadhaan)" | B | TODO | Prints paginated on A4 |
| P5.7 | `/verify/[hash]` public page: `{found, intact, event:{type, invoice_number, ts, hash}, payee:{vpa, bank_last4}}`, no PII; QR on invoice, letter and bundle | A | TODO | Phone scan of the letter QR shows "intact" + payee details |
| P5.8 | Documents screen: per-invoice timeline with hash stamps; "Download evidence pack" | B | TODO | Every invoice event visible with its hash |
| P5.9 | Hindi pass over screens, templates, print pages using the RBI/CBIC terms (कर बीजक, भुगतान की तारीख, बकाया, अतिदेय, ब्याज, मांग पत्र); everyday बिल / बकाया on screens | B | TODO | Every string switches; no layout break at 360px |
| P5.10 | Settings: business profile (name, address, state, GSTIN, registration type, turnover, Udyam yes/no + number, bank, UPI, logo URL with initials fallback), ladder offsets, buffer, per-rung auto-send toggles, language, text size, Demo date, Reset demo | B | TODO | Changing turnover above ₹5 cr shows the e-invoice banner |

## P6 — Integration checkpoint (Sat 11 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P6.1 | Full ladder runs unattended on the deployed app: seeded almost-due invoice receives its real email with zero clicks; audit log shows the Workflow run id | A + B | TODO | Email in inbox; run id on the event |
| P6.2 | Seed assertions: INV/26-27/0042 at `demand_letter` with the pinned `letter_generated` hash; one deterministic tick at T0 ⇒ exactly 3 queued sends | A | TODO | `npm run db:seed && npm test` green |
| P6.3 | `/api/reseed` (secret header, 202 then work, `DISABLE / ENABLE TRIGGER USER`); cron-job.org: nightly reseed 01:00 IST, keep-alive every 10 min, tick fallback 10:05 IST | A | TODO | Three jobs enabled; reseed restores the pinned hash |
| P6.4 | Demo clock: `/api/demo/advance` and `/reset` (DEMO_MODE + cookie) calling the tick synchronously; "demo clock: 1 day = 5 s" label | A | TODO | Advancing 30 days drafts the letter on screen |
| P6.5 | Red-trigger review: any slot > 1 h over → apply the cut list in order | all | TODO | Decision logged |

## P7 — Acceptance & polish (Sun 9 AM – 12 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P7.1 | Pack BEFORE-YOU-FINISH list (A1–A9 below) all green on the **deployed** app | A + B | TODO | Each ticked with the deployed URL |
| P7.2 | Build-2 18-item sweep (A11) | B | TODO | Done / partly / missing for each, all "done" |
| P7.3 | Trust behaviours: tampered row breaks `/verify`; opted-out contact never emailed unattended; anonymize keeps totals; expired token fails friendly | A | TODO | A15 green |
| P7.4 | Privacy card in Settings: data map, retention 72 months (FY26-27 → 31-12-2033), opt-outs in force, anonymize action, `notice_shown` log, DPDP dates + "designed to DPDP principles" wording | B | TODO | Card renders in EN and HI |
| P7.5 | Empty / loading / error states on every screen; error contract everywhere | B | TODO | Fresh DB shows designed empty states |
| P7.6 | 360px and largest-text-size pass; wide tables → stacked cards; Hindi word wrap; A4 print pages still correct | B | TODO | No horizontal scroll on any screen |
| P7.7 | Accessibility: labels on every control and icon, visible focus, AA contrast, icon + word on every status; axe clean on dashboard, invoice, follow-ups | B | TODO | axe reports 0 serious issues |
| P7.8 | No console errors on any screen; Lighthouse accessibility ≥ 90 | B | TODO | Screenshots in `docs/` |
| P7.9 | README (pack-mirrored): problem in two lines; one line per screen; GST logic + document types; ladder + why the letter is not a legal notice; matching, forecast and chase score explained; improvement over manual chasing; run instructions; what is simulated; next steps; the five WhatsApp templates; "where the pack's files live" table; judge's 2-minute tour; path to production; declared pre-event planning | A | TODO | A stranger can run it locally from the README |

## P8 — Layer-3 gate (Sun 10 AM; only if P1–P7 are green on the deployed app)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P8.1 | LLM tone drafting switched on (if P4.7 landed) | A | TODO | Marked "AI-assisted" in the UI |
| P8.2 | Invoice-from-photo OCR | — | CUT | Roadmap slide only |
| P8.3 | Marathi | — | CUT | Roadmap slide only |
| P8.4 | Per-customer preferred language in templates and pay page | B | TODO | Only if time; field already exists (P2.1) |

## P9 — Freeze & media (Sun 12 – 5 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P9.1 | **FREEZE** at 12:00 (autoDeploy off); demo-clock rehearsal twice | all | TODO | Rehearsal timed ≤ 2:50 |
| P9.2 | Video ≤ 3 min with captions; every beat baked in: dashboard + shortfall week, one-tap WhatsApp, dispute pause, bank import with TDS, GST side by side, autonomous run + real email, interest letter, ODR bundle + QR verify, promise break, demo date forward | B | TODO | Uploaded; link opens in incognito |
| P9.3 | Deck (10 slides): problem + impact numbers (₹8.1 L cr, ODR 17 cases), handout vs ours, novelty levers with "we found none that…", architecture (cron → Workflow → tick), trust by design, demo stills, prior-art name-check (Vasuli, FundRaksha, PayUpPal), path to production, non-goals, team | A | TODO | PDF exported; link opens in incognito |
| P9.4 | README final; `NOTICE` (gst-states MIT, Solana trigger MIT, JCS vectors Apache-2.0, burnrate synonyms if used, Free-GST share if copied); `docs/` with the planning files | A | TODO | Repo tidy on GitHub |
| P9.5 | Live-demo and async-judging risk list in the deck appendix | A | TODO | Slide present |

## P10 — Submit (Sun 5 – 8:30 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P10.1 | Repo tidy: no secrets, `.env.example` complete, CI green | A | TODO | `git log` clean; secret scan passes |
| P10.2 | Live URL smoke on 4G and a second device; `/pay/:token` after refresh; `/verify` QR scanned from a phone | B | TODO | All pass on the deployed URL |
| P10.3 | All four links opened in incognito (GitHub, live URL, video, deck) | both | TODO | Screenshots |
| P10.4 | Submit via the dashboard by 8:30 PM IST ("Submitting is final") | V | TODO | Confirmation screen |
| P10.5 | Confirmation screenshot saved; team message | V | TODO | Done |

---

## Acceptance suite (ticked during P7; every item on the deployed app)

| ID | Test | Status |
|---|---|---|
| A1 | ₹10,000 @ 18 % same state → CGST ₹900 + SGST ₹900 = ₹11,800; other state → IGST ₹1,800 = ₹11,800 (our seed: Punjab → Punjab and Punjab → Haryana) | TODO |
| A2 | Invoice numbers consecutive within the FY and never repeat | TODO |
| A3 | Every sample GSTIN passes the check digit; changing one character fails | TODO |
| A4 | Every demand letter is titled "Payment Demand Letter" and carries the "not a GST / legal notice" line | TODO |
| A5 | Ladder pauses for a dispute or a promise; never sends the same stage twice | TODO |
| A6 | Payment matching handles all six CSV cases; nothing marked paid without confirmation; re-import never double-counts | TODO |
| A7 | Forecast: each week's closing = next week's opening; totals agree with invoices and expenses | TODO |
| A8 | Every text switches EN/HI; everything works at 360px; nothing lost on reload | TODO |
| A9 | Every screen opens with no console errors | TODO |
| A10 | Interest: rate-change-mid-delay segments; partial payment mid-way; goldens within ± ₹5 | TODO |
| A11 | Build-2 list (18 items) all "done" | TODO |
| A12 | Promise pauses + reflows; broken promise resumes at the next rung and restores the forecast | TODO |
| A13 | ODR bundle: every artefact for one invoice present, dated, paginated, printable | TODO |
| A14 | Unattended run: a real email with zero clicks; audit log shows the Workflow run id | TODO |
| A15 | Tampered row breaks `/verify`; opted-out contact never emailed; anonymize keeps totals; expired token fails friendly | TODO |
| A16 | Part payment keeps the stage and updates the amount; separator-tolerant invoice-number match; name normalisation | TODO |
| A17 | `/pay/:token` deep link works on the deployed URL after a refresh | TODO |
| A18 | Due today = not_due; ageing buckets correct; TDS flagged at exactly 1 / 2 / 10 % of taxable value | TODO |

## Cut list (ordered; trigger: any slot more than 1 h over)

n8n webhook → what-if #3 (big order) → Hindi depth (demo screens only) → forecast to static → invoice print polish (on-screen GST view always survives) → ODR bundle to a pre-rendered sample.
**Never cut:** ladder, interest engine, `/verify`, on-screen GST math, demand letter, bank matching.

## Decisions log

| Date | Decision |
|---|---|
| 22 Oct | Name locked: FullPay |
| 23 Oct | Rev F (research corrections) and Rev F.1 (pack conformance) approved; team says "time to build" |
| 23 Oct | Code starts now (11:15 AM IST), not at kickoff; the README declares the early start and the 21–23 Oct planning docs (build-fresh clause: pre-existing work must be declared) |
