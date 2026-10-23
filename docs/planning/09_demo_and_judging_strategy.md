# Demo & Judging Strategy

## Demo script (≤3-minute video; same flow live)

1. **Hook (0:00–0:20).** "Indian small businesses are owed ₹7.34 lakh crore in late payments. Meet Sharma Industries — profitable on paper, ₹14.2L stuck in receivables, rent due in 3 weeks." Dashboard already open, seeded.
2. **The problem made visible (0:20–0:50).** Aging view: 61% of receivables >45 days. Click worst customer: thread shows two ignored polite reminders.
3. **The ladder (0:50–1:50).** Open invoice INV-042 (62 days overdue). Timeline shows auto-sent gentle + firm reminders with timestamps from the scheduler. Demo clock on: the invoice crosses the next threshold *on camera* → status flips to "Demand letter" → open the generated PDF: MSMED §15/§16 reference, interest table computed at 3× bank rate, total demand. "No lawyer wrote this. No one even clicked."
4. **Seeing the future (1:50–2:20).** Forecast: red shortfall week 4 of ₹1.8L. Toggle "if top 3 demand-letter invoices collect" → gap closes. "The owner acts three weeks early instead of discovering it at the bank."
5. **Close (2:20–3:00).** One architecture beat: "every escalation you watched is a Render Workflow tick — it runs while the owner sleeps." Non-goals honesty line. "Vasooli: reminders in week one, statutory teeth in week seven, and the cash crunch seen coming."

**Failure drills:** live URL down → local build (same seed); PDF viewer issue → pre-opened copies in tabs; judge asks to try it → seed-reset button gives a clean org in 5 s.

## Mapping to the five official criteria

| Criterion | What we say/show |
|---|---|
| Innovation | comparison slide: Vyapar/myBillBook stop at reminders, Chaser costs £135+/mo, nobody does MSMED escalation — "we built the missing rungs" |
| Technical Execution | state machine + cron workflow + tested statutory math + generated documents; architecture slide; offer to open the repo |
| Design & UX | one-screen dashboard an owner reads in 10 s; thread metaphor; Hindi toggle if shipped |
| Impact | ₹7.34 L-cr (sourced, dated); Samadhaan <1% coverage; per-business DSO math on demo data |
| Presentation | the 3-minute arc above; every claim sourced on-slide |

## Pitch deck (7 slides)

1 Title+one-liner · 2 Problem (₹7.34 L-cr, owner story) · 3 Why existing tools stop short (Vyapar/Chaser/Zoho table) · 4 Product: the escalation ladder (screenshot) · 5 Live architecture (Render workflow highlighted) · 6 Impact + honesty (what's simulated, non-goals, disclaimers) · 7 Next steps (real WhatsApp API, e-invoice IRN, Samadhaan e-filing) + team.

## Anticipated judge questions (prepare answers)

- "How is this different from Vyapar?" → slide 3; ladder + forecast; Vyapar is invoicing, we are collections.
- "Is the demand letter legally valid?" → it's a §15/§16-compliant *demand*, not a statutory notice; disclaimer footer; Samadhaan is the formal route and we pre-fill its guidance.
- "Is the interest math right?" → show unit tests + Act citation.
- "What's real vs simulated?" → everything computes for real; message *delivery* is simulated (thread UI), email optional-real; data seeded.
- "Why would an MSME trust this?" → escalation is opt-in per rung; drafts are editable before send.

## Phase-8 skeptical-judge review of this very plan (self-applied)

- Scores (official criteria): Innovation 7.5, Tech Exec 9, UX 8, Impact 8.5, Presentation 8.5 → strong but not jury-proof.
- **Weakest parts:** (1) Innovation reads as "workflow automation", not invention — mitigation: lead every touchpoint with the *statutory* step, which no rival has; (2) emotional resonance below the social-impact entries — mitigation: open on the owner who can't pay salaries, not on software; (3) forecast could be dismissed as a heuristic — mitigation: show the formula, call it transparent by design.
- **What would make it more compelling if time remains:** real email send (judges receiving a live reminder during Q&A is a mic-drop), Hindi UI toggle, dispute flow.
- **Re-check vs alternatives after this review:** Accountability still loses on 2-person delivery risk; mParivahan still loses on crowd. **Recommendation unchanged.**

---

## ADDENDUM — after reading the official prompt pack

- Judges will watch multiple near-identical "Baaki" demos following the pack's own demo script. **Do not run that script's order.** Open with what clones can't show: a terminal/log view of the Render Workflow tick firing at 10:00 IST and a real email landing in an inbox on camera — then the dashboard.
- New anticipated question: "Did you just run the organizer's prompt?" → answer: "The handout is our baseline — here's what it can't do: it has no server, nothing actually sends, nothing runs while you sleep. Ours does; here are the logs. We also pass every acceptance check in the handout — most one-shot builds don't."
- Keep one slide: "Handout baseline vs ours" (localStorage → Postgres; wa.me tap → scheduled real sends + audit log; print-to-PDF → generated documents; same-for-everyone seed → our persona).
