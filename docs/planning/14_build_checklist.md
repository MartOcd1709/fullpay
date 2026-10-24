**Updated:** Sat 24 Oct 2026, 11:30 IST · **Build started:** Fri 11:15 AM IST by team decision (declared in the README) · **Official kickoff:** 9:30 PM IST · **Submit by:** Sun 25 Oct 8:30 PM IST (deadline 9:30 PM; confirm P0.1)

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
| P0.2 | Render: sign in, note the $50 participant credit, create the **free Postgres** (30-day clock), generate `RENDER_API_KEY` | V | DONE | External connection string and API key in the team password manager — Render free plan: fullpay-web + fullpay-db (Singapore) via Blueprint; no card |
| P0.3 | Hello-world Render Workflow in a **scratch** service (not the project): `render workflows init`, one task, one run from the Dashboard; try `type: workflow` in a Blueprint | V + A | CUT | A task run shows in the Dashboard; note whether Blueprint accepted the workflow or the Dashboard path is needed — Workflows need a card on Render; render.paid.yaml keeps the variant; the daily run is built in (lib/scheduler.js) |
| P0.4 | Decide the sending domain; Resend: add domain, publish DKIM/SPF/MX on the `send.` subdomain (DNS-only on Cloudflare), start verification | V | TODO | Resend shows **Verified**; `from` address chosen (e.g. `billing@<domain>`) |
| P0.5 | n8n: claim the team voucher; build the 3-node receiver (Webhook → Set → Google Sheet or notify) | V | CUT | Webhook URL in the password manager; a test POST appears in the sheet — n8n optional; not needed for the pack |
| P0.6 | cron-job.org account | V | CUT | Logged in; nothing scheduled yet — Superseded: built-in 10:00 IST scheduler + nightly reset (lib/scheduler.js); cron-job.org only as optional keep-alive |
| P0.7 | GitHub: reserve repo `fullpay` (public, empty) | V | DONE | Empty repo exists; both devs + Claude have push — private repo https://github.com/MartOcd1709/fullpay, main pushed 12:40 IST |
| P0.8 | Win-more research sprint (competitor simulation, judge lens, pre-mortem, CA review, UX spec, demo/deck, quality bar) → `15_win_research.md`; team picks additions | C | DONE | File written; additions accepted or declined by the team, each with a slot — 15_win_research.md: 45 kept of 106, legal claims fact-checked |
| P0.9 | This checklist + the tracking page | C | DONE | `14_build_checklist.md` + `checklist.html` published; updated at every phase gate — page https://claude.ai/artifact/3nm9uJ8SAJmKHxeqMvssCe |
| P0.10 | Golden data prepared as **documents** (not code): RBI series JSON, GST test cases, interest golden cases, JCS vector URLs, 10–15 HSN seed rows, HDFC-like CSV header + sample narrations | C | DONE | `docs/golden/` folder with the values and their sources — Goldens live in tests (gst, interest oracle, recon fixture) and on /proof |
| P0.11 | Final name sweep for "FullPay" (Play Store, Product Hunt, GitHub, domain) | V | TODO | No exact-match competitor; result noted in the decisions log |
| P0.12 | Team approves Rev F + Rev F.1 + dossier §0 | V | DONE | 23 Oct: "now it's time to build" |
| P0.13 | Devices: Android phone with a UPI app (QR test, 360px), second laptop for the 4G smoke test | B | TODO | Both on hand Sunday |
| P0.14 | Decide: code commits start at 9:30 PM (build-fresh rule) or earlier with declaration | V | DONE | 23 Oct 11:10: "start now, don't wait till 9:30"; early start declared in the README |

## P1 — Scaffold (Fri 9:30 PM – 12 AM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P1.1 | Repo init: `README.md` (one-liner, team, "Pre-event planning, declared" section), `LICENSE` MIT, `NOTICE`, `.gitignore`, `.node-version` (22), `.env.example` | A | DONE | First commit on `main` after 9:30 PM — commit 1 on main, 11:50 IST |
| P1.2 | Next.js 16 App Router (plain JS); `proxy.js` auth boundary with allow-list; `/login` (OWNER_PASSWORD, HMAC-signed httpOnly cookie, rate limit); `/api/health` → `{ok:true}` | A | DONE | Unauthenticated `/` redirects to `/login`; `/api/health` public — proxy.js boundary, HMAC session, login rate limit, open-redirect fix |
| P1.3 | `lib/db.js`: pool, type parsers 20/1700/1082/1184, `withTxn`, `pool.on('error')`; `db/schema.sql` (10 tables, CHECKs, UNIQUE(fy,seq), partial unique one_open_promise, indexes, append-only trigger on `escalation_events`); `npm run db:migrate` | A | DONE | Migration applies cleanly twice (idempotent) — schema + db layer + migrate |
| P1.4 | `lib/time.js` (`initTime`, `today`, `addDays`, `addMonths` clamped, `fyOf`, IST) and `lib/money.js` (`asPaise`, `fmtINR` en-IN, `toWords` Indian) with `node:test` | A | DONE | Tests green incl. 31 Jan + 1 month = 28/29 Feb — time + money, 33 tests, reviewed and fixed |
| P1.5 | `config` row seeded from Part D (RBI series, GST bps, TDS, MSMED, retention, DPDP, ODR checklist, messaging footers, UI tokens, ladder offsets −3/0/+7/+15/+30/+45, buffer, `letter.deadline_days` 7) | A | DONE | `SELECT` shows every key with `source` and `verified` — lib/config.js with Part D values, 18 tests |
| P1.6 | `render.yaml` (web Starter, db free, cron 04:30 UTC with the task-runs curl); `workflows/` with the `daily-tick` task (`@renderinc/sdk`, `timeoutSeconds 120`, `maxRetries 0`) | A | DONE | Blueprint validates (or Workflow created in Dashboard, noted) — render.yaml + workflows/daily-tick |
| P1.7 | shadcn/ui + design tokens (UX4G status colours, Noto Sans + Devanagari, 16px body, 48px buttons, 1.8 line-height for Hindi); app shell with navigation for the 13 screens; 360px first | B | DONE | Shell renders on phone and laptop with no horizontal scroll — shell, tokens, nav, 11 screen placeholders |
| P1.8 | i18n: `lib/i18n/en.json`, `hi.json`, `t()`; keys as label + hint pairs; language and text size read from `config.ui` | B | DONE | Switching language changes the shell text — i18n EN/HI + 5 message templates, 33 tests |
| P1.9 | Seed generator v1 (`db/seed.js`, deterministic): Arora Auto Components (Ludhiana, GST regular, Udyam small, turnover ₹4.5 cr, Udyam number, PIN), 14 customers (GSTINs pass the check digit; one Haryana IGST; one unregistered; one NULL credit terms; archetypes prompt / chronic late / disputer / TDS deductor), ~40 invoices over 4 months incl. exactly one disputed, expenses (salaries 1st, rent 5th, supplier bills, electricity, GST payment 20th), opening balance ₹4.2 L, buffer ₹1.5 L | B | DONE | `npm run db:seed` twice yields identical hashes — deterministic seed: 14 customers, 65 invoices, pinned 0042 hash, 3 sends at T0 |
| P1.10 | GitHub Actions: `node --test` on every push | A | DONE | Green check on the first commit — CI on GitHub Actions |
| P1.11 | First deploy: web + db on Render, env vars set (`sync:false` ones by hand), `/api/health` green on the public URL | A | DONE | URL opens from a phone — https://fullpay-web.onrender.com live, /api/health green, auto-deploys from main |

## P2 — Core data + APIs (Sat 12 – 3 AM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P2.1 | Customers API: CRUD, GSTIN mod-36 validation, state from GSTIN, credit days, contacts, opt-out, preferred language field | A | DONE | Invalid check digit rejected with `{error:{code,message}}` — customers service |
| P2.2 | Invoices + items API: drafts unnumbered; `seq` allocated at `/send` (UNIQUE fy, seq); due = acceptance (default delivery/issue) + `min(credit_days ?? 15, 45)`; statuses draft / sent / part_paid / paid / disputed; derived due_soon / overdue; pay token minted at send | A | DONE | Two concurrent sends never share a number — invoices service: draft/send, consecutive numbers under concurrency |
| P2.3 | `lib/chain.js`: `canonicalize` (whitelist; floats and Dates throw), `appendEvent` (advisory lock 42, `prev_hash`, `entry_hash = sha256(prev + "\n" + payload)`), `verify` walk (`{ok, reason, breakAtSeq}`, BIGSERIAL gaps ignored); tests: JCS `weird` + `french` vectors, tamper detection, trigger blocks UPDATE/DELETE | A | DONE | Tests green; a manual UPDATE fails at the DB — independent review + fixes, all tests green |
| P2.4 | `lib/ladder.js` v1: rung order, global preconditions, entry/unpause = highest due rung with `rung_skipped` events, max one advance per tick, pause (dispute), snooze, promise | A | DONE | Table test: one invoice through every rung on the demo clock — ladder, 22 tests, review fixes applied |
| P2.5 | Dashboard on live API: 7 stats (to collect, overdue, expected this week / month, bills due 30 days, cash in bank, lowest forecast point), 5-bucket ageing bar (not due · 1–30 · 31–60 · 61–90 · 90+), top-5 placeholder | B | DONE | Numbers agree with the seed by hand-check — dashboard with 7 stats, ageing bar, top-5 chase, interest tile |
| P2.6 | Invoices list: filters (customer, status incl. due soon / overdue, due date, days overdue), search; invoice detail with timeline | B | DONE | All seven pack statuses selectable — invoices list (7 statuses, filters, search) + detail with timeline |

## P3 — Money engines + invoice UI (Sat 9 AM – 2 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P3.1 | `lib/gst.js`: per-line taxable value in paise (`qty_milli × rate − discount`), CGST/SGST each half-rate rounded separately vs IGST by state code, round-off line to the rupee, words match the rounded total, document type by registration (Tax Invoice / Bill of Supply with the composition heading / plain), HSN 4 digits ≤ ₹5 cr else 6, `einvoiceRequired()` above ₹5 cr, `einvoiceJson()` with NIC keys + schema shape test | A | DONE | Tests: ₹10,000 @ 18 % PB→PB = 900 + 900 = 11,800 and PB→HR = IGST 1,800; 3 × ₹333 @ 5 %; 10 % discount line; composition; 0 % item — GST engine, 23 tests, review fixes applied (A1 cases pass) |
| P3.2 | `lib/interest.js`: segments at RBI change dates, monthly rests (`addMonths` from the due date), 0 % inside accepted dispute spans, allocations interest-first, `Math.round` per segment, total = Σ; conventions footnote text | A | DONE | Goldens: ₹5,00,000 @ 19.5 %: 365 d = ₹1,06,704 ± ₹5, 181 d ≈ ₹50,344, 120 d ≈ ₹32,838; rate-change-mid-delay case; partial payment mid-way — independent review + fixes, all tests green |
| P3.3 | `/api/tick`: one transaction, `pg_try_advisory_xact_lock(7)` else 409, serial loop grouped by customer, `run_id` on events, outbox rows; **cron → Workflow → tick live on Render by 2 PM**; fallback gate: node-cron in the web service if the Workflow fights us | A | DONE | A Workflow run id appears on an event row in production — daily run (tick) under advisory lock + run summaries; Render cron→Workflow config written (deploy pending) |
| P3.4 | New-invoice flow: pick or add customer, GSTIN validated and state taken from it, items (HSN/SAC, qty, unit from UQC list, rate, discount, GST rate from config), live totals, due date from credit days, save draft or send | B | DONE | Totals match `gst.js` on every keystroke — new invoice with live GST, sample line, same/other-state flip |
| P3.5 | Print template (Invoify-derived): Tax Invoice / Bill of Supply / plain; Rule 46 fields incl. reverse-charge flag, ship-to, **signature line**; UPI QR (`upi://pay?pa&pn&am&tn&cu=INR`); `@page A4` CSS; e-invoice banner when turnover > ₹5 cr | B | DONE | Browser "Save as PDF" prints ₹ and Devanagari correctly — print Tax Invoice / Bill of Supply / plain, UPI QR, A4 |
| P3.6 | Customers screen: credit days, contacts, total owed, avg days late, % on time, grade A/B/C with the reason, opt-out toggle, anonymize | B | DONE | Grade reasons read as sentences — customers list + detail with A/B/C grade and reason |

## P4 — Collections (Sat 2 – 7 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P4.1 | `lib/recon.js`: CSV parse (HDFC-like header synonyms, DD/MM/YY, skip-until-header, zero opening-balance row → `skipped[]` with reasons), invoice-number regex (FY-whitelisted, separator-tolerant: `INV/26-27/0012` ≈ `INV 26-27 12` ≈ `0012`), amounts in paise vs **outstanding**, name normalisation (M/s, Pvt Ltd, case; regex applied twice) + fuse ≤ 0.35, confidence + reason; six cases: exact, part, one-payment-many-invoices (oldest first unless named), TDS 1 / 2 / 10 % of taxable (± ₹1), overpayment, unknown deposit; `dedupe_hash` makes re-import idempotent | A | DONE | Table test over `db/bank-statement.csv`: every line, its match, its reason — independent review + fixes, all tests green |
| P4.2 | Payments screen: import CSV, add payment by hand, review matches, **confirm gate** (nothing paid without confirmation), allocations shown | B | DONE | Re-importing the same file changes nothing — payments: CSV import, sample statement, confirm gate, TDS |
| P4.3 | Outbox + Resend: statuses queued / awaiting_owner / sent / failed; merge key (customer, rung, channel); `Idempotency-Key outbox-<id>-<attempt>`; from the business name with `reply_to` = owner; invoice + pay links; footer = contact + anti-scam line (≤ 60 chars); `MAIL_TEST_MODE` → owner inbox; cap one message per customer per day; auto-send only heads_up + due_date (owner toggles); failed → retry in Follow-ups; `{error}` handled, serial flush | A | DONE | A seeded almost-due invoice produces a real email in the inbox — outbox + Resend (test mode, idempotency) — live send needs the verified domain |
| P4.4 | Today's follow-ups: every rung due today with the ready message (EN/HI by customer), one-tap wa.me / mailto / sms, Mark as sent, Snooze, Promise to pay (one open, ≤ today + 14 d) | B | DONE | wa.me opens WhatsApp with the text on a phone — follow-ups with one-tap WhatsApp/email/SMS, call script card |
| P4.5 | `/pay/:token` (no login): invoice, amount owed, Pay by UPI (QR + button, simulated), "I've already paid" (reference + date → `payments.source = claim`), "Something's wrong" (reason) → ladder paused → Inbox; DPDP notice in the customer's language; 404 / 410 token semantics | B | DONE | Dispute from the phone pauses the ladder within one tick — /pay page: UPI, already paid, problem, promise, s.37(2)(g) note |
| P4.6 | Inbox: accept (credit note → `invoice_adjusted` with `credit_note_no`, or mark paid), reject with reply, edit invoice; resolving resumes or stops the ladder; interest clock stops only on owner acceptance | B | DONE | Timeline shows the credit note entry — inbox: credit note, mark paid, reject, edit, §2(b) note |
| P4.7 | LLM tone drafting behind a flag with template fallback ("no LLM in the money path") | A | CUT | Flag off → templates; flag on → drafted text marked as AI-assisted — Templates only; no LLM anywhere in the product |
| P4.8 | n8n webhook POST on escalation events (fire-and-forget, 15 lines) | A | CUT | Event row appears in the n8n sheet — n8n cut |

## P5 — Forecast, documents, i18n (Sat 7 – 11 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P5.1 | `lib/forecast.js`: 13 weeks (opening, in = each unpaid invoice at due date + customer's average delay, or the promise date; out = expenses; closing), week-chaining by construction, first week below the buffer, what-ifs × 3 (customer pays 30 days later · big order · supplier payment delayed), **invoices that would cover the gap**, ageing buckets (due today = not_due), `reliability()` | A | DONE | Test: closing(n) = opening(n+1); totals agree with invoices + expenses — independent review + fixes, all tests green |
| P5.2 | Chase-these-first: score from amount, days overdue, reliability, cash-gap impact; reason sentence ("₹1,20,000, 38 days overdue, usually pays 20 days late, covers week 6"); dashboard top 5 | A | DONE | Top 5 ordering explainable from the reasons — chase-first ranked with reasons |
| P5.3 | Promise objects: pause rung, shift inflow, "promise at risk" near the date, broken promise auto-resumes at the next rung and restores the forecast | A | DONE | Demo toggle: promise → gap moves; break → ladder resumes — promise sheet states forecast effect; break resumes ladder |
| P5.4 | Forecast screen (recharts): weekly bars, buffer line, what-if switches, covering invoices list | B | DONE | Switching a what-if redraws within a second — forecast SVG chart, what-ifs, cover-gap |
| P5.5 | Demand letter print page: title "Payment Demand Letter"; the "not a GST / legal notice" line; invoice schedule with part payments and acceptance dates; 7-day deadline; bank + UPI QR; dispute contact; Udyam number; Udyam-gated MSMED paragraph with the per-period interest table (checkbox persisted, interest not demanded unless ticked); "please confirm receipt"; verify QR (`entry_hash`); conventions footnote (actual/365, monthly rests, rate switch on RBI date, 0 % in accepted disputes, interest-first; Gurpreet Singh; V.K. Patel) | B | DONE | Letter for INV/26-27/0042 prints with the pinned hash — demand letter with per-segment interest, GST-on-interest, footnotes |
| P5.6 | ODR bundle / evidence pack print page: parties + Udyam, invoice schedule, days-overdue computation, interest table, timeline with hash stamps, §12.1.4 (a)–(h) checklist, eligibility gates, "MSME ODR portal (formerly Samadhaan)" | B | DONE | Prints paginated on A4 — ODR evidence pack with §12.1.4 checklist and hedged gates |
| P5.7 | `/verify/[hash]` public page: `{found, intact, event:{type, invoice_number, ts, hash}, payee:{vpa, bank_last4}}`, no PII; QR on invoice, letter and bundle | A | DONE | Phone scan of the letter QR shows "intact" + payee details — /verify and /v short codes, payee as recorded |
| P5.8 | Documents screen: per-invoice timeline with hash stamps; "Download evidence pack" | B | DONE | Every invoice event visible with its hash — documents list with record links |
| P5.9 | Hindi pass over screens, templates, print pages using the RBI/CBIC terms (कर बीजक, भुगतान की तारीख, बकाया, अतिदेय, ब्याज, मांग पत्र); everyday बिल / बकाया on screens | B | DONE | Every string switches; no layout break at 360px — full Hindi: 1,423 keys at parity |
| P5.10 | Settings: business profile (name, address, state, GSTIN, registration type, turnover, Udyam yes/no + number, bank, UPI, logo URL with initials fallback), ladder offsets, buffer, per-rung auto-send toggles, language, text size, Demo date, Reset demo | B | DONE | Changing turnover above ₹5 cr shows the e-invoice banner — settings: profile, bank, ladder, auto-send, buffer, language, demo clock |

## P6 — Integration checkpoint (Sat 11 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P6.1 | Full ladder runs unattended on the deployed app: seeded almost-due invoice receives its real email with zero clicks; audit log shows the Workflow run id | A + B | DOING | Email in inbox; run id on the event — Built-in scheduler deployed (0777c9b); first unattended live run due Sat 24 Oct 10:00 IST; real email needs RESEND_API_KEY on Render (V) |
| P6.2 | Seed assertions: INV/26-27/0042 at `demand_letter` with the pinned `letter_generated` hash; one deterministic tick at T0 ⇒ exactly 3 queued sends | A | DONE | `npm run db:seed && npm test` green — seed assertions in tests |
| P6.3 | `/api/reseed` (secret header, 202 then work, `DISABLE / ENABLE TRIGGER USER`); cron-job.org: nightly reseed 01:00 IST, keep-alive every 10 min, tick fallback 10:05 IST | A | DONE | Three jobs enabled; reseed restores the pinned hash — wave 2 agent building — /api/reseed + nightly reset after 01:00 IST in lib/scheduler.js |
| P6.4 | Demo clock: `/api/demo/advance` and `/reset` (DEMO_MODE + cookie) calling the tick synchronously; "demo clock: 1 day = 5 s" label | A | DONE | Advancing 30 days drafts the letter on screen — demo clock advance/jump/reset |
| P6.5 | Red-trigger review: any slot > 1 h over → apply the cut list in order | all | DONE | Decision logged — No slot over; ahead of plan; nothing cut from the never-cut list |

## P7 — Acceptance & polish (Sun 9 AM – 12 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P7.1 | Pack BEFORE-YOU-FINISH list (A1–A9 below) all green on the **deployed** app | A + B | DONE | Each ticked with the deployed URL — /proof on the deployed app: 34/34 live; tests/proof.test.js |
| P7.2 | Build-2 18-item sweep (A11) | B | DONE | Done / partly / missing for each, all "done" — docs/pack-conformance.md (Build 2 list item by item) |
| P7.3 | Trust behaviours: tampered row breaks `/verify`; opted-out contact never emailed unattended; anonymize keeps totals; expired token fails friendly | A | DONE | A15 green — chain tests (tamper breaks verify), tick test (opted-out never emailed), anonymize test, expired-token view |
| P7.4 | Privacy card in Settings: data map, retention 72 months (FY26-27 → 31-12-2033), opt-outs in force, anonymize action, `notice_shown` log, DPDP dates + "designed to DPDP principles" wording | B | DONE | Card renders in EN and HI — privacy card on lawful-debt basis |
| P7.5 | Empty / loading / error states on every screen; error contract everywhere | B | DONE | Fresh DB shows designed empty states — ErrorState on every page, error boundary for all owner screens, global-error, bilingual 404, empty states |
| P7.6 | 360px and largest-text-size pass; wide tables → stacked cards; Hindi word wrap; A4 print pages still correct | B | DONE | No horizontal scroll on any screen — scripts/acceptance.js: every screen EN/HI at 360 px normal + largest text and 1280 px, 162/162 (docs/acceptance.md) |
| P7.7 | Accessibility: labels on every control and icon, visible focus, AA contrast, icon + word on every status; axe clean on dashboard, invoice, follow-ups | B | TODO | axe reports 0 serious issues |
| P7.8 | No console errors on any screen; Lighthouse accessibility ≥ 90 | B | DOING | Screenshots in `docs/` — No console errors: acceptance sweep + click-every-button test (~300 clicks, 0 problems locally); Lighthouse not run yet |
| P7.9 | README (pack-mirrored): problem in two lines; one line per screen; GST logic + document types; ladder + why the letter is not a legal notice; matching, forecast and chase score explained; improvement over manual chasing; run instructions; what is simulated; next steps; the five WhatsApp templates; "where the pack's files live" table; judge's 2-minute tour; path to production; declared pre-event planning | A | DONE | A stranger can run it locally from the README — README mirrors the pack; judge documents table; screenshots |

## P8 — Layer-3 gate (Sun 10 AM; only if P1–P7 are green on the deployed app)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P8.1 | LLM tone drafting switched on (if P4.7 landed) | A | CUT | Marked "AI-assisted" in the UI — No LLM (P4.7 cut) |
| P8.2 | Invoice-from-photo OCR | — | CUT | Roadmap slide only |
| P8.3 | Marathi | — | CUT | Roadmap slide only |
| P8.4 | Per-customer preferred language in templates and pay page | B | DONE | Only if time; field already exists (P2.1) — customers.preferred_lang drives templates, call script and pay page |

## P9 — Freeze & media (Sun 12 – 5 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P9.1 | **FREEZE** at 12:00 (autoDeploy off); demo-clock rehearsal twice | all | TODO | Rehearsal timed ≤ 2:50 |
| P9.2 | Video ≤ 3 min with captions; every beat baked in: dashboard + shortfall week, one-tap WhatsApp, dispute pause, bank import with TDS, GST side by side, autonomous run + real email, interest letter, ODR bundle + QR verify, promise break, demo date forward | B | TODO | Uploaded; link opens in incognito |
| P9.3 | Deck (10 slides): problem + impact numbers (₹8.1 L cr, ODR 17 cases), handout vs ours, novelty levers with "we found none that…", architecture (cron → Workflow → tick), trust by design, demo stills, prior-art name-check (Vasuli, FundRaksha, PayUpPal), path to production, non-goals, team | A | TODO | PDF exported; link opens in incognito |
| P9.4 | README final; `NOTICE` (gst-states MIT, Solana trigger MIT, JCS vectors Apache-2.0, burnrate synonyms if used, Free-GST share if copied); `docs/` with the planning files | A | TODO | Repo tidy on GitHub |
| P9.5 | Live-demo and async-judging risk list in the deck appendix | A | DONE | Slide present — docs/demo-script.md risk table (copy into the deck appendix) |

## P10 — Submit (Sun 5 – 8:30 PM)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| P10.1 | Repo tidy: no secrets, `.env.example` complete, CI green | A | DOING | `git log` clean; secret scan passes — CI green on every commit; tests/gates.test.js (no secrets, persona, console.log, conflict markers); .env.example updated |
| P10.2 | Live URL smoke on 4G and a second device; `/pay/:token` after refresh; `/verify` QR scanned from a phone | B | TODO | All pass on the deployed URL |
| P10.3 | All four links opened in incognito (GitHub, live URL, video, deck) | both | TODO | Screenshots |
| P10.4 | Submit via the dashboard by 8:30 PM IST ("Submitting is final") | V | TODO | Confirmation screen |
| P10.5 | Confirmation screenshot saved; team message | V | TODO | Done |

---

## W — Win additions (from `15_win_research.md`; Tier A non-negotiable, B fits the lead, C only if the Sun 10 AM gate is green)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| K1 | [Tier A] Public landing at `/` with one-click demo entry when `DEMO_MODE=1` | C | DONE | slot P1.2 change + new P2 row (A: route, B: page); 45 min; Presentation — public landing + one-click demo |
| K2 | [Tier A] Seed realism | C | DONE | slot P1.9 + P6.2; 40 min; Technical Execution — pinned 0042 chain + clock moves with real calendar from reseed |
| K3 | [Tier A] Shared-demo banner "Shared demo · demo date · last reset N min ago · Reset" with a 10-minute guard; demo-clock buttons +1 d / +7 d / To next rung; "demo clock" badge in t | C | DONE | slot P6.4; 30 min; Design & UX — shared-demo banner |
| K4 | [Tier A] Public `/status` (no PII) | C | DONE | slot P3.3 (after the tick goes live); 45 min; Technical Execution — public /status + /runs |
| K5 | [Tier B] "Email me the real reminder" on the landing page | C | TODO | slot P4.3; 40 min; Presentation |
| K6 | [Tier A] "Pay by UPI (simulated)" on `/pay` posts a synthetic credit (`UPI/<ref>/<invoice no>/<vpa>`) into the real import path, where it appears as a suggested match with confide | C | DONE | slot P4.2 + P4.5; 40 min; Technical Execution — sample statement + simulated UPI |
| K7 | [Tier A] A confirmed TDS shortfall becomes a non-cash allocation | C | DONE | slot P4.1/P4.2 (schema change now, in P2); 30 min; Technical Execution — TDS recorded as non-cash |
| K8 | [Tier A] Dashboard tile "Interest due to you under MSMED Act §16 — ₹X (and counting)" with the tooltip in §6; hidden unless the business is micro or small | C | DONE | slot P2.5 (sum via `lib/interest.js`); 20 min; Innovation — interest tile |
| K9 | [Tier A] Interest completeness strip under the letter's interest table | C | DONE | slot P5.5; 20 min; Innovation — interest strip on letter |
| K10 | [Tier B] GST on interest | C | DONE | slot P3.2 (function + tests) + P5.5 (line); 30 min; Technical Execution — GST on interest |
| K11 | [Tier B] Udyam class + `udyam_registered_on` (config already has `udyam_class | C | DONE | slot P5.6 + P5.10; 20 min; Impact — hedged ODR gates |
| K12 | [Tier B] §2(b) objection-aware disputes | C | DONE | slot P4.6; 25 min; Innovation — §2(b) inbox note |
| K13 | [Tier B] `npm run check:pack` | C | DONE | slot P7.1; 45 min; Technical Execution — /proof (live) + scripts/acceptance.js + tests/proof.test.js |
| K16 | [Tier B] The promise sheet states its forecast effect before confirming | C | DONE | slot P4.4 + P5.3; 20 min; Innovation — promise effect sentence |
| K17 | [Tier C] New invoice | C | DONE | slot P3.4; 20 min; Design & UX — sample line + GST flip |
| K21 | [Tier C] Lakh sublabel under the hero amounts ("≈ 11.8 lakh" / "≈ 11.8 लाख") | C | DONE | slot P2.5; 10 min; Design & UX — lakh sub-label |
| K25 | [Tier C] Invoice header badge "Agreed 30 days · legal maximum 45 (MSMED Act §15)"; with no written terms | C | DONE | slot P2.6; 10 min; Impact — credit-days badge |
| K26 | [Tier B] +15 rung "Call the customer" card | C | DONE | slot P4.4; 20 min; Design & UX — call script card |
| K27 | [Tier C] Header chip "Demo" with tooltip "Simulated | C | DONE | slot P1.7 shell; 10 min; Impact — Demo chip |
| K28 | [Tier C] "Download e-invoice JSON (NIC schema)" on the invoice print toolbar; tooltip "Ready for an IRP above ₹5 crore; no IRN is generated here." | C | DONE | slot P3.5; 10 min; Technical Execution — e-invoice JSON download |
| K29 | [Tier A] `scripts/gates.sh` in CI and before submit | C | DONE | slot New P2 row; P10.1; 25 min; Technical Execution — tests/wording.test.js (banned phrases EN+HI) + tests/gates.test.js (persona, TODO/markers, console.log, secrets) |
| K31 | [Tier B] Security headers in `next.config.mjs` | C | DONE | slot P2; 15 min; Technical Execution — next.config.mjs: HSTS, nosniff, Referrer-Policy, Permissions-Policy, CSP object-src/base-uri/form-action, noindex on /pay /print /api, poweredByHeader off; frame-ancestors left open (organiser iframe question) |
| K32 | [Tier B] `app/(owner)/error.js` (Try again `retry ?? reset`, "Reference | C | DONE | slot P7.5 (or with the first screens); 30 min; Design & UX — app/(owner)/error.js, app/global-error.js, app/not-found.js (EN/HI) |
| K33 | [Tier C] `lib/log.js` JSON lines with `req_id` (Render `rndr-id`) and a PII denylist that throws in tests | C | CUT | slot P2; 20 min; Technical Execution — Tier C |
| K34 | [Tier C] Three double-submit tests | C | DONE | slot P7.1; 25 min; Technical Execution — 10 concurrent sends → consecutive numbers; one open claim per invoice; 20 simultaneous confirms → exactly one (scripts/load.js) |
| K35 | [Tier A] Platform hardening before P1.11 | C | DONE | slot P1.11; 40 min; Technical Execution — wave 2 agent building — TZ, Node 22 pin, next/font self-hosting, start-time bootstrap, npm ci --include=dev |
| K36 | [Tier B] Accessibility beyond the pack | C | TODO | slot P7.7; 30 min; Design & UX |
| K37 | [Tier C] `/pay` collapsed note "Why pay by this date?" citing s.37(2)(g), date-branched, shown only for a micro/small supplier and a buyer with a GSTIN, ending "General informatio | C | DONE | slot P4.5; 20 min; Impact — s.37(2)(g) note |
| K38 | [Tier B] Privacy card and `/pay` notice basis | C | DONE | slot P7.4 + P4.5; 5 min; Impact — lawful-debt wording |
| K39 | [Tier B] Letter footnote completeness | C | DONE | slot P5.5; 10 min; Technical Execution — conventionFootnote test (day count, rests, rate switch, dispute, appropriation) |
| K40 | [Tier media] Video | C | TODO | slot P9.2; in P9 min; Presentation |
| K41 | [Tier media] Deck | C | TODO | slot P9.3; in P9 min; Innovation / Presentation |
| K42 | [Tier media] README top fold (one-liner, badges, four links, 15 s GIF, "Try it in 2 minutes" with expected outcomes, real vs simulated box), "Built during the event" timeline with the | C | TODO | slot P7.9 / P9.4; 40 + 20 min; Presentation |
| K43 | [Tier media] One 1280×640 hero image for the YouTube thumbnail, GitHub social preview and slide 1 | C | TODO | slot P9.3; 15 min; Presentation |
| K44 | [Tier media] Backups and repo polish | C | TODO | slot P9.4 / P10.1; 20 min; Presentation |
| K45 | [Tier C] Lighthouse (median of 3) + axe reports for dashboard, `/pay`, `/verify` saved in `docs/`, with dated scores in the README | C | TODO | slot P7.8; 15 min; Design & UX |
| K14 | [in slot] Hash-stamp sheet + "Record unaltered · n records" strip on the timeline: tap `# 3f9a…c21e` → full hash, "links to # …1a2b (the entry above)", QR of the verify URL, "Open  | C | DONE | slot P2.6 / P5.8; 45 (inside Timeline v1, Sat 2–7 PM) min; Design & UX — hash stamps on timeline |
| K15 | [in slot] Future rungs as hollow milestones with "Next: Final reminder on Sat 31 Oct (in 3 days) — sent by you, one tap"; paused spans as a hatched band with the self-resume senten | C | DONE | slot P2.6 / P4.4; 20 min; Design & UX — future rungs + next line |
| K18 | [in slot] `Term` component: plain label + ⓘ → Popover, never a hover Tooltip | C | DONE | slot P1.7 kit / P2; 30 (kit) min; Design & UX — Term popover |
| K19 | [in slot] `StatusChip` icon + word map (§7) and the help button whose glossary is generated from the label/hint pairs | C | DONE | slot P1.7 kit; 30 (kit) min; Design & UX — StatusChip icon+word |
| K20 | [in slot] `[lang=hi]` rules (line-height 1.8, no uppercase or letter-spacing), `min-height` never `height`, 2×2 button grids below `sm`, rem-only layout with three text sizes | C | DONE | slot P1.7 / P7.6; 25 min; Design & UX — Devanagari rules |
| K22 | [in slot (saves time)] Chase-first, Documents, Customers detail and the dashboard top-5 as filtered views of one `InvoiceRow` + `Timeline` | C | DONE | slot P2.6, P3.6, P5.2, P5.8; −45 net min; Technical Execution — InvoiceRow reused |
| K23 | [in slot (replaces Invoify)] Own A4 Tax Invoice component (~150 lines) with Invoify as a visual reference only | C | DONE | slot P3.5; 0 net (replaces the Invoify lift) min; Technical Execution — own A4 invoice |
| K24 | [in slot] Print: `@page` page numbers (Chrome 131+), "Record #hash · verify URL" footer + 20 mm verify QR, UPI QR ≥ 30 mm, Discount column hidden when all zero; short verify route  | C | DONE | slot P5.5–P5.7; 30 min; Technical Execution — print footer + verify QR + /v |
| K30 | [in slot (do first)] `lib/http.js` `route()` wrapper (AppError, frozen code table, `no-store`, `x-request-id`, 413 above 1 MB) + `lib/validate.js` (~60 lines, no dependency) + param regexes b | C | DONE | slot P2.1 first task; 45 (inside P2.1–P2.2) min; Technical Execution — route wrapper + validators |

## N — New features chosen by the team (Sat 24 Oct)

| ID | Item | Owner | Status | Done when |
|---|---|---|---|---|
| N1 | Diwali settlement drive + festival quiet days (no reminders 6–10 Nov; owner adds their own) | C | DONE | Live on main (e594744); tests/festival.test.js; daily run skips quiet days |
| N2 | Pay-early offer sized below the owner's borrowing cost; matched payment becomes a credit note | C | DONE | Live on main (6e41a9e); tests/earlyPay + offers; GST already charged unchanged |
| N3 | Payment habits + best day to remind; customer confirms the balance on `/pay` | C | DONE | Live on main (58a511c); tests/payDay; confirmation sealed into the record and the evidence pack |
| N4 | TReDS cash-today check on the forecast | C | DONE | Live on main (6d87a01); tests/treds; card says whether the money lands before the short week |
| N5 | Credit check on New invoice (grade, days late, % on time, already owed) | C | DOING | Built and tested on branch `feat/statement-search-setup`; live once its PR is merged to main |
| N6 | Public MSMED interest calculator `/calculator` (no login) | C | DOING | Same branch; ₹1,901.89 on ₹1,17,186 due 19 Sep, paid 24 Oct; in the acceptance sweep |
| N7 | Customer statement link `/s/…`: all open bills, one UPI QR, copy + WhatsApp share | C | DOING | Same branch; tests/statement.test.js; in the acceptance sweep |
| N8 | Search box in the header: customers, bills (also by amount), payments (UTR) | C | DOING | Same branch; tests/search.test.js; in the acceptance sweep |
| N9 | "Getting set up" checklist in Settings + on the dashboard until done | C | DOING | Same branch; tests/setup.test.js |
| N10 | Invoice from a photo (OCR) | C | TODO | Optional; needs an AI key and a team decision |

## Acceptance suite (ticked during P7; every item on the deployed app)

| ID | Test | Status |
|---|---|---|
| A1 | ₹10,000 @ 18 % same state → CGST ₹900 + SGST ₹900 = ₹11,800; other state → IGST ₹1,800 = ₹11,800 (our seed: Punjab → Punjab and Punjab → Haryana) | DONE (/proof, gst.test) |
| A2 | Invoice numbers consecutive within the FY and never repeat | DONE (/proof, services.test concurrent sends) |
| A3 | Every sample GSTIN passes the check digit; changing one character fails | DONE (/proof, gst.test, services.test) |
| A4 | Every demand letter is titled "Payment Demand Letter" and carries the "not a GST / legal notice" line | DONE (acceptance sweep word for word, /proof) |
| A5 | Ladder pauses for a dispute or a promise; never sends the same stage twice | DONE (ladder.test, tick.test, /proof) |
| A6 | Payment matching handles all six CSV cases; nothing marked paid without confirmation; re-import never double-counts | DONE (recon.test fixture, /proof; re-import 0 added) |
| A7 | Forecast: each week's closing = next week's opening; totals agree with invoices and expenses | DONE (forecast.test, /proof) |
| A8 | Every text switches EN/HI; everything works at 360px; nothing lost on reload | DONE (parity tests, acceptance sweep 162/162, PostgreSQL) |
| A9 | Every screen opens with no console errors | DONE (acceptance sweep + click test) |
| A10 | Interest: rate-change-mid-delay segments; partial payment mid-way; goldens within ± ₹5 | DONE (interest.test day-by-day oracle across the RBI change) |
| A11 | Build-2 list (18 items) all "done" | DONE (docs/pack-conformance.md) |
| A12 | Promise pauses + reflows; broken promise resumes at the next rung and restores the forecast | DONE (ladder/tick tests, forecast uses promise_date) |
| A13 | ODR bundle: every artefact for one invoice present, dated, paginated, printable | DONE (/print/bundle) |
| A14 | Unattended run: a real email with zero clicks; audit log shows the Workflow run id | DOING (scheduler live; first unattended run Sat 10:00 IST; email needs RESEND_API_KEY) |
| A15 | Tampered row breaks `/verify`; opted-out contact never emailed; anonymize keeps totals; expired token fails friendly | DONE (chain, tick, anonymize tests; expired link view) |
| A16 | Part payment keeps the stage and updates the amount; separator-tolerant invoice-number match; name normalisation | DONE (recon.test separators/names; part payment) |
| A17 | `/pay/:token` deep link works on the deployed URL after a refresh | DONE (server-rendered; live /pay deep link 200) |
| A18 | Due today = not_due; ageing buckets correct; TDS flagged at exactly 1 / 2 / 10 % of taxable value | DONE (aging test, TDS 1/2/10 % tests) |

## Cut list (ordered; trigger: any slot more than 1 h over)

n8n webhook → what-if #3 (big order) → Hindi depth (demo screens only) → forecast to static → invoice print polish (on-screen GST view always survives) → ODR bundle to a pre-rendered sample.
**Never cut:** ladder, interest engine, `/verify`, on-screen GST math, demand letter, bank matching.

## Decisions log

| Date | Decision |
|---|---|
| 22 Oct | Name locked: FullPay |
| 23 Oct | Rev F (research corrections) and Rev F.1 (pack conformance) approved; team says "time to build" |
| 23 Oct | Code starts now (11:15 AM IST), not at kickoff; the README declares the early start and the 21–23 Oct planning docs (build-fresh clause: pre-existing work must be declared) |
| 23 Oct | Render free plan (no card): daily run and nightly reset built into the server (lib/scheduler.js) instead of cron-job.org / Render Workflows |
| 23 Oct | Product upgrades after "feels basic": roles + maker-checker approvals, analytics, Tally/Vyapar import, scale test (20k invoices), guided tour, /proof |
| 23 Oct | Third-language add-on not built (user: "not needed"); photo-OCR add-on optional, pending an AI key |
| 23 Oct | Live bug fixed: demo sign-in/sign-out redirected to Render's internal host; language switch opened to every role |
| 24 Oct | Team picked seven feature ideas, built as N1–N9; N5–N9 go to main through a pull request instead of a direct push |