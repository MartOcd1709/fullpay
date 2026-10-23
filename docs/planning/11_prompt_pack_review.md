# Complete Review — Official "Build it with AI" Pack (invoice-chase)

Verified complete against the official API (16 sections, 26,185 chars; user's saved copy matches exactly). This is the organizer's own spec — judges will consciously or unconsciously grade against it. Section-by-section: what it is → what we adopt / deviate / exploit.

## [0] Build 1 · The whole prototype (the 12.8K-char spec)

**Adopt verbatim (domain rules — these ARE the grading rubric):**
- Money: whole-paise integers, `Intl.NumberFormat('en-IN')`, amount-in-words Indian style, IST dates, FY Apr–Mar.
- GST: per-line tax on taxable value (qty×rate−discount) rounded to paisa; CGST+SGST each half-rate **rounded separately** (may differ from IGST by a paisa — expected); IGST when business state code ≠ place-of-supply code (first 2 GSTIN digits); rates from config (0/5/18 main since 22 Sep 2025, +3/40) with "check cbic-gst.gov.in" note; round-off line to nearest rupee.
- Document by registration type: Tax Invoice / Bill of Supply ("Composition taxable person, not eligible to collect tax on supplies") / plain invoice. Tax-invoice required fields incl. ≤16-char invoice no **consecutive within FY**, HSN 4-digit ≤₹5cr else 6, reverse-charge note, signature line. GSTIN 15-char + check digit (made-up samples must pass). e-invoice: no IRN generation; >₹5cr turnover → screen says so.
- Demand letter: exact title "Payment Demand Letter", the mandatory "not a GST / not a legal notice" line, contents, 7-day config deadline, MSMED line **only if Udyam micro/small**, interest = compound monthly rests at 3× RBI bank rate (config, "check rbi.org.in"), **interest excluded from demand unless owner ticks the box**, 45-day next-steps (call / lawyer / portal). Ladder: −3 / 0 / +7 / +15 / +30 / +45 days, editable, pauses on dispute or promise.
- All 13 screens' feature lists; design rules (360px, plain words + jargon tooltips, 16px text / 48px buttons / WCAG AA / visible focus / labeled icons, status = word never color alone, full language switch).

**Deviate deliberately (our Layer 2):**
- Backend + Postgres instead of "No backend / localStorage" (the pack's stack is guidance for no-coders, not a rule in the brief); Next.js instead of Vite+React Router; real scheduled sends; promise objects that **reflow the forecast** (pack's forecast uses only due date + avg delay — promise linkage is absent even here, so lever L2 survives the pack).
- "Demo date" setting → our demo clock (same idea, keep the pack's name in Settings for judge familiarity).

**Exploit (intel):**
- The pack's 45-day step still says "MSME Samadhaan portal" — **the organizer's own pack is stale**: new filings moved to the MSME ODR portal on 15 Oct 2025. Frame respectfully in the demo: "the law moved on 15 Oct — our bundle targets the portal that replaced Samadhaan."
- Its "BEFORE YOU FINISH, CHECK" list = our acceptance suite (already in plan §6).

## [1] Build 2 · Finish what's missing
18-item completeness checklist. Use as the Sunday-morning regression sweep, in this order. Most teams run it once and self-certify; we actually re-test after freeze.

## [2] Add-on · Send reminders for real (our Layer 2 spec — implement fully)
Daily job 10:00 IST; Resend/SMTP key in env (+.env.example); sends in business name, reply-to owner, invoice + pay links; auto-send only owner-enabled stages (default: heads-up + due-date only); **demand letters never auto-send**; dedupe rules: never same stage twice, never disputed/paused, max 1 message/customer/day, contact footer on every message; log every send, failed sends surface in Today's Follow-ups for retry; test mode → owner's own inbox. **Plus free points most teams skip: README must explain WhatsApp Business Platform and write the five message templates we'd submit — we write those five templates.**

## [3] Add-on · Invoice from photo (Layer 3 only)
Server-side key, review-before-save, recompute GST + flag mismatch vs printed totals, GSTIN check-digit flag, JPG/PNG/PDF ≤5MB, don't retain file. Test loop: print our own invoice → photograph → read back (great live-demo bit if reached).

## [4] Add-on · Another language (Marathi)
Full-string translation incl. templates + pay page; **per-customer preferred language** (pull this field into Layer 2 now — cheap, high inclusion value); invoices/letters stay EN with optional second language under headings; language names in native script; long-word wrap at 360px.

## [5] Submit · README, link and demo (judge expectations, explicit)
- README contents enumerated (problem 2 lines, per-screen lines, GST logic + document-type rules, ladder + why letter isn't legal notice, matching/forecast/score explanations, improvement over manual chasing, run instructions, what's simulated, next steps) — mirror this structure exactly.
- Deploy: SPA rewrite so refresh/`/pay/:token` deep links don't 404 — on Render: rewrite all → index.html (or Next.js handles it natively; verify the token route on the deployed URL).
- Their 3-min demo beat list tells us what judges expect to see: dashboard → forecast shortfall + covering invoices → follow-ups WhatsApp send → customer dispute pausing ladder → bank import incl. TDS → **same-state vs other-state GST invoices side by side** → demand letter → demo date forward. **Our demo order stays autonomy-first but MUST include the GST side-by-side and the TDS import beat** ("accuracy of financial calculations" is in the official evaluation focus). Plan §7 updated.
- They ask for a live-demo risk list — we have one; put it in the deck appendix.

## [6–15] The ten Debug prompts (= the organizer's expected failure modes → our test matrix)
- GST math: paise-only arithmetic, rupees converted exactly once at entry, separate CGST/SGST rounding, round-off line, words match rounded total; their 6 worked cases become unit tests (incl. 3×₹333@5%, 10% discount, composition, 0%).
- Reminder timing: whole IST days (not hours/UTC), each stage fires once, pause semantics, part-payment keeps stage but updates amount, stage days from config.
- Matching: invoice-no found despite separator variants (INV/26-27/0012 ≈ INV 26-27 12 ≈ 0012), paise comparison, name normalization (ignore M/s, Pvt Ltd, case), one payment → many invoices oldest-first unless description names them, part-payment leaves remainder, TDS flag at exactly 1/2/10% of taxable value, confirm-gate, **re-importing the same CSV never double-counts (idempotency on date+amount+reference)** ← new acceptance item.
- Phone: nothing sideways at 360px **and at largest text size**, tables → stacked cards, ≥48px buttons, Hindi word wrap, A4 print pages still correct.
- Deploy: SPA rewrite, case-sensitive import paths, env vars on host, client points at live server URL.

## Plan deltas applied (10_build_plan.md updated)
1. Demo beats added: GST same/other-state side-by-side + bank-import TDS moment.
2. Acceptance additions: CSV re-import idempotency; part-payment updates reminder amount; name/separator-insensitive matching; largest-text-size layout pass.
3. README: mirror pack structure + include the five WhatsApp templates.
4. Per-customer preferred-language field promoted to Layer 2.
5. Settings keeps "Demo date" naming; `/pay/:token` deep-link verified on deployed Render URL.
6. Pitch line: organizer pack still says Samadhaan → our ODR bundle framed as "the law moved on 15 Oct" (respectful, verifiable).
