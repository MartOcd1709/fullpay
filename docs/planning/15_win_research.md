# 15 — Win research: what we add, what we skip, and why

**Written:** Fri 23 Oct 2026, early afternoon IST · **Inputs:** the seven lens reports in `fullpay/docs/planning/research/` (competitor, judge, premortem, domain, ux, demo, quality; 106 candidate additions in total), `10_build_plan.md` (through Rev F.1), `14_build_checklist.md`, `13_reference_library.md` Parts C and G, and the repo as it stands (8 commits, 227 tests passing, engines done, no API routes or screens yet).
**Method:** each candidate was scored on three lenses: **delivery** (fits in 45 min or replaces work of equal cost), **judge impact** (visibly moves a criterion and is not already covered) and **demo visibility** (seen in the video or in a 2-minute click-through, or removes a real risk). A candidate was kept only if at least two lenses said keep. Duplicates across lenses were merged into one item. Every legal claim in a kept item, and every headline finding in the domain lens, was checked against a primary source where one could be reached (§6).

---

## 1. Executive summary

**Must-adds, ranked:**
1. A public landing page with one-click demo entry (K1). Today `/` redirects to a password box, so a judge cannot get in.
2. Demo data that renews every day (K2, K3): every rung present at T0 = reseed date, a deterministic pay token, run-scoped idempotency keys, and a banner showing the shared state with a guarded Reset button.
3. Autonomy proof a judge can see (K4): a public `/status` page and a Runs panel carrying the Workflow run id, plus `/api/health` returning the deployed commit SHA.
4. The simulated UPI payment runs through the real matcher, with a "Load sample statement" button (K6). A confirmed TDS shortfall becomes a non-cash allocation (K7).
5. The interest lever shows on screen (K8, K9, K10): a dashboard tile "Interest the law owes you", a strip giving the source of each segment, and the GST-on-interest line.
6. Platform hardening before the first deploy (K35): local fonts, the cron calling Node `fetch` instead of curl, TZ, Node pinned, `preDeployCommand`, exact pins.

**Do not add:** debit notes, GSTR-1 export, statement of account, TDS tracker, payment receipt, AI calls, per-visitor demo worlds, Razorpay, dark mode, Playwright in CI, a PWA manifest, or a separate `judges.md`.

**Three biggest risks:**
- (a) Asynchronous judges either cannot get in or land on a demo state another judge has disturbed.
- (b) The autonomy claim cannot be checked: Resend domain DNS, and a Sunday 10:00 IST run that may have nothing to send.
- (c) Tagada uses the same headline words ("ODR", "rate in force each day"), which dilutes our Innovation score unless our claims name what its code lacks.

Net new work if everything kept is built: about 12 h across two developers plus Claude. Tier A (about 5 h) is non-negotiable, Tier B (about 4.5 h) fits the 8-hour lead, and Tier C (about 2.5 h) runs only if the Sun 10 AM gate is green (§2).

---

## 2. Kept additions

Tiers: **A** = never cut (judge-proofing and risk removal) · **B** = fund from the 8-hour lead · **C** = only if the Sun 10 AM gate is green. "Slot" names the checklist row the item joins. Minutes are net new (items that are a different way of doing planned work are marked "in slot").

| ID | Tier | Title (merged sources) | Criterion | Min | Demo-visible | Joins | Why (one line) | Fact-check |
|---|---|---|---|---|---|---|---|---|
| K1 | A | Public landing at `/` with one-click demo entry when `DEMO_MODE=1`: H1 positioning line, buttons "Open the owner's app (demo, no password)" · "See what a customer sees" · "Verify a demand letter" · "Live status"; `/api/demo/login` sets the same signed cookie (judge P1; supersedes demo A5) | Presentation | 45 | Yes, second 1 | P1.2 change + new P2 row (A: route, B: page) | A password box at the live URL means Technical Execution and Design & UX get scored from the video alone | n/a |
| K2 | A | Seed realism: one invoice at every rung at T0 (−3, 0, +7, +15, INV/26-27/0042 at demand_letter, +45) plus one disputed and one promised; T0 = reseed date; 0042's pinned events written first so its hash ignores T0; deterministic pay token for the demo invoice (HMAC of SEED_SECRET); Resend key `outbox-<id>-<attempt>-<run_id>` (judge D3, demo A6/A7) | Technical Execution | 40 | Yes (every artefact exists without touching the clock) | P1.9 + P6.2 | Six judges share one DB, and the Sunday 10:00 run must find exactly 3 sends; README and video links must survive the nightly reseed | n/a |
| K3 | A | Shared-demo banner "Shared demo · demo date · last reset N min ago · Reset" with a 10-minute guard; demo-clock buttons +1 d / +7 d / To next rung; "demo clock" badge in the header whenever the clock is moved (competitor 3, demo A10, ux DemoClockBar) | Design & UX | 30 | Yes | P6.4 | Removes the "is this broken?" moment when judge 3 lands in judge 2's advanced world | n/a |
| K4 | A | Public `/status` (no PII): last autonomous run in IST (UTC in brackets), Workflow run id, sent / failed / awaiting, chain length + head + "verified intact", build SHA, DB ok; the same `RunsTable` on Follow-ups; `/api/health` → `{status, version: RENDER_GIT_COMMIT[0:7], node, time}` with no DB call (judge P2, demo A8, quality health) | Technical Execution | 45 | Yes (3 s in video, click-through) | P3.3 (after the tick goes live) | The one way an async judge can check "it ran at 10:00 without us" days later | n/a |
| K5 | B | "Email me the real reminder" on the landing page: sends `payment_due_today` for the seeded invoice through the normal outbox; caps 2 per address per day, 30 per day in total, env kill-switch, address kept as a hash only (competitor 2, judge P3) | Presentation | 40 | Yes, judge's own inbox | P4.3 | The only first-hand proof of real sends any team can give; needs P0.4 Verified, so skip the item if DNS is not green by Sat 2 PM | Resend free tier 100/day, `resend.dev` owner-only — from the lens reports, not re-fetched |
| K6 | A | "Pay by UPI (simulated)" on `/pay` posts a synthetic credit (`UPI/<ref>/<invoice no>/<vpa>`) into the real import path, where it appears as a suggested match with confidence and reason, then confirm → paid → ladder stops → forecast moves; second button "Simulate a 2 % TDS-short payment"; DEMO_MODE "Load sample statement" button on Payments (competitor 4, demo A11) | Technical Execution | 40 | Yes | P4.2 + P4.5 | Gives us the fintech team's "pay → auto-paid" moment inside the brief's rules, and makes bank matching reachable without a downloaded CSV | n/a (labelled "Simulated — this prototype moves no money") |
| K7 | A | A confirmed TDS shortfall becomes a non-cash allocation: `payment_allocations.kind TEXT NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash','tds'))`, which reduces outstanding and the interest base from that date; event `tds_recorded`; test: 2 % TDS confirm → status paid, zero outbox rows (domain) | Technical Execution | 30 | Yes (TDS beat) | P4.1/P4.2 (schema change now, in P2) | Otherwise the ladder chases ₹2,000 the Income-tax Department already holds and charges interest on it | Label s.393(1) Sl. 6(i) etc. verified in library; s.393(1) present in the Act text (§6) |
| K8 | A | Dashboard tile "Interest due to you under MSMED Act §16 — ₹X (and counting)" with the tooltip in §6; hidden unless the business is micro or small (judge I1) | Innovation | 20 | Yes, first frame | P2.5 (sum via `lib/interest.js`) | Puts the novelty lever in frame 1; no dashboard we found shows a statutory-interest total | TRUE: 17.25 % (prid 63742), compound monthly rests (s.16), micro/small only (s.2(n)) |
| K9 | A | Interest completeness strip under the letter's interest table: each segment's Bank Rate with RBI press-release id and date; "0 % from … to … — dispute accepted by owner"; "Part payment ₹… on … applied to interest first (Gurpreet Singh, SC 2006)" (competitor 5) | Innovation | 20 | Yes, letter beat | P5.5 | The three things Tagada's two-row engine cannot print, on the screen where both teams say "rate in force each day" | TRUE (library-verified RBI series and Gurpreet Singh) |
| K10 | B | GST on interest: pure `gstOnInterest(interest_paise, invoice)` (rate buckets by taxable value, CGST+SGST or IGST by the original place of supply, integer paise per bucket); letter line "payable when the interest is received"; footnote; omitted for composition and unregistered suppliers; three goldens (900+900; IGST 1,800; mixed ₹1,280) (domain a) | Technical Execution | 30 | Yes, letter beat | P3.2 (function + tests) + P5.5 (line) | A finance judge checking "accuracy of financial calculations" looks for exactly this; free calculators and PayUpPal ignore it | TRUE: CGST s.15(2)(d), s.12(6), s.13(6), s.34(3); Circular 178/10/2022-GST para 9 |
| K11 | B | Udyam class + `udyam_registered_on` (config already has `udyam_class: 'small'`); letter prints "Udyam Regn. No. … · Small · registered DD-MM-YYYY"; s.16 paragraph renders only for micro/small; ODR card shows each gate as icon + word with the hedge wording from §6 (domain c6, d2, d3) | Impact | 20 | Yes, ODR card | P5.6 + P5.10 | Turns "Udyam: yes" into evidence and stops the card from over-claiming eligibility | TRUE with hedge: s.2(n); ODR Guidelines §7; Silpi + NBCC referral (secondary); traders OM 02-07-2021 |
| K12 | B | §2(b) objection-aware disputes: a `/pay` dispute raised within 15 days of delivery is labelled a written objection; on resolve, `acceptance_date` = resolution date, so the §15 due date and §16 start follow; 1 test + 1 event (domain d3-iv, judge I3) | Innovation | 25 | Yes, Inbox | P4.6 | A statute detail we found no tool implementing; the Inbox card states it in one sentence | TRUE: MSMED s.2(b) Explanation (i)(b) verbatim; treating a `/pay` dispute as the written objection is our reading — say "may move" |
| K13 | B | `npm run check:pack`: test names are the pack's ten BEFORE-YOU-FINISH sentences, wrapping existing tests; public `/proof` page runs the pure-function vectors server-side (GST cases, GSTIN mutation, interest goldens, recon six cases on the sample CSV, forecast chaining) with expected / actual / pass and a timestamp; README acceptance table A1–A18 with test path + URL (competitor 1, judge T1, demo A17) | Technical Execution | 45 | Yes (5 s in video) | P7.1 | Judges hold that checklist; Tagada already ships "Every rupee, checked"; without this our 227 tests are invisible | n/a |
| K14 | in slot | Hash-stamp sheet + "Record unaltered · n records" strip on the timeline: tap `# 3f9a…c21e` → full hash, "links to # …1a2b (the entry above)", QR of the verify URL, "Open verify page"; amber on a network error, red only when the API says intact:false (ux §3) | Design & UX | 45 (inside Timeline v1, Sat 2–7 PM) | Yes, hero screen | P2.6 / P5.8 | The named Design & UX signature; makes the chain legible to a non-technical judge | n/a |
| K15 | in slot | Future rungs as hollow milestones with "Next: Final reminder on Sat 31 Oct (in 3 days) — sent by you, one tap"; paused spans as a hatched band with the self-resume sentence (ux U4, judge D1) | Design & UX | 20 | Yes | P2.6 / P4.4 | Covers pack screen 6 and answers "would I install it" (automation announces itself) | n/a |
| K16 | B | The promise sheet states its forecast effect before confirming: "This pauses reminders and moves ₹1,18,000 from week 1 into week 3. If the date passes unpaid, reminders resume on their own." (ux U13) | Innovation | 20 | Yes | P4.4 + P5.3 | Lever 2 in one sentence inside the normal flow | n/a |
| K17 | C | New invoice: "Load sample line: 1 × ₹10,000 @ 18 %" and a live GST line "Same state (Punjab → Punjab): CGST ₹900 + SGST ₹900" ↔ "Different state (Punjab → Haryana): IGST ₹1,800" (judge D2, ux U12) | Design & UX | 20 | Yes, GST beat | P3.4 | The judge reproduces the pack's check in 10 s from their own click | n/a |
| K18 | in slot | `Term` component: plain label + ⓘ → Popover, never a hover Tooltip (ux U1) | Design & UX | 30 (kit) | Yes | P1.7 kit / P2 | Radix Tooltip opens only on hover or focus, so on a phone the pack's tooltip rule silently fails | Radix docs (ux lens) |
| K19 | in slot | `StatusChip` icon + word map (§7) and the help button whose glossary is generated from the label/hint pairs (ux U2, U11) | Design & UX | 30 (kit) | Yes | P1.7 kit | Pack rule "never colour alone"; a 30-pair bilingual glossary for free | n/a |
| K20 | in slot | `[lang=hi]` rules (line-height 1.8, no uppercase or letter-spacing), `min-height` never `height`, 2×2 button grids below `sm`, rem-only layout with three text sizes (ux U6, U7) | Design & UX | 25 | Yes, Hindi flip | P1.7 / P7.6 | Five Hindi labels grow 125–183 %; clipped buttons in the Hindi flip are the likeliest Design & UX deduction | n/a |
| K21 | C | Lakh sublabel under the hero amounts ("≈ 11.8 lakh" / "≈ 11.8 लाख") (ux U5) | Design & UX | 10 | Yes | P2.5 | Owners think in lakhs; the video reader gets the magnitude at a glance | n/a |
| K22 | in slot (saves time) | Chase-first, Documents, Customers detail and the dashboard top-5 as filtered views of one `InvoiceRow` + `Timeline` (ux U10) | Technical Execution | −45 net | Yes | P2.6, P3.6, P5.2, P5.8 | Recovers Dev B's 30–45 min overruns; consistent rows score under Design & UX | n/a |
| K23 | in slot (replaces Invoify) | Own A4 Tax Invoice component (~150 lines) with Invoify as a visual reference only (premortem R5) | Technical Execution | 0 net (replaces the Invoify lift) | Yes, PDF | P3.5 | Invoify is React 18 + TS + Tailwind 3 with one tax line and no HSN; lifting it costs more than writing the GST table | Premortem repo read (not re-checked) |
| K24 | in slot | Print: `@page` page numbers (Chrome 131+), "Record #hash · verify URL" footer + 20 mm verify QR, UPI QR ≥ 30 mm, Discount column hidden when all zero; short verify route `/v/<first 16 hex>` for every QR (ux U14, demo A9) | Technical Execution | 30 | Yes, QR scan | P5.5–P5.7 | A short URL makes the QR scannable from a 1080p frame; "2 / 2" reads as evidence-grade | n/a |
| K25 | C | Invoice header badge "Agreed 30 days · legal maximum 45 (MSMED Act §15)"; with no written terms: "No written terms · due within 15 days of acceptance (MSMED Act §15)" (judge M2, badge only) | Impact | 10 | Yes | P2.6 | Teaches the law on every invoice — the thesis in product form | TRUE (s.15 verbatim); wording corrected in §6 |
| K26 | B | +15 rung "Call the customer" card: six-line script in the customer's language, `tel:` link, outcome → promise / dispute / snooze 2 days, each a chained event (competitor 7) | Design & UX | 20 | Yes, Follow-ups | P4.4 | The pack's "final reminder + call prompt" made real; answers Tagada's AI call without consent or TRAI risk | n/a |
| K27 | C | Header chip "Demo" with tooltip "Simulated: UPI payment, bank feed (CSV), WhatsApp (opens your app). Real: schedule, email, GST and interest maths, documents, audit chain." EN + HI (judge M4, quality real-vs-simulated) | Impact | 10 | Yes | P1.7 shell | Ambiguity about what is real is a red flag; say it on screen | n/a |
| K28 | C | "Download e-invoice JSON (NIC schema)" on the invoice print toolbar; tooltip "Ready for an IRP above ₹5 crore; no IRN is generated here." (judge T3) | Technical Execution | 10 | Click-through | P3.5 | Surfaces `einvoiceJson()`, which is otherwise invisible | Threshold ₹5 cr: library (Notification 10/2023-CT) |
| K29 | A | `scripts/gates.sh` in CI and before submit: persona strings (baaki, sharma packaging, rakesh, pune), create-next-app residue (incl. the default `favicon.ico`), `new Date` only in `lib/time.js`, no `console.log` outside `lib/log.js`, conflict markers / TODO, secret prefixes, en/hi key parity + Hindi chip ≤ 12 graphemes, and the banned letter phrases (list in §6) rendered over every template EN/HI; video gate `ffprobe ≤ 180.0 s` (domain 11, demo A14, quality gates, ux i18n test) | Technical Execution | 25 | No (removes risk) | New P2 row; P10.1 | Locks the pack's never-threaten rule and the cheapest "looks unfinished" tells into CI | TRUE: IBC s.8 / Rule 5 "demand notice", NI Act s.138(b) written demand (secondary + SC judgment) |
| K30 | in slot (do first) | `lib/http.js` `route()` wrapper (AppError, frozen code table, `no-store`, `x-request-id`, 413 above 1 MB) + `lib/validate.js` (~60 lines, no dependency) + param regexes before any DB call (quality 1.3/1.4) | Technical Execution | 45 (inside P2.1–P2.2) | No | P2.1 first task | Judges' first probe is a malformed request; trivial now, hours to retrofit after the routes exist | n/a |
| K31 | B | Security headers in `next.config.mjs`: `poweredByHeader:false`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options DENY, CSP `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`; `X-Robots-Tag: noindex` on `/pay`, `/print`, `/api` (quality 1.10) | Technical Execution | 15 | No (curl -I / securityheaders.com) | P2 | The current config sends none; an A grade in 15 minutes | Ask the organiser whether submissions are iframed before shipping `frame-ancestors 'none'` |
| K32 | B | `app/(owner)/error.js` (Try again `retry ?? reset`, "Reference: digest"), `app/global-error.js`, `app/not-found.js` EN/HI, `app/pay/[token]/not-found.js` + "link expired" view, `loading.js` skeletons (quality 1.5) | Design & UX | 30 | Yes (judges type bad URLs) | P7.5 (or with the first screens) | The pack's own debug prompt asks for "a simple error screen" | n/a |
| K33 | C | `lib/log.js` JSON lines with `req_id` (Render `rndr-id`) and a PII denylist that throws in tests (quality 1.9) | Technical Execution | 20 | No | P2 | "No PII in logs" becomes a test a judge can read | n/a |
| K34 | C | Three double-submit tests: double Send → one number; double "I've already paid" → one claim (partial unique `one_open_claim`); concurrent ticks → one 409, no second email (quality 1.6, trimmed from six) | Technical Execution | 25 | No | P7.1 | Judges click twice on purpose | n/a |
| K35 | A | Platform hardening before P1.11: `next/font/local` or `@fontsource` (no Google fetch at build); cron start command via `node -e "fetch(…)"` (no curl dependency); `TZ=Asia/Kolkata` in render.yaml + CI; `engines: ">=22.12 <23"` + `NODE_VERSION` on the Workflow service; `.npmrc save-exact=true` and pin current versions; `preDeployCommand: npm run db:migrate`; `export const dynamic = 'force-dynamic'` in the root layout; run the Workflow once with `render workflows dev`; cron-job.org backup trigger at 10:05 IST (premortem R1/R3/R7/R8/R14/R21, quality 1.7) | Technical Execution | 40 | No (removes deploy failures) | P1.11 | Each is a known way to lose a deploy or a scheduled run during the freeze | Platform facts from lens reports (§4) |
| K36 | B | Accessibility beyond the pack: `aria-live="polite"` on invoice totals, `aria-invalid` + `aria-describedby` from API `fields`, "Skip to content", `prefers-reduced-motion`, `aria-label` from i18n on icon buttons, `lang="hi"` spans on bilingual print (quality 1.11) | Design & UX | 30 | Partly | P7.7 | Moves Lighthouse accessibility from ~88 to 95+; `<html lang>` already switches | n/a |
| K37 | C | `/pay` collapsed note "Why pay by this date?" citing s.37(2)(g), date-branched, shown only for a micro/small supplier and a buyer with a GSTIN, ending "General information, not tax advice." (domain b) | Impact | 20 | Yes, `/pay` | P4.5 | Buyer-side benefit stated without a threat; most teams will still say 43B(h) | TRUE: Income-tax Act 2025 s.37(1), (2)(g), (3) verbatim; lens wording corrected (§6) |
| K38 | B | Privacy card and `/pay` notice basis: "we process your contact details to collect a lawful debt; you may choose the channel or opt out of automated reminders"; never "consent" (domain d5) | Impact | 5 | Yes | P7.4 + P4.5 | Debt recovery is an exempt purpose under DPDP s.17(1)(a); "withdraw consent to reminders" is wrong law and odd UX | TRUE: DPDP s.17(1)(a), s.2(t) verbatim |
| K39 | B | Letter footnote completeness: base = outstanding total incl. GST (stated as a convention); the over-45-day terms sentence (corrected, §6); "interest", never "penalty" (domain d3) | Technical Execution | 10 | Yes, letter | P5.5 | Answers "why interest on the GST?" and "why day 46 when terms say 60?" without a live Q&A | s.15 proviso and s.16 TRUE; the GST-inclusive base is a convention (no authority found either way) |
| K40 | media | Video: cold open on the Workflow run row → `/status` → phone inbox; captions in the top band burned in + `.srt`; YouTube chapters in the pack's words; QR held at ≥ 20 % of frame for 4 s; 4 s Hindi flip; 3 s `node --test` green; 3 s psql rejecting `UPDATE escalation_events`; scrcpy phone shots (demo A1–A3, A16, A18; judge P4, D5, T2) | Presentation | in P9 | Yes | P9.2 | Judges watch the video first and use it as the test script | YouTube chapter rules, from the demo lens |
| K41 | media | Deck: reworded "we found no tool that…" claims + one comparison matrix ("✓ / not found", never ✗) + prior art incl. PayPredict and RecoverAI; "Verify our claims in 2 minutes" slide; "Built for a shop owner on a ₹8,000 phone" rationale; impact framing; appendix A with INV/26-27/0042 arithmetic (competitor 6, judge I2/P5/D4/M3, demo A15) | Innovation / Presentation | in P9 | Deck | P9.3 | Answers "rehashed idea?" and keeps our claims distinct from Tagada's | ₹8.1 L cr and 17 cases from the MoMSME AR 2025-26 (library) |
| K42 | media | README top fold (one-liner, badges, four links, 15 s GIF, "Try it in 2 minutes" with expected outcomes, real vs simulated box), "Built during the event" timeline with the declared early start, path to production as a four-column table + known limitations (judge P6, quality 1.1/1.13, competitor 8) | Presentation | 40 + 20 | Repo | P7.9 / P9.4 | Judges read the first screen and follow the first instruction | n/a |
| K43 | media | One 1280×640 hero image for the YouTube thumbnail, GitHub social preview and slide 1 (demo A4) | Presentation | 15 | Link previews | P9.3 | Our pitch shows wherever the organiser pastes a link | n/a |
| K44 | media | Backups and repo polish: MP4 as a GitHub Release asset + Drive copy; deck PDF in `docs/` + Slides link; tag `v0.1.0-hackcache`; About text + topics; `SECURITY.md`; repo-level push protection on (demo A13, quality 1.16) | Presentation | 20 | Repo | P9.4 / P10.1 | Removes single points of failure across six judges and several days | n/a |
| K45 | C | Lighthouse (median of 3) + axe reports for dashboard, `/pay`, `/verify` saved in `docs/`, with dated scores in the README (quality 1.11) | Design & UX | 15 | No | P7.8 | Pre-empts the judge who runs Lighthouse and gives the deck a number | n/a |

**Tier totals (net new):** A ≈ 5 h 10 (K1–K4, K6–K9, K29, K35) · B ≈ 4 h 30 (K5, K10–K13, K16, K26, K31, K32, K36, K38, K39) · C ≈ 2 h 25 (K17, K21, K25, K27, K28, K33, K34, K37, K45). "In slot" items (K14, K15, K18–K20, K22–K24, K30) are the specified way to do work already in the plan; K22 returns about 45 minutes.

**Cut order if a slot runs more than 1 h over** (insert ahead of the existing cut list): Tier C from the bottom up (K45 → K37 → K34 → K33 → K28 → K27 → K25 → K21 → K17), then K5, then K26, then the existing list (n8n → what-if #3 → Hindi depth → …). **Never cut:** K1, K2, K4, K29, K35.

---

## 3. Dropped candidates (one line each, decisive reason)

**Domain lens**
- Statement of Account per customer: 45 min, seen in neither the video nor the tour; roadmap line in "what we'd build next".
- Interest debit note (Rule 53(1A)): only appears after a confirmed interest allocation, a flow no judge reaches. The letter footnote mentions the s.34(3) debit note instead.
- TDS receivable tracker: 60 min and the Form 131 due date is unverified.
- GSTR-1 B2B/CDNR export: 55 min, not demo-visible, and a header mismatch with the offline tool would backfire.
- Payment receipt: overlaps the `/pay` "settled" summary and is not in the shot list.

**Competitor lens**
- None dropped; all eight merged into K3, K5, K6, K9, K13, K26, K41 and K42.

**Judge lens**
- "I confirm I received this" on `/pay`: its proposed copy is legally wrong (§6), and its value is small.
- "Cash runway" tile: duplicates the planned "lowest cash point" stat; only the §15 badge is kept (K25).
- Per-business impact numbers: already planned (Rev B #7 seed targets); they appear in the deck outline.
- Public landing footer "Reset now": merged into K3.
- `/status` as a Technical Execution exhibit: merged into K4.

**Pre-mortem lens**
- Drop react-to-print: already true (not installed); kept as a rule, nothing to do.
- Workflow task rewritten as CommonJS: `workflows/` is already ESM with the SDK's `import` export; only the local CLI run is kept (K35).
- Hand-written `components.json` fallback: the shell is already built (P1.7 DONE).
- 20-minute scratch probe: superseded by the real repo, which builds and passes 227 tests.
- `lib/db.js` pool singleton: already present (`globalThis` + `pool.on('error')`).
- Append "मात्र": already in `lib/money.js`.
- recharts `'use client'` + `responsive`: a rule for P5.4, not an addition (listed in §4).
- Cut Playwright: accepted as a cut; no work.

**UX lens**
- Light theme only and native date/select: accepted as decisions; no work.
- Hindi long month dates: already in `lib/time.js`.

**Demo lens**
- A5 judge password on the login page: superseded by K1 (no password at all in DEMO_MODE). Keep A5 only as the fallback if `/api/demo/login` slips.
- A12 `docs/judges.md`: merged into the README tour and the "Verify our claims" slide; a separate file is one more link nobody opens.

**Quality lens**
- CI with Postgres service + coverage: already in `.github/workflows` (migrate, test, build against `postgres:17`); only the README badge remains (K42).
- PWA manifest and icons: low impact, not in the video. Replacing the create-next-app favicon is covered by K29.
- Six double-submit checks: trimmed to the three that matter (K34).
- Performance decisions: Singapore is already set in `render.yaml`; the rest are rules in §4, not work.

---

## 4. Technical risks, ranked, with pre-checks, mitigations and pins

Repo facts behind this ranking:
- `app/page.js` redirects to `/dashboard`, which `proxy.js` sends to `/login`.
- The root layout reads `cookies()` and uses `next/font/google`.
- `render.yaml`: web on Starter in Singapore; the cron uses `curl`; no `TZ`; no `preDeployCommand`.
- `package.json` uses caret ranges, `engines ">=20.9"`, `"type": "module"`; `workflows/package.json` is ESM.
- CI already migrates, tests and builds against Postgres.

| # | Risk | L / I | Pre-check (no new code) | Mitigation |
|---|---|---|---|---|
| 1 | Live URL opens on a password box | Certain / High | Open the Render URL in incognito | K1 landing + `/api/demo/login` under `DEMO_MODE`; production keeps the password |
| 2 | Shared demo state trampled by six judges; nightly reseed breaks links | High / Medium | Reseed twice and diff the 0042 hash and the demo pay token | K2 + K3; README tour starts with "press Start a fresh demo" |
| 3 | Sunday 10:00 IST run has nothing to send (T0 pinned, Saturday test ticks used the auto-sends); Resend 409 on reused idempotency keys after reseed | High / High | Saturday 11 PM: reseed, then one tick → exactly 3 queued | K2 (T0 = reseed date, run-scoped key); verify the Runs panel at 10:05 Sunday before recording; Saturday 11 PM footage as fallback |
| 4 | Resend domain not Verified | Medium / High | Resend dashboard status; one `curl` send to a non-owner address | P0.4 today; Sat 2 PM rule: `MAIL_TEST_MODE=1` + `onboarding@resend.dev` (owner inbox still gets a real email); K5 is skipped if not Verified |
| 5 | `next/font/google` fails `next build` when Google Fonts is unreachable from Render's build box | Low-Med / High | — | K35: `next/font/local` with the two woff2 files, or `@fontsource/noto-sans@5.3.0` + `@fontsource/noto-sans-devanagari@5.3.0` |
| 6 | Render cron image may lack `curl`; cron → Workflow hop misfires | Low-Med / Medium | First cron run log | K35: `node -e "fetch('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+process.env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:'fullpay-workflows/daily-tick',input:[]})}).then(r=>{console.log(r.status);process.exitCode=r.ok?0:1})"`; cron-job.org backup POST at 10:05 IST; last resort node-cron from `instrumentation.js` (loses the track claim, keeps the demo) |
| 7 | Workflow service friction (Blueprint may reject `type: workflow`; `rootDir`; Node default 24) | Medium / Medium | P0.3: `render workflows dev -- npm start` then `render workflows tasks start daily-tick --local --input='[]'` | Create in the Dashboard if needed; `NODE_VERSION=22` env on the service; `TICK_SECRET` via `fromService` |
| 8 | Schema not applied on deploy (`startCommand: npm start` only) | Medium / High | Look at the first deploy log | `preDeployCommand: npm run db:migrate` (paid instances; Starter qualifies); migrations stay idempotent |
| 9 | UTC runtime shifts IST day boundaries | High without fix / Medium | `TZ=UTC node --test tests/time.test.js` | `lib/time.js` is already explicit IST; add `TZ=Asia/Kolkata` to render.yaml and CI as belt-and-braces |
| 10 | Lockfile drift (macOS lockfile lacks Linux natives); caret ranges move during the freeze | Medium / High | Ask Dev B's OS | Regenerate the lockfile only on Linux; `.npmrc save-exact=true`; `npm ci` everywhere |
| 11 | Hydration mismatch / console errors from dates and money formatted differently on server and browser | High / Medium | DevTools console on every screen at P7 | Format only in `lib/time.js` / `lib/money.js`, server-rendered strings; K29 gate on `new Date` |
| 12 | Prerender or caching serves stale data after reseed | Low now / High | `npm run build` output marks every route ƒ (dynamic) | Root layout's `cookies()` already makes routes dynamic; add `export const dynamic = 'force-dynamic'` as belt (K35). Caveat: because the root layout reads cookies, owner `loading.js` fallbacks may not stream; if they don't, put `<Suspense>` inside `page.js` |
| 13 | recharts zero-size warning / server import (pack: "no console errors") | Medium / Low | — | `recharts@3.10.1` + `react-is` pinned to the installed React (19.3.0); `'use client'` wrapper, `responsive` prop, `next/dynamic(..., {ssr:false})` |
| 14 | Free Postgres expires 30 days after creation | Low / High | Note the creation date | Calendar reminder for 18 Nov; upgrade if judging slips |
| 15 | pg TLS against the external URL from laptops/CI | Medium / Low | `?sslmode=require` vs `?sslmode=no-verify` once | Services use the internal URL; never mix a URL `sslmode` with an `ssl` object |
| 16 | `frame-ancestors 'none'` blanks an iframed submission preview | Low-Med / Medium | Ask in the organiser group (with P0.1) | Allow the platform origin if they iframe |
| 17 | `qrcode` imported from a client component | Medium / Low | — | QR SVG only in RSC / route handlers (`lib/upi.js` server-only) |
| 18 | Email-me abused or exhausts the free quota before the 10:00 tick | Low / Medium | — | K5 caps + kill switch; tick sends flushed first |

**Version pins (verified against the npm registry today; keep what is installed, exact):**

| Package | Pin |
|---|---|
| next | 16.4.2 |
| react, react-dom | 19.3.0 (installed; 19.3.1 is latest — do not churn mid-build) |
| pg | 8.23.1 |
| resend | 6.34.1 |
| qrcode | 1.5.4 |
| to-words | 7.4.0 |
| papaparse | 5.7.0 |
| fuse.js | 7.5.0 |
| tailwindcss | 4.3.3 |
| recharts (when added) | 3.10.1 |
| react-is | 19.3.0 |
| @renderinc/sdk | 1.4.0 |
| Node | `.node-version` 22 (local v22.22.1); `engines ">=22.12 <23"` |

CI uses `actions/checkout@v4` / `setup-node@v4` and works. The pre-mortem's v7 tags were not verified by me, so do not change them.

---

## 5. Competitor picture and how we stay ahead

- **Tagada** ([Anikesh-Paul/hackcache-public](https://github.com/Anikesh-Paul/hackcache-public)) is a confirmed PS4 build. Repo created 22 Oct 09:14 UTC; still pushing at 06:35 UTC today (checked via the GitHub API).
  - Overlaps both our levers: a six-rung ladder ending in an "ODR case file", a §16 engine switching to 17.25 % on 7 Oct 2026, promise-to-pay with instalments, and Render cron → Workflow.
  - Extras we will not match: per-visitor demo worlds, a `/proof` page, an ElevenLabs reminder call, Gemini screenshot reading.
  - Per the competitor lens's code read, it lacks: a hash chain or public verifier; the dated RBI series (every date before 7 Oct 2026 is charged 16.5 %); 0 % dispute spans; interest-first appropriation; sources in config; full Hindi; the pack's 3 % and 40 % rates.
- **The mass of the field** will be pack-verbatim AI builds (Lovable / Bolt, localStorage, Baaki / Sharma Packaging). They will win on polish per hour and tick the pack's demo checklist.
- **Full-stack WhatsApp + AI teams** have the visceral "phone buzzes" moment, but their sandbox sends reach only their own enrolled phones.
- **Fintech teams** can let a judge pay in Razorpay / Cashfree test mode. A gateway hides the six matching cases the brief grades, and test-mode UPI is a mock bank page, not a QR scan.

How we stay ahead, using only kept items:
1. **Make every claim checkable.** K1 gets judges in; K4 `/status` + Runs proves the schedule; K5 puts a real email in the judge's own inbox; K13 `/proof` + `check:pack` executes the pack's checklist. An AI build cannot answer "show me".
2. **Word the novelty claims around what Tagada's code lacks** (K41). Use these three:
   - "We found no tool that computes MSMED §16 interest from a dated, sourced RBI Bank Rate series with 0 % inside owner-accepted disputes and interest-first appropriation."
   - "We found no tool where a customer promise reflows the 13-week cash forecast and a broken promise resumes the ladder by itself."
   - "We found no Indian billing tool with a public, tamper-evident verifier the buyer can scan to confirm payee details."
   - Never "first" or "only". Never name a HackCache team.
3. **Put the difference on screen where both teams overlap:** K9 strip (sources, spans, appropriation), K10 GST on interest, K11 eligibility gates with the Silpi / NBCC hedge, K12 §2(b).
4. **Match their best moments inside the rules:** K6 simulated UPI → real matcher (fintech); K26 human call rung with a logged outcome (Tagada's AI call); K2 + K3 deterministic, renewing shared demo (their per-visitor worlds, at a fraction of the cost).
5. **Keep Hindi depth off the front of the cut list.** Full EN / HI is a visible edge over Tagada's header-only language.
6. **One deck line on gateways:** "Why not Razorpay? The brief says simulate; test mode cannot show a UPI QR scan; and a gateway hides the six matching cases the brief grades — we show them."
7. **Build-fresh:** our early start is declared (P0.14). The README "Built during the event" block (K42) makes it obvious in 10 seconds. Say nothing about other teams.

---

## 6. Domain and legal findings: verdicts and exact wording

### 6.1 Verdicts

| # | Claim | Verdict | Source |
|---|---|---|---|
| L1 | CGST s.15(2)(d): value of supply includes "interest or late fee or penalty for delayed payment of any consideration for any supply" | **TRUE** (verbatim) | [CBIC s.15](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section15_v1.00.html) |
| L2 | s.12(6) / s.13(6): time of supply of that addition "shall be the date on which the supplier receives such addition in value" → GST on interest is payable on receipt, never on accrual | **TRUE** (verbatim, both sections) | [CBIC s.12](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section12_v1.00.html) · [CBIC s.13](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section13_v1.00.html) |
| L3 | Circular 178/10/2022-GST (3 Aug 2022) para 9: late-payment interest/fee is "an ancillary supply naturally bundled … assessed at the same rate as the principal supply"; para 7.3: a cheque-dishonour fine is not consideration for tolerating an act | **TRUE** | [GST Council PDF](https://www.gstcouncil.gov.in/sites/default/files/2024-06/cir-178-08-2022-cgst.pdf) |
| L4 | s.34(3): where taxable value/tax charged is found to be less, the supplier "shall issue … one or more debit notes"; s.34(4): declare in the return for the month of issue | **TRUE** | [CBIC s.34](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter7/section34_v1.00.html) |
| L5 | Rule 53(1A) debit-note particulars; GSTR-1 table 9B | **UNVERIFIED** (not fetched; the debit-note item is dropped) | — |
| L6 | Buyer may claim ITC on the interest debit note | **UNVERIFIED** as a general statement → letter says "subject to the usual conditions" | — |
| L7 | Interest base = outstanding total including GST | **UNVERIFIED** (no authority found either way) → present as a stated convention, not as law | — |
| L8 | Income-tax Act 2025 s.37(1) + (2)(g): sums payable to a micro or small enterprise "beyond the time limit specified in section 15 of the MSMED Act" are deductible only in the tax year actually paid; s.37(3) grace to the return due date applies "except the sum referred to in clause (g)" | **TRUE** (verbatim) | [Gazette, Act 30 of 2025](https://egazette.gov.in/WriteReadData/2025/265620.pdf), p.63–64 |
| L9 | Rajya Sabha Unstarred Q.242, 21 Jul 2026: 43B(h) corresponds to s.37(2)(g) | **TRUE (secondary host)** — reply PDF hosted by a2ztaxcorp, not found on a sansad.in primary | [a2ztaxcorp reply PDF](https://a2ztaxcorp.net/wp-content/uploads/2026/07/RS-SECTION-43BH-OF-THE-INCOME-TAX-ACT-21.07.2026.pdf) · [TaxGuru](https://taxguru.in/income-tax/finance-ministry-clarifies-section-43bh-45-day-msme-payment-rule.html) |
| L10 | Domain pay-page wording "at most 45 days from acceptance" as *the* limit | **PARTLY FALSE** → the s.15 limit is the agreed date (≤ 45 days) or, with no written agreement, the appointed day (15 days after acceptance). Corrected wording in 6.2 | [MSMED Act s.15](https://www.dcmsme.gov.in/MSMED2006.pdf) |
| L11 | MSMED s.2(b): appointed day = day after 15 days from acceptance; Explanation (i)(b): where the buyer objects in writing within 15 days of delivery, the day of acceptance is "the day on which such objection is removed by the supplier" | **TRUE** (verbatim). Treating a `/pay` dispute as the written objection is **our reading** → say "may move" | [MSMED Act (Gazette copy)](https://www.dcmsme.gov.in/MSMED2006.pdf) |
| L12 | Judge I4 copy "acceptance is deemed after 15 days in any case" | **FALSE** → deemed acceptance is the day of actual delivery where no written objection is made within 15 days (s.2(b) Expl. (ii)). Item dropped | same |
| L13 | s.15 proviso: agreed period "in no case … shall exceed forty-five days from the day of acceptance"; s.16: compound interest with monthly rests at three times the Bank Rate, "notwithstanding anything contained in any agreement" | **TRUE** (verbatim) | same |
| L14 | Domain footnote "interest runs from the statutory appointed day even where agreed terms are longer" | **IMPRECISE** → s.16 runs from the appointed day, or from the day after the agreed date; agreed terms are capped at 45 days. Corrected wording in 6.2 | same |
| L15 | s.2(n): "supplier" means a micro or small enterprise that has filed a memorandum under s.8 → medium enterprises get no s.16 interest | **TRUE** | same |
| L16 | ODR Scheme Guidelines §7: Micro and Small Enterprises registered on Udyam (or the Udyam Assist Platform) are eligible | **TRUE** | [ODR Guidelines](https://odr.msme.gov.in/assets/pdf/MSE_Scheme_on_ODR_for_Delayed_Payment_Guidelines.pdf) |
| L17 | §12.1.4 (a)–(h) application contents | **TRUE.** (g) = "signature and identification proof of an MSE seller"; (h) = signature, enrolment ID proof and power of attorney of the seller's **legal representative, if any**. The UX lens's mapping ("g. signature, h. ID proof") is **wrong** → fixed in §7 | same |
| L18 | Udyam registration must predate the supply | **CONTESTED, TRUE as hedged**: Silpi Industries (SC 2021) and Mahakali Foods (2023) require prior registration; NBCC v State of West Bengal, 2025 INSC 54 (10 Jan 2025) upheld the Council's jurisdiction for a later-registered enterprise and referred the question to a three-judge bench; no ruling on the reference found | [LiveLaw](https://www.livelaw.in/amp/supreme-court/can-unregistered-msmes-avail-dispute-settlement-under-s18-msmed-act-supreme-court-refers-to-larger-bench-280613) · [Lawfoyer](https://lawfoyer.in/nbcc-india-ltd-v-the-state-of-west-bengal-ors-2025-1-s-c-r-610-2025-insc-54/) |
| L19 | Traders (NIC 45–47) may register on Udyam, but benefits are limited to Priority Sector Lending (MoMSME OM 02-07-2021) → not s.16 / ODR | **TRUE** (via RBI circular index; the RBI-hosted PDF returned empty to a script) | [RBI notification index](https://website.rbi.org.in/web/rbi/-/notifications/new-definition-of-micro-small-and-medium-enterprises-addition-of-retail-and-wholesale-trade-12126) |
| L20 | Limitation Act applies to ODR / MSEFC claims | **TRUE per library** (ODR portal FAQ, Silpi); not re-fetched today | [ODR portal](https://odr.msme.gov.in/) |
| L21 | DPDP s.17(1)(a): Chapter II (except s.8(1) and (5)), Chapter III and s.16 "shall not apply where the processing of personal data is necessary for enforcing any legal right or claim"; s.2(t) personal data = data about an identifiable individual | **TRUE** (verbatim) | [DPDP Act Gazette](https://egazette.gov.in/WriteReadData/2023/248045.pdf) |
| L22 | "Demand notice" is a term of art: IBC s.8 / Rule 5 Form 3; NI Act s.138 proviso (b) written demand within 30 days of the dishonour information | **TRUE** (IBBI-hosted orders; SC 2019 judgment via the domain lens) | [IBBI order](https://ibbi.gov.in/uploads/order/074ea07c9f16605f4a1c1692ce9e3b50.pdf) · [SC 2019](https://api.sci.gov.in/supremecourt/2018/27023/27023_2018_Judgement_08-May-2019.pdf) |
| L23 | RBI Bank Rate 5.75 % from 7 Oct 2026 (repo 5.50 %, MSF 5.75 %) → §16 = 17.25 % | **TRUE** | [RBI prid 63742](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63742) |
| L24 | TDS on delayed-payment interest | **CONTESTED** (ITAT Ahmedabad 2011 vs Delhi HC 2014 reasoning) → never assert | domain lens sources |
| L25 | Form 131 / Rule 215 TDS certificate timing (TY 2026-27) | **UNVERIFIED** (portal 403 to scripts) → not used | — |
| L26 | Income-tax Act 2025 s.393(1) exists as the TDS table section (labels Sl. 6(i) / 6(iii) / 8(ii)) | **TRUE** (section present in the Act text; serials library-verified) | Gazette above |

### 6.2 Exact wording to use

- **Letter title and disclaimer:** unchanged from the pack: "Payment Demand Letter" and its "not a GST department notice and not a legal notice" line. Hindi heading "भुगतान मांग पत्र" (RBI glossary मांग पत्र); never "नोटिस".
- **Banned in every letter, template and Hindi string** (enforced by K29): legal notice · legal action · demand notice · notice of demand · statutory demand · final demand · notice period · default / defaulter · operational debt · corporate debtor · dishonour · hereby called upon · failing which · constrained to · without prejudice · under instructions from · penal / penalty · without further notice · कानूनी नोटिस · नोटिस · any MSEFC / ODR / 43B(h) threat. Call the 7-day date a "pay-by date"; say "interest", never "penalty".
- **Udyam line:** "Udyam Regn. No. UDYAM-PB-06-0012345 · Small · registered DD-MM-YYYY".
- **GST on interest** (letter, after the per-period table; only for a GST-regular supplier):
  > Interest under section 16 of the MSMED Act, 2006, computed to [letter date]: **₹X**
  > GST on this interest @18 % (CGST 9 % + SGST 9 %), payable when the interest is received: **₹Y**
  > *(box unticked)* Amount requested by [pay-by date]: **₹P**. The interest above is shown for information and is not added to the amount requested.
  > *(box ticked)* Amount requested by [pay-by date]: principal ₹P + interest ₹X + GST on interest ₹Y = **₹T**.
  > Footnote: "GST applies to interest for delayed payment as part of the value of the original supply (CGST Act s.15(2)(d); CBIC Circular 178/10/2022-GST, para 9). It becomes payable when the interest is received (s.12(6) / s.13(6)) and will be invoiced by a debit note under s.34(3); a registered buyer may claim input tax credit on it, subject to the usual conditions."
  - IGST variant for an inter-state invoice. Hindi line: "ब्याज पर GST @18 % (CGST 9 % + SGST 9 %) — ब्याज प्राप्त होने पर देय: ₹Y".
- **Conventions footnote additions (K39):** "Interest is computed on the outstanding invoice amount including GST (our convention; the amount payable under s.15). Where the agreed credit period is longer than 45 days, interest runs from the day after the 45th day from acceptance, because s.15 caps agreed terms at 45 days; where no period was agreed in writing, it runs from the appointed day (the 16th day after acceptance)."
- **Interest tile tooltip (K8):** "3 × RBI Bank Rate (17.25 % since 7 Oct 2026), compound with monthly rests, for micro and small suppliers only. Shown here; demanded only when you tick it on a letter."
- **Legally-due badge (K25):** "Agreed 30 days · legal maximum 45 (MSMED Act §15)" / "No written terms · due within 15 days of acceptance (MSMED Act §15)".
- **§2(b) Inbox label (K12):** "Written objection within 15 days of delivery (MSMED Act §2(b)) — the acceptance date may move to the day you resolve this, and the due date and any interest follow it." Hindi to be proofread.
- **ODR card / bundle gates (K11):**
  - Header: "Prepared to the MSE ODR Scheme Guidelines §12.1.4 (a)–(h) checklist. Eligibility is decided by the Facilitation Council."
  - Gates (icon + word each):
    - "Udyam-registered micro or small enterprise ✓"
    - "Registered before the supply ✓/✗ — generally required (Silpi Industries, SC 2021); the Supreme Court has referred the question to a three-judge bench (NBCC v. State of West Bengal, 2025 INSC 54)"
    - "Not a trader (NIC 45–47) ✓"
    - "Within limitation: N days left (3 years from the due date)"
  - Never "you are eligible" or "ODR-ready".
- **`/pay` note (K37), corrected:**
  > EN (before the limit): "Good to know: [Business] is a Udyam-registered small enterprise. For business buyers, section 37(2)(g) of the Income-tax Act, 2025 (earlier section 43B(h)) allows the deduction for purchases from micro and small enterprises in the year they are incurred only if payment is made within the MSMED Act time limit — the agreed date, which cannot be more than 45 days after acceptance, or 15 days after acceptance if nothing was agreed in writing. Paying by [date] keeps this expense deductible in the year it was incurred. General information, not tax advice."
  > EN (after the limit): "Good to know: this invoice is past the MSMED Act time limit, so under section 37(2)(g) of the Income-tax Act, 2025 the expense is deductible only in the tax year in which it is actually paid — paying before 31 March keeps it in the current year. General information, not tax advice."
  > HI (before): "जानकारी के लिए: [व्यवसाय] उद्यम-पंजीकृत लघु उद्यम है। व्यवसायी क्रेताओं के लिए, आयकर अधिनियम, 2025 की धारा 37(2)(g) (पहले धारा 43B(h)) के अनुसार सूक्ष्म और लघु उद्यमों से खरीद की कटौती उसी वर्ष तभी मिलती है जब भुगतान MSMED अधिनियम की समय-सीमा में हो — लिखित सहमति वाली तारीख, जो स्वीकृति से 45 दिन से अधिक नहीं हो सकती, या लिखित सहमति न हो तो स्वीकृति से 15 दिन। [तारीख] तक भुगतान करने से यह खर्च इसी कर-वर्ष में कटौती-योग्य रहता है। यह सामान्य जानकारी है, कर-सलाह नहीं।"
  > HI (after): "जानकारी के लिए: यह बिल MSMED समय-सीमा पार कर चुका है, इसलिए धारा 37(2)(g) के अनुसार यह खर्च उसी कर-वर्ष में कटौती-योग्य होगा जिसमें वास्तव में भुगतान होता है — 31 मार्च से पहले भुगतान करने पर इसी वर्ष में। यह सामान्य जानकारी है, कर-सलाह नहीं।"
  - Hindi needs a fluent proofread (judge risk "machine Hindi"). Never in the letter or WhatsApp templates (Rev F #14 stands).
- **Privacy card / `/pay` notice basis (K38):**
  - "[Business] holds your name, phone, email and this bill's history to collect a lawful debt. You may choose how we contact you, or opt out of automated reminders. To correct details, contact [dispute contact]."
  - Card adds: "Designed to DPDP principles — duties not yet in force (DPDP Act s.17(1)(a) exempts processing necessary to enforce a legal claim; we give notice and honour opt-outs anyway)."
- **Owner-side only (deck Impact slide, ODR card; never sent to the buyer):** s.37(2)(g) and the s.37(3) no-grace rule; MSMED s.22 disclosure and s.23 non-deductibility of s.16 interest; MSME Form I half-yearly filing. Line: "the law already puts four levers behind every MSE invoice — FullPay is the paperwork."

---

## 7. UX essentials by screen (survivors from the UX lens)

**Global rules (K18–K20, plus decisions):**
- Light theme only (`color-scheme: light`); UX4G status tokens #00522c / #8a1a16 / #ad4e00 / #006d75 with tints #e3f1e8 / #fbe9e7 / #fff1e0 / #e0f4f5; text #1f2937, muted #4b5563.
- Body 16 px; inputs 16 px; `[lang=hi]` line-height 1.8, no uppercase or letter-spacing.
- Every target `min-height: 3rem`; rem-only layout; text size 16 / 18 / 20 px.
- Focus ring 4 px with 2 px offset.
- Native `<input type="date">`; Native Select below `md`.
- One fixed `?` help button (bottom-right, above the phone nav) opening a Sheet with the route paragraph and a glossary generated from every label/hint pair.
- Toasts with `role="status"`; `AlertDialog` titles state the consequence ("Mark ₹1,18,000 as paid? Reminders stop and the record is sealed.").
- Latin digits in both languages; money via `Intl.NumberFormat('en-IN')`; Hindi dates with long months ("7 अक्टूबर 2026").
- Phone nav: Home (होम) · Today (आज) · Bills (बिल) · Money (पैसा) · More (और).

**Status chips (icon · EN · HI):**
- FilePen · Draft · ड्राफ़्ट
- Send · Sent · भेजा गया
- BellRing · Due soon · तारीख पास है
- Clock · Not yet due · अभी समय है
- AlertTriangle · Overdue · 16 days · देर हो चुकी · 16 दिन
- CircleDot · Part paid · कुछ मिला
- CheckCircle2 · Paid · पूरा मिला
- MessageSquareWarning · Disputed · सवाल उठा
- Handshake · Promise till 14 Nov · वादा, 14 नवंबर तक
- AlarmClockOff · Snoozed till… · …तक रोका
- HandshakeOff · Promise missed · वादा टूटा
- MailX · Failed · Retry · नहीं गया · फिर भेजें
- ShieldCheck · Record unaltered · रिकॉर्ड में कोई बदलाव नहीं
- ShieldAlert · Record altered · रिकॉर्ड बदला गया
- ShieldQuestion · No record found · रिकॉर्ड नहीं मिला
- CheckCheck / Check / Search · Sure / Likely / Check · पक्का / शायद / जांचें

**Master label → term pairs (all kept; `label` / `hint` i18n keys; the term shows in the `Term` popover):**

| Key | EN label → EN term | HI label → HI term |
|---|---|---|
| to_collect | Money to collect → Receivables | वसूलना बाकी → प्राप्य राशि |
| overdue | Overdue → Past due | देर हो चुकी → अतिदेय |
| expected_week | Expected this week → Projected collections | इस हफ़्ते आने की उम्मीद → अनुमानित वसूली |
| bills_30 | Bills to pay, 30 days → Payables | 30 दिन में देने हैं → देय राशि |
| cash_bank | Cash in bank → Opening balance | बैंक में पैसा → आरंभिक शेष |
| low_point | Lowest cash point → Forecast minimum | सबसे कम कैश → न्यूनतम अनुमानित शेष |
| ageing | Who owes, by age → Receivables ageing | किसका कितना, कितने दिन से → प्राप्य आयु विश्लेषण |
| chase_first | Chase these first → Collection priority | पहले इनसे वसूलें → वसूली प्राथमिकता |
| not_due | Not yet due → Current | अभी समय है → चालू |
| due_soon | Due soon → Due within 3 days | तारीख पास है → शीघ्र देय |
| part_paid | Part paid → Partial payment | कुछ मिला → आंशिक भुगतान |
| paid | Paid → Settled | पूरा मिला → चुकता |
| disputed | Disputed → Under dispute | सवाल उठा → विवादित |
| days_late | Days late → Days past due | कितने दिन देर → अतिदेय दिन |
| still_owed | Still owed → Outstanding balance | अभी बाकी → बकाया शेष |
| received | Received → Payments received | मिला → प्राप्त भुगतान |
| credit_days | Credit days → Credit period | उधार के दिन → उधार अवधि |
| promise | Promise to pay → Promise-to-pay (PTP) | पैसे देने का वादा → भुगतान वचन |
| mark_sent | Mark as sent → Log the send | भेज दिया, दर्ज करें |
| snooze | Snooze → Postpone | बाद में याद दिलाएँ → स्थगित |
| reminder | Reminder → Payment follow-up | याद दिलाना → भुगतान अनुवर्ती |
| awaiting | Awaiting you → Owner approval required | आपकी मंज़ूरी बाकी |
| letter | Payment Demand Letter | भुगतान मांग पत्र → मांग पत्र |
| pay_by | Pay by → Payment deadline | इस तारीख तक दें → भुगतान की अंतिम तिथि |
| interest | Interest the law allows → Statutory interest, MSMED Act s.16 | कानून के हिसाब से ब्याज → वैधानिक ब्याज (धारा 16) |
| taxable | Before GST → Taxable value | GST से पहले की रकम → कर योग्य मूल्य |
| round_off | Round off → Rounding to the rupee | राउंड ऑफ → पूर्णांकन |
| place_supply | Place of supply (CBIC) | आपूर्ति का स्थान |
| reverse_charge | Reverse charge → Buyer pays the GST | रिवर्स चार्ज |
| item_code | Item code → HSN/SAC | वस्तु कोड → HSN/SAC |
| reliability | Reliability → Payment behaviour grade | भरोसा → भुगतान व्यवहार ग्रेड |
| avg_late | Usually pays late by → Average days past due | औसतन इतने दिन देर → औसत विलंब दिन |
| on_time | Paid on time → On-time ratio | समय पर दिया → समय पर भुगतान अनुपात |
| matched | Matched → Reconciled | मिलान हुआ → मिलान (समाधान) |
| tds | Possibly TDS deducted → Tax deducted at source (s.393(1)) | शायद TDS कटा है → स्रोत पर कर कटौती |
| unknown_dep | Unknown deposit → Unapplied receipt | पता नहीं किसका → अनाबंटित प्राप्ति |
| covers_2 | Covers 2 bills → Multi-invoice receipt | 2 बिलों के लिए |
| confirm | Confirm → Post the payment | पक्का करें |
| buffer | Safety buffer → Minimum cash reserve | सुरक्षित न्यूनतम कैश → न्यूनतम नकद आरक्षित |
| forecast | Cash forecast → 13-week cash-flow forecast | आगे का कैश अनुमान → नकदी प्रवाह पूर्वानुमान |
| money_in | Money coming in → Expected collections | आने वाला पैसा → अपेक्षित वसूली |
| money_out | Money going out → Payables and expenses | जाने वाला पैसा → देय और खर्च |
| closing | Closing cash → Closing balance | हफ़्ते के अंत में कैश → अंतिम शेष |
| score | Score → Collection priority score | प्राथमिकता अंक |
| covers_gap | Covers the gap → Closes the forecast shortfall | कमी पूरी करता है |
| heads_up | Heads-up → Pre-due reminder | पहले से याद → पूर्व-देय अनुस्मारक |
| firmer | Firmer reminder → Second notice (internal term only; never shown to buyers) | थोड़ा सख़्त याद |
| next_steps | Next steps → Escalation guidance | आगे के कदम |
| credit_note | Credit note (GST term kept) | क्रेडिट नोट |
| claim | Claim → "Already paid" report | दावा |
| resolve | Resolve → Close the dispute | निपटाएँ |
| evidence | Evidence pack → Document bundle (MSME ODR) | सबूतों का पैकेट → दस्तावेज़ बंडल |
| undertaking | Undertaking → Declaration that facts are true | वचनपत्र |
| verify | Verify → Tamper check (hash chain) | जांचें → सत्यापन |
| record | Record → Audit entry | रिकॉर्ड → ऑडिट प्रविष्टि |
| unaltered | Unaltered → Hash chain verified | बदला नहीं गया → सत्यापित |
| invoice | Bill → Tax invoice | बिल → कर बीजक |
| due_date | Due date | भुगतान की तारीख → नियत तारीख |
| bill_of_supply | Bill of Supply (print) | आपूर्ति का बिल |
| reg_type | Registration type → GST registration status | पंजीकरण प्रकार |
| udyam | Udyam registered → MSME registration | उद्यम पंजीकृत |
| demo_date | Demo date → Simulated today | डेमो तारीख |

The "Second notice" hint conflicts with the banned-word spirit (K29 greps for "notice"). Keep that hint internal (Settings only) or change it to "Second follow-up". Recommended: "Second follow-up".

**Screen by screen: layout, signature detail and kept adds**

| Screen | First glance | Signature detail (kept) | Kept adds landing here |
|---|---|---|---|
| Dashboard | Two hero tiles (to collect, overdue) → forecast alert strip → "Chase these first" top 5 with one-tap buttons → ageing bar with a worded legend → four small tiles; success strip "Cash stays above the ₹1,50,000 buffer for all 13 weeks" when no breach | Lakh sublabel; tapping the alert strip opens Forecast at the breach week with covering bills expanded | K8 interest tile, K21 |
| Invoices list + detail | Filter chips = the seven statuses with live counts; detail: three StatTiles, Timeline, action rail | The filter chips are the status legend | K14, K15, K25 |
| New invoice | ① Customer ② Items ③ Totals; sticky total "Total ₹11,800 · incl. CGST ₹900 + SGST ₹900"; Send dialog "Allocates the next number INV/26-27/0043 and mints the pay link" | Live GST flip line | K17, K28 (print toolbar) |
| Customers | "Verma Forgings · ₹2,36,000 owed · Grade C · usually pays 20 days late"; detail as a Sheet | Grade always with its reason sentence ("Reliable / Usually late / Chase early") | K22 |
| Today's follow-ups | Tabs Due today / Awaiting you / Failed; card with message preview (capped at 6 lines), OneTapSend 2×2 | Promise sheet states the forecast effect | K16, K26, K4 Runs panel |
| Escalation ladder (Settings) | Six rows with days, auto-send switch on the first two only, lock icon + "always by you" on the rest; live sentence preview | Lock + "always by you" on letter/ODR rows | K15 (same component) |
| `/pay/:token` | "Arora Auto Components · Bill INV/26-27/0042 · ₹1,18,000 still owed · due 7 Oct 2026 (16 days ago)"; QR leads at `md`+, button leads on phones | "Is this message genuine?" card with "Pay only to UPI … · A/c ending 4321 · Verify this bill ↗ · We never ask for OTP/PIN or change bank details."; zero third-party scripts | K6, K37, K38 |
| Inbox | Customer's words quoted, three buttons (Accept → mark paid / credit note; Reject with reply; Edit bill link) | "Credit note CN/26-27/0003 issued · interest clock stopped from 14 Oct" in card and timeline | K12 |
| Payments | Dropzone + "Add a payment by hand"; summary strip "9 credits read · 1 line skipped · 6 need your confirmation" | Lock icon + "Not marked paid until you confirm" on every unconfirmed row; confidence as words | K6, K7 |
| Cash forecast | 13 bars, buffer line "Safety buffer ₹1,50,000", breach bar in error colour plus a ⚠ word; card "Week 6 (7–13 Dec): closing ₹−42,000 … Collecting these would cover it:" | Breach card lists covering bills with one-tap buttons | K16 (promise icon on shifted inflows) |
| Chase these first | Numbered cards with reason sentence; score in a `Term` popover ("amount × days late × reliability × gap impact") | The reason sentence is the UI | K22 |
| Documents | Bill picker → Timeline + print buttons + ODR readiness card | §12.1.4 checklist with ticks before printing, **corrected**: (a) seller + Udyam ✓ · (b) buyer ✓ · (c) undertaking ☐ sign on paper · (d) facts + invoices ✓ · (e) payments received ✓ · (f) amount + interest ✓ · (g) seller's signature + ID proof ☐ add by hand · (h) representative's signature, ID and power of attorney — only if a lawyer or agent acts | K11 gates |
| Settings | Accordion of six sections with one-line summaries | Demo-date consequence preview "+7 days → 2 reminders become due, 1 letter drafts" | K3, K11 fields |
| `/verify/:hash` (+ `/v/<16 hex>`) | One big result: ✓ Record unaltered / ⚠ No record found / ✗ Record altered; "Checked just now" | "Pay only to" as recorded at issue; amber (never red) on API errors | K24 |
| `/print/invoice` | Rule 46 layout, 9.5 pt items table, `thead` repeats, Discount column hidden when zero | Two QRs side by side: "Scan to pay ₹1,18,000" (≥ 30 mm) and "Scan to check this bill is genuine" (20 mm) | K23, K24, K28 |
| `/print/letter` | Title, bordered disclaimer box, schedule, bold "Please pay by 14 Nov 2026", MSMED table with the 7 Oct 2026 change as two rows | Interest table with RBI dates in it | K9, K10, K39 |
| `/print/bundle` | Cover, contents, (a)–(h) checklist with page references, gates, timeline print variant, letters verbatim, chain head + QR | A clerk could file from it | K11 |
| `/login` | One field, 48 px button, "Wrong password — 5 tries a minute" | — | Production only once K1 lands |

**UX acceptance rows** (append to P7): U1 `Term` opens on tap and on Enter · U2 360 px at 20 px root, no horizontal scroll on any route · U3 the three longest Hindi labels render fully · U4 every chip has icon + word, grayscale dashboard still reads · U5 focus ring visible · U6 help button fixed on all owner screens, glossary ≥ 30 pairs · U7 hash sheet → verify page green; after the tamper test the strip turns red and names the record · U8 three print pages save as PDF with ₹, Devanagari, both QRs scannable, "2 / 2" · U9 axe 0 serious on 5 screens · U10 `/pay` shows the QR first on a laptop and opens the UPI chooser on a phone.

---

## 8. Demo shot list, deck outline, README skeleton, judge's 2-minute tour

### 8.1 Video (≤ 2:59; 1080p30; capture window 1600×900 at 125 % zoom; captions in the top band + `.srt`; human voice-over, no music)

| # | Time | Shot | Caption (top band) |
|---|---|---|---|
| S1 | 0:00–0:09 | Render Workflows task run `daily-tick · Succeeded · 04:30 UTC` → `/status` "Today 10:00 IST · run wf_… · 3 sent · 0 failed" → phone inbox with the real reminder | "10:00 IST today. Nobody clicked. Three reminders went out — and were logged." |
| S2 | 0:09–0:12 | Title card, positioning line | — |
| S3 | 0:12–0:30 | Dashboard incl. the K8 interest tile → EN → हिंदी → EN (2 s) → "Lowest point: week 6" → forecast with covering invoices | "₹11.8 L to collect · week 6 drops below the buffer · these 3 invoices cover it. Every screen in Hindi." |
| S4 | 0:30–0:52 | Follow-ups: "Sent automatically at 10:00 IST" + run id; +7 card → WhatsApp on the phone (scrcpy) in Hindi with pay link and footer → Mark as sent → hash-stamped timeline row | "Heads-up and due-date reminders send themselves. Firmer ones are one tap, in the customer's language, logged with a hash." |
| S5 | 0:52–1:10 | Phone `/pay` at 360 px → "Something's wrong" → "Quantity short" → owner Inbox card + "Ladder paused" | "The customer disputes from the link. The ladder pauses until the owner resolves it." |
| S6 | 1:10–1:30 | Payments → Load sample statement → six matches with reasons; TDS row "short by exactly 2 % of taxable value — possibly TDS (IT Act 2025 s.393(1) Sl. 6(i), was 194C)"; confirm → recorded as TDS, ladder stops (K7) | "Six credits matched with reasons. One is short by exactly 2 % of taxable value — that's TDS, not a short payment. Nothing is marked paid without a confirm." |
| S7 | 1:30–1:42 | Two invoice previews side by side: PB→PB 900 + 900 vs PB→HR IGST 1,800, both ₹11,800 with words | "Same ₹10,000 @ 18 %. Same state: CGST ₹900 + SGST ₹900. Other state: IGST ₹1,800." |
| S8 | 1:42–2:15 | Demo clock +1 day → toast "Letter drafted (INV/26-27/0048)" → letter: title, disclaimer highlighted 2 s, two-period interest table, K9 strip, K10 GST line, unticked box, verify QR | "MSMED §16: 3 × RBI Bank Rate, compound, monthly. RBI raised the rate on 7 Oct 2026 — both periods shown, each with its RBI source. Flat-rate calculators get this wrong." |
| S9 | 2:15–2:38 | INV/26-27/0042 at 45 days → ODR card gates → bundle scroll → QR at ≥ 20 % of frame for 4 s → phone scan → `/v/…` green + "Pay only to" | "At 45 days: a bundle prepared to the MSME ODR checklist — the portal that replaced Samadhaan for new cases on 15 Oct 2025. The QR proves the record is unaltered and tells the buyer whom to pay." |
| S10 | 2:38–2:54 | `/pay` → "I'll pay on Fri 30 Oct" → forecast gap closes → demo date to 31 Oct → "Promise broken — ladder resumed" | "A promise pauses the ladder and moves the cash forecast. A broken promise resumes it — by itself." |
| S11 | 2:54–2:59 | End card: live URL + QR, repo, "/proof — every rupee, checked", "Seeded data · real email · no LLM in the money path" | — |

**YouTube chapters:**
- 00:00 It ran at 10:00 IST without us
- 00:12 Dashboard and cash forecast
- 00:30 Follow-ups: auto-sent by Render Workflow, one-tap WhatsApp
- 00:52 Customer dispute pauses the ladder
- 01:10 Bank import with the TDS flag
- 01:30 Same-state vs other-state GST
- 01:42 Demo date → Payment Demand Letter with period-correct interest
- 02:15 ODR bundle and QR verify
- 02:38 Promise, forecast, broken promise

**Optional 3-second overlays** (only if time remains under 2:59): `node --test` green count; psql rejecting `UPDATE escalation_events`.

**Gate before upload (K29):** `ffprobe` ≤ 180.0 s at 1920×1080; grep captions and the deck for banned strings; upload unlisted by 16:00 IST Sunday, not made for kids; Release-asset MP4 backup.

### 8.2 Deck (10 slides + appendix; every number sourced on the slide; URLs as text + QR)

1. **FullPay.** "Every -Pay app helps you pay. FullPay is for getting paid — in full, with the interest the law owes you." Four links + QR; hero image (K43).
2. **The problem has a number.** ₹8.1 lakh crore delayed (Economic Survey via MoMSME AR 2025-26; ₹7.34 L cr in 2024 as the trend); MSEs don't file for fear of losing the buyer; ODR disposed 17 cases in 8 months; Arora Auto: ₹11.8 L outstanding, salaries on the 1st.
3. **The law exists; the paperwork doesn't.**
   - §15 caps credit at 45 days (15 if unwritten); §16 = 3 × Bank Rate, compound, monthly = 17.25 % today (Bank Rate 5.75 % since 7 Oct 2026).
   - Samadhaan → ODR for new filings on 15 Oct 2025.
   - Four levers behind every MSE invoice: s.16 interest; Income-tax Act 2025 s.37(2)(g); MSMED s.22 disclosure; MSME Form I.
4. **One connected record + built for a ₹8,000 phone** (judge D4): timeline with hash stamps as the hero; 16 px / 48 px / 1.8 Devanagari / icon + word / one help button / 360 px EN-HI pair; UX4G cited.
5. **The handout is the floor.** 10/10 BEFORE-YOU-FINISH and 18/18 Build-2 items pass, verifiable at `/proof` and via `npm run check:pack`; localStorage → Postgres + transactions; wa.me → scheduled real sends; one RBI number → dated series.
6. **"We found no tool that…"** The three reworded claims (§5) plus a comparison matrix: rows = period-correct §16 with spans and appropriation · public verify + payee check · promise → forecast → auto-resume · GST invoice → bank match → ODR §12.1.4 pack · non-threatening Hindi letter · dated-and-sourced config · scheduled real sends · TDS 1/2/10 % matching. Columns = handout baseline · Vyapar / Khatabook · PayUpPal · FullPay. Cells "✓ / not found". Prior art named: Vasuli, FundRaksha, PayUpPal, SirigangaBS/InvoiceChaser, PayPredict, RecoverAI — "every generator we found drafts legal notices or threat tones; the brief forbids both". Never name a HackCache team.
7. **Architecture + Render track.** Cron 04:30 UTC → Workflow `daily-tick` (120 s, 0 retries) → `/api/tick` (one transaction, advisory lock, idempotent) → outbox → Resend; hash chain → `/verify`; Workflow run-row screenshot; "cron is the trigger; the Workflow gives per-run ids, timeouts and retries we log on every event"; "No LLM in the money path, by design."
8. **Accuracy and trust by design.** 900 / 900 / 1,800; rates 0 / 0.25 / 1.5 / 3 / 5 / 18 / 40; TDS labels s.393(1); interest conventions; golden ₹5,00,000 @ 19.5 % × 365 d = ₹1,06,704 ± ₹5; GST on interest payable on receipt (s.12(6)); security headers grade; Lighthouse scores (K45); DPDP "designed to principles".
9. **What it did this weekend, and what is simulated.** 3 reminders, 1 letter, 1 bundle; DSO 58 → 41 target; INV/26-27/0042 interest frozen at Sat 11 PM; honesty block (seeded data, real email, wa.me, simulated UPI, no IRN, single tenant). "Why not Razorpay?" line.
10. **Path to production + team.** Four-column table summary; links + QR again.
11. **"Verify our claims in 2 minutes"** (may replace slide 10's links):
    - `/status` (ran today, run id)
    - `/v/<pinned>` (scan this QR)
    - `/pay/<pinned token>` (press "Something's wrong")
    - `/proof`
    - CI run #N green
    - README FAQ "Did you just run the organiser's prompt?"

**Appendix:** A 0042 arithmetic (per period, rests, appropriation, engine ₹1,06,708.15 vs golden, the 6-month ₹430 day-count gap) · B threat model and DPDP map · C live-demo / async risk list (pack Submit §4) · D sources.

### 8.3 README skeleton

```
# FullPay — getting small businesses paid, in full, with the interest the law owes them
[CI badge · MIT · Node 22 · live on Render]   [hero image]
Live · Video (2:59) · Deck (PDF + Slides) · Judge tour ↓        "Open the demo — no password"

## For judges: the 2-minute tour               (first H2)
## What is real and what is simulated          (box)
## The problem in two lines, and who it is for (pack)
## What it does — one line per screen          (pack; 13 screens + /pay + /verify + /status + /proof + 3 print pages)
## How GST is worked out, and which document type is issued when (pack)
## How the escalation ladder works, and why the letter is not a legal or GST notice (pack)
## How payments are matched; how the forecast and "chase these first" work (pack)
## How it improves on chasing by hand          (pack; overnight-run numbers, DSO)
## How to run it · what is simulated · what we'd build next (pack)
## Deploying on Render, step by step           (pack §2; refresh-404 note: server-rendered, no rewrite needed)
## The 3-minute demo script                    (pack §3 = the video chapters)
## What could go wrong in a live demo, and how we avoid it (pack §4)
## Pack acceptance checklist A1–A18: test file + URL per row  (K13)
## What `npm test` prints                      (spec reporter output)
## API error contract                          (code table; RFC 9457 as the production upgrade)
## Where the pack's files live                 (table)
## Where we knowingly differ from the pack     (G3)
## The five WhatsApp Business templates we would submit (pack add-on)
## Path to production                          (Area · Ships this weekend · Production step · Why not now; known limitations; what breaks first at 1,000 businesses)
## Built during the event, declared            (early start 23 Oct 11:15 IST by team decision; planning docs under docs/planning; first commit link)
## Licence (MIT), NOTICE, SECURITY.md, team
```

### 8.4 Judge's 2-minute tour (README text)

| Clock | Do | See |
|---|---|---|
| 0:00 | Open the live URL → **Open the owner's app (demo, no password)**. If the banner says the demo was changed recently, press **Reset** | Dashboard: stats incl. "Interest due to you under MSMED Act §16", ageing bar, top 5 with reasons |
| 0:15 | **Live status** (`/status`) | Today's 10:00 IST run: Workflow run id, sent / failed, chain intact, build SHA matching `main` |
| 0:30 | Invoices → INV/26-27/0042 → **Payment Demand Letter** | Title, the "not a GST / legal notice" line, two-period interest table with RBI sources, GST on interest "payable when received"; scan the QR → "Record unaltered" + "Pay only to" |
| 0:55 | Payments → **Load sample statement** | Six matches with reasons, the 2 % TDS flag, the confirm gate |
| 1:15 | Settings → Demo date → **+1 day** | Toast: letter drafted for the 30-day invoice; Follow-ups shows it |
| 1:30 | On a phone: `/pay/<pinned token>` → **Pay by UPI (simulated)** or **Something's wrong** | The payment appears in Payments as a suggested match, or the dispute pauses the ladder in the Inbox |
| 1:50 | `/proof` | The pack's finish checks and our goldens, run now: expected / actual / pass |
| optional | **Email me the real reminder** on the landing page | The scheduled template in your own inbox within a minute |

---

## 9. Quality-bar items worth doing (beyond the kept table)

**Already true in the repo (say so, do not rebuild):**
- CI migrates, tests and builds against a Postgres 17 service.
- 227 tests pass.
- `lib/time.js` is IST-explicit.
- The db pool is a `globalThis` singleton with an error handler.
- Hindi amount-in-words ends in "मात्र".
- `<html lang>` follows the language cookie.
- The title template is `%s · FullPay`.
- Web service is on Starter in Singapore.

**Do (all in the kept table):**
- K29 gates in CI, K30 error contract + validators first, K31 headers, K32 error / not-found / loading files, K33 PII-denylist logger, K34 three double-submit tests, K35 platform hardening, K36 accessibility, K45 audit reports.
- K42 README top fold + path-to-production table, K44 tag / release / topics / SECURITY.md / push protection.

**Rules for the code still to be written:**
- Server components read through `lib/*` and the pool directly, never `fetch(APP_URL + '/api/...')`.
- Dashboard aggregates in SQL (`FILTER`, `CASE`) with `LIMIT 200`; interest only for letter, bundle, chase-first and the K8 tile.
- recharts via `next/dynamic` `ssr:false`; QR as server-side SVG.
- `window.print()` + `@page`, no print library.
- Commit messages `type(scope): what`, each engine landing with its test; never force-push `main`.
- One `npx prettier --write .` before the freeze, with no config.
- `npm audit --omit=dev` once.

**Top "looks unfinished" tells to gate** (K29 covers the first six):
- pack persona strings
- create-next-app residue (default favicon, "Create Next App")
- console errors
- `₹NaN` / `undefined` / raw i18n keys
- secrets or `.env` in history
- conflict markers or TODO
- dead controls
- deep links that 404 after refresh (A17)
- mixed language
- a README that promises what the build lacks (strike any claim without a URL)

---

## 10. Sources (deduplicated)

**Verified today (primary unless marked)**
- CGST Act s.12, s.13, s.15, s.34 — https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section12_v1.00.html · …/chapter4/section13_v1.00.html · …/chapter4/section15_v1.00.html · …/chapter7/section34_v1.00.html
- CBIC Circular 178/10/2022-GST — https://www.gstcouncil.gov.in/sites/default/files/2024-06/cir-178-08-2022-cgst.pdf
- Income-tax Act, 2025 (Gazette) — https://egazette.gov.in/WriteReadData/2025/265620.pdf
- Rajya Sabha reply 21-07-2026 (secondary hosts) — https://a2ztaxcorp.net/wp-content/uploads/2026/07/RS-SECTION-43BH-OF-THE-INCOME-TAX-ACT-21.07.2026.pdf · https://taxguru.in/income-tax/finance-ministry-clarifies-section-43bh-45-day-msme-payment-rule.html
- MSMED Act 2006 (Gazette copy) — https://www.dcmsme.gov.in/MSMED2006.pdf
- MSE Scheme on ODR, Guidelines — https://odr.msme.gov.in/assets/pdf/MSE_Scheme_on_ODR_for_Delayed_Payment_Guidelines.pdf
- NBCC v State of West Bengal, 2025 INSC 54 (secondary) — https://www.livelaw.in/amp/supreme-court/can-unregistered-msmes-avail-dispute-settlement-under-s18-msmed-act-supreme-court-refers-to-larger-bench-280613 · https://lawfoyer.in/nbcc-india-ltd-v-the-state-of-west-bengal-ors-2025-1-s-c-r-610-2025-insc-54/ · https://www.livelaw.in/amp/articles/supreme-court-conflicting-judgments-msmed-act-section-18-reference-analysis-516732
- MoMSME OM 02-07-2021 on traders (RBI) — https://website.rbi.org.in/web/rbi/-/notifications/new-definition-of-micro-small-and-medium-enterprises-addition-of-retail-and-wholesale-trade-12126 · https://website.rbi.org.in/documents/87730/39016390/OMTRADER07072021.pdf
- DPDP Act 2023 (Gazette) — https://egazette.gov.in/WriteReadData/2023/248045.pdf
- IBC s.8 / Rule 5 (IBBI-hosted order) — https://ibbi.gov.in/uploads/order/074ea07c9f16605f4a1c1692ce9e3b50.pdf
- NI Act s.138(b) (SC 2019) — https://api.sci.gov.in/supremecourt/2018/27023/27023_2018_Judgement_08-May-2019.pdf · secondary https://blog.ipleaders.in/section-138-of-negotiable-instruments-act-1881/
- RBI Bank Rate 5.75 % from 7 Oct 2026 — https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63742
- npm registry `latest` for next, react, react-dom, pg, resend, qrcode, to-words, papaparse, fuse.js, recharts, @renderinc/sdk, tailwindcss — https://registry.npmjs.org/<package>/latest
- Tagada repo metadata and commits (GitHub API) — https://github.com/Anikesh-Paul/hackcache-public

**Carried from the lens reports and the reference library (not re-fetched today)**
- RBI series — https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=61749 · https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=60604
- Gurpreet Singh v UoI (SC 2006) — https://api.sci.gov.in/jonew/judis/28157.pdf
- MoMSME Annual Report 2025-26 — https://www.msme.gov.in/static/uploads/2026/05/1bfda06b460e72543530b40817573495.pdf
- Samadhaan banner — https://samadhaan.msme.gov.in/MyMsme/MSEFC/MSEFC_Welcome.aspx · ODR portal — https://odr.msme.gov.in/
- DPDP commencement G.S.R. 843(E) — https://egazette.gov.in/WriteReadData/2025/267647.pdf
- PIB, Income-tax Act in force — https://www.pib.gov.in/PressReleasePage.aspx?PRID=2248005
- NIC e-invoice schema — https://einv-apisandbox.nic.in/version1.03/generate-irn.html
- RBI English–Hindi glossary — https://uco.bank.in/documents/d/guest/rbi-english-hindi-glossary-2023 · CBIC Hindi tax-invoice flier — https://cbic-gst.gov.in/hindi/pdf/e-version-gst-fliers/tax-invoice-efliers-hindi.pdf
- UX4G — https://ux4g.gov.in/foundations/typography · https://ux4g.gov.in/foundations/accessibility · https://ux4g.gov.in/foundations/color
- Radix Tooltip — https://www.radix-ui.com/primitives/docs/components/tooltip · issues https://github.com/radix-ui/primitives/issues/1573 · https://github.com/radix-ui/primitives/issues/2589
- WCAG — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · https://www.w3.org/WAI/WCAG21/Understanding/reflow.html · https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
- WhatsApp click to chat — https://faq.whatsapp.com/5913398998672934 · Meta template review — https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review
- Render — https://render.com/docs/free · https://render.com/docs/node-version · https://render.com/docs/deploys · https://render.com/docs/health-checks · https://render.com/docs/logging · https://render.com/docs/environment-variables · https://render.com/docs/workflows · https://render.com/docs/blueprint-spec · https://render.com/pricing
- Resend — https://resend.com/pricing · https://resend.com/docs/knowledge-base/403-error-resend-dev-domain · https://resend.com/docs/dashboard/emails/idempotency-keys
- Next.js — https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config · https://nextjs.org/docs/app/api-reference/file-conventions/error · https://nextjs.org/docs/app/api-reference/file-conventions/not-found · https://nextjs.org/docs/app/api-reference/file-conventions/loading · https://nextjs.org/docs/app/api-reference/config/next-config-js/headers · https://nextjs.org/docs/app/guides/content-security-policy · https://nextjs.org/docs/app/api-reference/components/font
- OWASP HTTP headers — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html · RFC 9457 — https://www.rfc-editor.org/rfc/rfc9457
- npm lockfile platform issue — https://github.com/npm/cli/issues/4828
- Judging practice — https://info.devpost.com/blog/hackathon-judging-tips · https://help.devpost.com/article/84-video-making-best-practices · https://guide.devfolio.co/docs/guide/participating-in-hackathons/judging-1 · https://support.google.com/youtube/answer/9884579 · https://support.google.com/youtube/answer/157177
- Competitor enablers — https://razorpay.com/docs/payments/payments/test-card-upi-details/ · https://razorpay.com/docs/payments/smart-collect/ · https://www.twilio.com/docs/whatsapp/sandbox · https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/
- Prior art — https://github.com/uditdaftary/RPay-build-recovery-agent · https://github.com/SirigangaBS/InvoiceChaser · https://github.com/a-zax/paypredict · https://github.com/Sameerkc3579/RecoverAI · https://github.com/frappe/erpnext/blob/develop/erpnext/accounts/doctype/dunning/dunning.py
- HackCache listing — https://internshala.com/competitions/?p=12241
