# FullPay against the organiser's prompt pack

Every item of the HackCache '26 problem-statement-4 prompt pack, with its status and where to check it.
**Done** = built and checked · **Done, differs** = built, with a stated reason for the difference · **Add-on** = optional pack add-on.

Evidence: `npm test` (281 tests), [`/proof`](https://fullpay-web.onrender.com/proof) (the "before you finish" checks run live,
34/34), [`docs/acceptance.md`](acceptance.md) (every screen × EN/HI × 360 px normal, 360 px largest text and 1280 px: 162/162).

## Build 1: our choices

| Pack | FullPay | Status |
|---|---|---|
| App name Baaki | FullPay ("Every -Pay app helps you pay. FullPay is for getting paid, in full.") | Done, differs (the pack says "change these") |
| Sharma Packaging, Pune; 12 customers; 30-day credit; owner Rakesh Sharma | Arora Auto Components, Ludhiana (Punjab, 03); 14 customers incl. one other-state and one unregistered; credit days per customer; owner Harpreet Arora | Done, differs (same shape, different made-up business) |
| Deepest part: which invoices to chase this week so cash doesn't run short | Chase these first + 13-week forecast + invoices that cover the gap + analytics | Done |

## Money rules

| Rule | Where | Status |
|---|---|---|
| Whole paise, never decimals | `lib/money.js`; pg type parsers return integers; `tests/money.test.js` | Done |
| `Intl.NumberFormat('en-IN')`, total in words the Indian way | `fmtINR`, `amountInWords` (EN + HI "मात्र"); `tests/money.test.js` "round-off, formatted total and words agree" | Done |
| IST dates, April–March financial year | `lib/time.js` (IST-explicit), `fyOf`; `tests/time.test.js` | Done |
| GST per line on taxable value, rounded to the paisa | `lib/gst.js lineTax`; `tests/gst.test.js` | Done |
| Same state CGST + SGST (each half, rounded separately); other state IGST; state = first two GSTIN digits | `isInterstate`, `stateFromGSTIN`; `/proof` GST rows | Done |
| Rates in config: 0, 5, 18, plus 3 and 40, with a "check cbic-gst.gov.in" note | `lib/config.js` `GST_RATES_BPS` (also 0.25 % and 1.5 %; 28 % withdrawn 1 Feb 2026) | Done, differs (two extra legal rates) |
| Grand total rounded to the rupee with a "Round off" line | `invoiceTotals`; print invoice; acceptance sweep checks "Round off" | Done |
| Regular → Tax Invoice; composition → Bill of Supply with the exact heading; unregistered → plain invoice | `docTypeFor`, `COMPOSITION_HEADING`; `tests/gst.test.js` "composition business" | Done |
| Tax Invoice fields: business name/address/GSTIN; number ≤ 16 chars, consecutive in the FY; date; customer name/address/GSTIN; place of supply with name + code; HSN (4 digits ≤ ₹5 cr, 6 above) or SAC, description, quantity, unit; taxable value, rates and amounts; total; reverse charge; delivery address if different; signature line | `app/print/invoice/[id]`; `validateHSN`/`hsnDigitsRequired`; acceptance sweep checks "Tax Invoice", "Place of supply", "reverse charge", "Authorised signatory", "GSTIN", "Rupees" | Done |
| GSTIN pattern + check digit; sample GSTINs made up and valid | `validateGSTIN`; `tests/gst.test.js`; `/proof` "every customer GSTIN passes… changing one character fails" | Done |
| e-invoicing note above ₹5 crore turnover | `einvoiceRequired` on New invoice and the invoice screen; IRN not generated (e-invoice JSON download offered) | Done |

## The demand letter

| Rule | Where | Status |
|---|---|---|
| Titled "Payment Demand Letter"; never "legal notice"; no emblem, seal or lawyer/GST/court wording | `app/print/letter/[id]`; `tests/wording.test.js` bans the phrases in every template and string (EN + HI); `/proof` "Title of every letter" | Done |
| The line near the top: "This letter is from … It is not a notice from the GST department and not a legal notice from a lawyer." | `letter.disclaimer`; acceptance sweep checks it word for word | Done |
| Lists each invoice's number, date, amount, part payments, still owed; deadline 7 days (config); bank details + UPI QR; dispute contact; firm, never threatening | Letter page; `cfg.letter.deadline_days`; `/proof` "Deadline to pay" | Done |
| Udyam micro/small: optional MSMED Act line; interest as a separate figure, compound with monthly rests at 3 × RBI bank rate (config, "check rbi.org.in"); added to the demand only if the owner ticks | `lib/interest.js` with a **dated** RBI Bank Rate series (5.75 % from 7 Oct 2026); tick box on the letter; `tests/interest.test.js` (day-by-day oracle across a rate change) | Done, differs (dated series instead of one number, so interest is right across RBI changes) |
| 45 days overdue: suggest call, consult a lawyer, MSME Samadhaan; never sends anything legal itself | The 45-day step: call, lawyer, and the **MSME ODR portal (formerly Samadhaan)** with an evidence pack; nothing legal is sent | Done, differs (Samadhaan was replaced by ODR for new filings on 15 Oct 2025; we name both) |

## How to build it

| Pack | FullPay | Status |
|---|---|---|
| React + Vite + Tailwind, plain JS, React Router; no backend; localStorage; Reset demo | Next.js 16 (React 19) + Tailwind 4, plain JS; **PostgreSQL** backend so the daily run, the customer link and the record are real; **Reset demo** restores the sample data | Done, differs (the brief sets no stack; a server is needed for real reminders) |
| Sample data files under `src/data` (business, 12 customers with 6 months of history, 40 invoices over 4 months covering every status incl. one disputed, expenses with salaries 1st / rent 5th / supplier bills / electricity / GST on the 20th, `bank-statement.csv` with the six cases, templates EN + HI, config) | `db/seed.js` (14 customers, 65 invoices simulated day by day from 1 Apr), `db/bank-statement.csv`, `lib/templates.js`, `lib/config.js`; mapping table in the README | Done, differs (more data; same cases) |
| All interface text in `src/i18n/en.js` and `hi.js` | `lib/i18n/en.json` + `hi.json`, ~1,770 keys at parity; `tests/templates.test.js` checks parity, placeholders and Devanagari | Done |
| Print-ready A4 pages, browser "Save as PDF", no PDF library | `/print/invoice`, `/print/letter`, `/print/bundle` | Done |
| Charts in plain SVG or one small library | Plain SVG/CSS bars (forecast, analytics); no chart library | Done |
| Only made-up businesses, GSTINs, phones, bank details | Seed only; GSTINs minted with valid check digits | Done |

## Screens (Build 1) and the Build 2 checklist

| # | Screen | Built | Evidence |
|---|---|---|---|
| 1 | Dashboard: to collect, overdue, expected this week/month, bills next 30 days, cash in bank, lowest forecast point; ageing bar (not due, 1–30, 31–60, 61–90, 90+); top 5 to chase | Done (+ "interest the law owes you") | `/dashboard`; `tests/forecast.test.js` |
| 2 | Invoices: filters (customer, status, due date, days overdue), search, seven statuses, timeline | Done (+ 100 per page, Tally/Vyapar/Excel import) | `/invoices`, `/invoices/[id]` |
| 3 | New invoice: pick or add a customer, GSTIN validated, state from it; items with HSN/SAC, qty, unit, rate, discount, GST rate; live totals; due date from credit days; print preview; UPI QR `upi://pay?pa=…&pn=…&am=…&tn=…&cu=INR`; save as draft or send | Done | `/invoices/new`; `tests/upi.test.js` |
| 4 | Customers: credit days, contacts, total owed, average days late, % on time, A/B/C grade with the reason in words | Done | `/customers`, `/customers/[id]` |
| 5 | Today's follow-ups: ready messages; one tap WhatsApp (wa.me), email (mailto), SMS (sms:); Mark as sent; Snooze; "promised to pay on [date]" pauses | Done (+ call script in the customer's language at +15) | `/followups` |
| 6 | Escalation ladder −3 / 0 / +7 / +15 / +30 / +45, editable in Settings, defaults in config; pauses for dispute or promise | Done | `tests/ladder.test.js`, `tests/tick.test.js`; `/proof` ladder rows |
| 7 | Customer link `/pay/:token`, no login: invoice, amount, Pay by UPI (simulated), "I've already paid" with ref + date, "Something's wrong" with a reason → pause + Inbox | Done | `/pay/whoZYlu9YOc2d-scWQ-yx1mX1ukgynkn` |
| 8 | Inbox: accept (credit note, or mark paid), reject with a reply, edit the invoice; resolving resumes or stops the ladder | Done | `/inbox`; `tests/services.test.js` |
| 9 | Payments: import CSV or add by hand; match by invoice number, amount and name with confidence + reason; flags part / several / over / unmatched / TDS 1 %, 2 %, 10 % of taxable value; confirm each; nothing paid without confirmation | Done (+ "confirm all exact matches", maker-checker for accountants) | `tests/recon.test.js` (six cases); `/proof` matching rows + confirmation gate |
| 10 | Cash forecast: 13 weeks, opening / in (due date + customer's average delay) / out (expenses) / closing; first week below the buffer; what-ifs (customer 30 days later, big order, supplier delayed); invoices that cover the gap | Done | `/forecast`; `tests/forecast.test.js`; `/proof` forecast rows |
| 11 | Chase these first: score from amount, days overdue, reliability, cash-gap help, with the reason in words | Done | `/chase-first` |
| 12 | Documents: one timeline per invoice; "Download evidence pack" → print-ready page | Done (+ tamper-evident record, public `/verify`) | `/documents`, `/print/bundle/[id]` |
| 13 | Settings: business profile (name, address, state, GSTIN, registration type, turnover, Udyam, bank, UPI, logo), ladder, buffer, language, text size, Demo date, Reset demo | Done | `/settings` |

## Design rules

| Rule | Evidence | Status |
|---|---|---|
| Works at 360 px and on a laptop | Acceptance sweep: every screen at 360 px (normal and largest text) and 1280 px, no sideways scroll | Done |
| Plain words, accounting term in a tooltip | `Term` component, `{label, hint}` i18n entries ("Money to collect" → receivables) | Done |
| Body ≥ 16 px, buttons ≥ 48 px, AA contrast, visible focus, labels on icons and fields, status never colour alone | Tokens in `app/globals.css`; sweep fails on any target under 44 px; `StatusChip` always has a word | Done |
| Switching language changes every piece of interface text and the templates | Parity tests; sweep fails on English left on a Hindi screen (data such as names, addresses and bank narrations excepted, marked `translate="no"`) | Done |

## "Before you finish, check"

| Check | Evidence |
|---|---|
| Every screen opens and works, no console errors | Acceptance sweep: 162/162, no console errors, no error screens |
| ₹10,000 @ 18 % to the same state: CGST ₹900 + SGST ₹900 = ₹11,800; other state IGST ₹1,800 = ₹11,800 | `tests/gst.test.js`; `/proof` (our business is in Punjab, so "same state" is Punjab and "other state" Haryana) |
| Invoice numbers consecutive within the FY, never repeat | `tests/services.test.js` "10 concurrent sends get consecutive numbers with no gaps"; `/proof` numbering rows |
| Every sample GSTIN passes; changing one character fails | `tests/gst.test.js`, `tests/services.test.js`; `/proof` |
| Every demand letter titled "Payment Demand Letter" with the "what it is not" line | Acceptance sweep (word for word); `/proof` |
| Ladder pauses for a dispute or promise; never sends a stage twice | `tests/ladder.test.js`, `tests/tick.test.js`; `/proof` |
| Matching handles all six cases; nothing paid without confirmation | `tests/recon.test.js`; `/proof` |
| Forecast: closing = next opening; totals agree with invoices and expenses | `tests/forecast.test.js`; `/proof` |
| Every text switches EN ↔ HI; everything works at 360 px; nothing lost on reload | Parity tests, acceptance sweep, PostgreSQL |

## Add-on: send reminders for real

| Requirement | FullPay | Status |
|---|---|---|
| Small server with a daily job at 10:00 IST sending that day's reminders | Built-in scheduler (`lib/scheduler.js`, started in `instrumentation.js`): runs at/after 10:00 IST, catches up if the server was asleep; `/api/tick` also accepts cron-job.org or Render cron | Done |
| Email via Resend; key in env, listed in `.env.example`; business name, reply-to owner, invoice + pay links | `lib/mail.js`, `.env.example` | Done |
| WhatsApp stays one-tap wa.me; README explains the Business Platform and lists five templates | README "The five WhatsApp Business templates we would submit" | Done |
| Auto-send only stages switched on (default heads-up + due date); demand letters never automatic | Settings per-stage toggles; `NO_MESSAGE` rungs in `lib/services/tick.js` | Done |
| Never twice, never for disputed/paused, max one message per customer per day, end with who to contact | `tests/tick.test.js`; template footer test | Done |
| Log every send; failed ones in Today's follow-ups to retry | Outbox log, `/runs`, failed section with Retry | Done |
| Test mode: everything to the owner's own email | `MAIL_TEST_MODE=1` | Done |

## Other add-ons and Submit

| Item | Status |
|---|---|
| Add-on: invoices from a photo (AI reads it, owner reviews, GST recalculated, GSTIN checked) | In progress (see the build log) |
| Add-on: another language (third language, customer's preferred language, own-script picker) | Not built: optional, team decision (English and Hindi cover every screen, message and print heading; each customer already has a preferred language) |
| Submit 1: README with the pack's headings | Done (`README.md`) |
| Submit 2: deploy steps, incl. the refresh-404 setting | Done: Render instead of Vercel/Netlify; server-rendered routes, so no SPA rewrite is needed (`docs/deploy.md`) |
| Submit 3: 3-minute demo script with one problem sentence per part | `docs/demo-script.md` |
| Submit 4: what could go wrong in a live demo, and how we avoid it | `docs/demo-script.md` |

## Debug prompts

Each one asks for a table of expected against actual; the matching table is already a test or a `/proof` section:
GST cases → `tests/gst.test.js` + `/proof` GST · reminders on the wrong day → `tests/ladder.test.js` "one invoice moves through every rung on the right day" + `/proof` ladder · payments matched wrongly → `tests/recon.test.js` (separators, loose names, oldest first, TDS, re-import) + `/proof` matching · broken on a phone → acceptance sweep · blank screen → per-route `error.js` + global error page · deploy → `docs/deploy.md`.
