# Scoring Matrix

**These are our internal selection weights, not the organizer's.** Official criteria (Innovation, Technical Execution, Design & UX, Impact, Presentation) have no published weights; a separate official-criteria read is at the bottom.

Internal weights: Impact 20% · Innovation/differentiation 20% · Technical-execution feasibility 20% · UX & completeness 15% · Demo potential 10% · Delivery feasibility (2 devs, 48h) 10% · Competitive positioning 5%.

| # | Statement | Imp | Inn | Feas | UX | Demo | Deliv | Comp | **Weighted /100** | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Invoice Chase | 8 | 7.5 | 9 | 8 | 9 | 9 | 7 | **82.5** | High |
| 5 | Menstrual Health *(excluded)* | 8 | 7 | 8 | 8 | 7 | 8 | 7 | 76.5 | Med |
| 6 | Govt Accountability | 9 | 8.5 | 6.5 | 7 | 8 | 6 | 8 | **76.5** | Med |
| 2 | Hospital Queue *(excluded)* | 8.5 | 7 | 7 | 7.5 | 8 | 7 | 7 | 74.75 | Med |
| 3 | Digital Banking | 7 | 5.5 | 9 | 8.5 | 7 | 9 | 5 | **74.25** | High |
| 1 | mParivahan | 7.5 | 6 | 8.5 | 8 | 7 | 8.5 | 5 | **74.0** | High |
| 7 | Open Innovation | 6 | 6 | 7 | 7 | 7 | 7.5 | 6 | 66.0 | Low |

Differences under ~1.5 points are noise — treat 1/3 (and excluded 2/5 vs 6) as ties. The gap between #4 and the field (~6+ points) is larger than the noise band.

## Score justifications (selected)

- **Invoice Chase — Impact 8:** ₹7.34 L-cr delayed payments is among the largest citable numbers in the whole event, but users are businesses, not "everyone" (emotive ceiling). **Innovation 7.5:** invoicing is old; the MSMED escalation ladder + affordable forecasting is new in India (verified absence). **Feasibility 9:** deterministic CRUD/logic/PDF, zero fragile APIs, simulated data blessed by the brief. **Demo 9:** every feature produces a visible, real artifact (letter PDF, state change, chart). **Deliv 9:** cleanly splits across 2 devs. **Comp 7:** crowded commercial space, but few hackathon teams will go legal-layer deep; most teams in this track will pick #3 (easier).
- **Govt Accountability — Innovation 8.5 / Impact 9:** best story + verified systemic failure. **Feasibility 6.5 / Deliv 6:** 8-subsystem brief; a 2-person team must cut 60% of it and still build timers, hash chain, hierarchy, profiles, legal directory. **Comp 8:** fewer, shallower rivals.
- **mParivahan — Comp 5:** headline statement of the headline track; expect the most entries; UX-redesign builds cluster at "prettier portal + chatbot" [I]. **Innovation 6:** guided flow + quiz + chatbot are all well-trodden.
- **Banking — Innovation 5.5:** a standardization exercise is design, not invention; **Feas/Deliv 9:** nothing can fail. **Comp 5:** easiest statement → biggest pile of similar mockups [I].
- **Open Innovation 66:** no pre-validated idea in hand; evidence requirement consumes build time; Low confidence because a great pre-existing idea would change everything.

## Under the official criteria (equal-weight assumption)

| Statement | Innovation | Tech Execution | Design & UX | Impact | Presentation | Mean |
|---|---|---|---|---|---|---|
| Invoice Chase | 7.5 | **9** | 8 | 8.5 | 8.5 | **8.3** |
| Govt Accountability | 8.5 | 7 | 7 | 9 | 8.5 | 8.0 |
| mParivahan | 6 | 7 | 8.5 | 7.5 | 7.5 | 7.3 |
| Banking | 5.5 | 6.5 | 8.5 | 7 | 7.5 | 7.0 |

Tech Execution is where a 2-dev team beats the field: most submissions will be AI-builder UIs over mock data (the organizer's own guides push Lovable/Bolt). A real state machine + scheduled jobs + correct statutory math + generated documents is a visible execution gap. Same winner under both frameworks.

## Missing info that could change ranking

- What "CSI key" is (if it's a strong LLM key, AI-heavy directions in #6 get cheaper — doesn't flip the order).
- Judges' per-criterion weights (unpublished).
- If the team had a pre-validated open-innovation idea with reachable users, #7 would need rescoring.
