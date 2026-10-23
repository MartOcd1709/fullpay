# Final Recommendation

## Executive decision

- **Winner: Problem Statement 4 — The Small Business Invoice Chase** (Banking & Finance, slug `invoice-chase`)
- **Backup: Problem Statement 6 — Citizen-Powered Government Accountability Platform**
- Internal score: 82.5/100 (next eligible: 76.5). Official-criteria read: 8.3/10 mean, highest of the field.
- Confidence: **High** on feasibility and differentiation claims (web-verified); **Medium** on judge taste (weights unpublished).
- Most important unresolved uncertainty: the exact submission deadline wording (plan for Sun 25 Oct 9:30 PM IST, confirm officially — guide wording would mean Sat 24 Oct midnight) and the MSMED §16 interest formula (verify against the Act before the deck).

## Why this candidate wins

1. **Verified white space:** Vyapar/myBillBook do invoices+reminders; Chaser does escalation at £135+/mo; *nobody* ships reminders→MSMED-demand-letter→Samadhaan escalation at Indian MSME prices. Differentiation that survives a judge's Google search.
2. **The impact number is enormous and citable:** ₹7.34 lakh crore stuck (Mar 2024), formal remedy reaching <1%.
3. **Every differentiator is deterministic** — state machine, date math, statutory-interest computation, PDF generation, forecast arithmetic. No fragile API can kill the live demo; the brief blesses simulated data.
4. **Technical-execution gap:** the organizer pushes no-code builders; most rivals will demo UIs over mocks. A real escalation engine with scheduled jobs is a visible class difference on an official criterion.
5. **Double prize surface:** escalation ticks on Render Workflows makes it a top contender for the Render track ($500/$300/$100 credits) with zero extra scope.
6. **Jury fit:** a fintech product owner (Aditya Birla Capital) and a PM judge can verify the gap is real; academics can verify the math.

## Proposed solution — "**Vasooli**" (working name; alternatives: PaidUp, Ugrahi)

*The receivables autopilot for Indian small businesses: it chases, escalates, and warns you before the cash runs out.*

- **Target user:** an Indian MSME owner (trader/job-work manufacturer/agency) with 20–200 open invoices and no accountant.
- **Core problem:** chasing payments consumes the owner; escalation to legal remedies is unknown/intimidating; cash shortages arrive unseen.
- **Main workflow:** add/import invoices → dashboard shows aging + risk → each overdue invoice walks an escalation ladder automatically (gentle reminder → firm reminder → MSMED §15/§16 demand letter with computed statutory interest → Samadhaan filing guidance) → forecast shows the next 8 weeks of cash with a shortfall alert.
- **USP:** the only tool that takes an unpaid invoice from "friendly nudge" to "statutory demand with interest computed" automatically — legal teeth at kirana prices.
- **Core features (5):** ① Invoice manager + aging dashboard ② Escalation-ladder engine (auto-advancing, scheduled) ③ Document generator (GST-schema-valid invoice JSON+PDF+QR; MSMED demand-letter PDF) ④ Cash-flow forecast (collections-probability × aging vs committed outflows) ⑤ Communication center (simulated WhatsApp/email threads; real email send optional).
- **Non-goals (say them in the deck):** not an accounting suite, no real IRN/GSTN filing, no real WhatsApp Business API, no payments processing, not legal advice.
- **Measurable success criteria:** seeded demo shows DSO cut and a predicted shortfall averted; all 4 submission links live; escalation runs unattended on Render Workflows.

## Backup: Govt Accountability — when to switch

Switch only if, before building starts, you (a) learn judges heavily weight social-impact storytelling, or (b) gain a third teammate. Scope the switch to the spine: intake → hash-chained log → 3-level escalation with compressed timers → NALSA directory handoff. Do not attempt profiles, AI verification, or appeals.

## Final word

Not a guaranteed win — nothing is. It is the best risk-adjusted shot: the differentiation is real and verifiable, the demo cannot be killed by an API, the build fits 2 developers with hours to spare for polish, and it is the only candidate that enters two prize pools at once.

---

## ADDENDUM (post-review of the official "Build it with AI" prompt pack)

The dashboard brief ships a complete build prompt for this statement (saved at `problemstatement/chase`): app "Baaki", Sharma Packaging persona, 13 specified screens, full money/GST rules, the escalation ladder, MSMED letter, forecast, TDS flags — and explicit acceptance checks. Consequences:

1. **Recommendation unchanged** — the pack raises every team's floor but caps the median at its own baseline: *frontend-only, localStorage, no backend, wa.me links*. **Verified:** all 7 statements carry a 15–29KB prompt pack in the official problem data, and every pack uses the same frontend-only/localStorage baseline (server bits are optional add-ons). The commoditization is event-wide, so relative ranking holds.
2. **Differentiation strategy replaced.** The ladder/letter/forecast are no longer differentiators between teams — they're the handout. New differentiation stack, in order:
   - **Real automation**: Node backend + Render Workflow daily tick actually advancing ladders and sending real emails (the pack's optional add-on, which most teams skip) → also the Render-track qualifier.
   - **Anti-clone identity**: different name, different business persona (not Baaki/Sharma Packaging), different seed data, distinct visual identity.
   - **Pass every acceptance check in the pack** — judges have the same checklist (₹10,000@18% splits, GSTIN check digit, ladder pause rules, 6 bank-CSV cases, week-to-week forecast consistency). Most one-shot builds will fail several.
   - **One add-on beyond the pack** if green: invoice-from-photo (AI OCR with review screen) or Marathi as a third language.
3. **The pack validates feasibility** (organizers expect a lone no-coder to one-shot the baseline) and confirms our MSMED interest formula (3× RBI bank rate, compound, monthly rests) and the ≤45-day rule.
