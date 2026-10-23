# HackCache '26 — Verified Overview

Analysis date: 2026-10-22. All facts below pulled from the official event API (`cachedinfo.in/api/hackathon/hackcache`), the logged-in dashboard, and the official guides, unless marked otherwise.

## Verified facts

| Item | Value | Source |
|---|---|---|
| Event | HackCache '26, by CachedInfo × GCET Jammu | event API `hero`, marquee |
| Format | Fully online, 48 hours | FAQ |
| Dates | Hackathon 23–25 Oct 2026, 9:30 PM – 9:30 PM (IST implied) | event API `keyDates` |
| Problem statements released | Oct 22, 2026 12:00 AM IST (revealAt 2026-10-21T18:30Z) | `keyDates`, `problemsReveal` |
| Team size | 1–3 members | FAQ |
| Prizes | ₹80,000 cash (1st ₹27k, 2nd ₹21k, 3rd ₹17k) + internships, trip, LORs from all 6 judges, mock interviews | `prizeTiers` |
| All-submitters perks | Verified certificate, AI prompt packs, pitch templates, n8n pro ($60) | `allTeamsPerks` |
| Judges | 6 — Shubham Gaur (PM, Metropolis Healthcare), Dr. Nitigya Sambyal (Thapar), Dr. Simmi Dutta (HoD CSE, GCET Jammu), Rutvik Gupta (Product Owner, Aditya Birla Capital), Dr. Yugaanshu Ticku (Data Science, Sharda), Ankush Kapoor (C-DAC) | `judges` |
| **Official judging criteria** | **Innovation, Technical Execution, Design & UX, Impact, Presentation** — "same five criteria", scored online by all 6 judges after the deadline. **No numeric weights published.** | guide "Your first hackathon" (official) |
| Submission | 4 links from the dashboard: GitHub repo, live project link, demo video, pitch deck. "Submitting is final." | guide "Your first hackathon" |
| Per-statement evaluation focus | Each brief lists its own evaluation-focus line (see inventory) | problem briefs |
| Tech restrictions | None. AI allowed explicitly; no-code allowed; "you do need to be able to explain what you built" | guide, FAQ |
| Build-fresh rule | Project built during the 48h; pre-existing work must be declared | open-innovation brief "Important" |
| Bonus track | **Render track**: deploy on Render + use Render Workflows → extra prizes ($500/$300/$100 credits; $50 every participant). Judged on: innovation, effective use of Render Workflows, technical implementation, real-world impact, UX. Render URL goes in the demo-link field. | event API `narrativeBlocks` |

## Ambiguities / unresolved (confirm in dashboard or WhatsApp group)

1. **Exact deadline wording conflict.** `keyDates` says 23–25 Oct, 9:30 PM–9:30 PM. The guide says "Friday 23 October, midnight IST: the 48 hours begin … Saturday 24 October, before midnight IST: submit" — that's internally inconsistent (24h) and conflicts with keyDates. Treat **Sun 25 Oct 9:30 PM IST** as the planning deadline, confirm officially, and plan to submit ≥1h early.
2. **Demo video length.** Guide says "up to 5 minutes"; the open-innovation brief says "up to 3 minutes". Make a ≤3-minute video — satisfies both.
3. **Judging weights** are not published; assume the five criteria are roughly equal. (Our internal selection weights are our own, not the organizer's.)

## Team facts (provided by Ved)

- 2 members, both able to build; comfortable across React/Next.js+Node, Python (FastAPI/Django), Flutter/RN, AI app builders.
- AI API access: "CSI key" (unclear — plan assumes free tiers only; an LLM key upgrades one feature, nothing depends on it).
- Constraint: **no healthcare problems** → statements 2 (hospital queue) and 5 (menstrual health) excluded from selection, though analyzed for completeness.
- No theme preference: pick purely on winning odds.
