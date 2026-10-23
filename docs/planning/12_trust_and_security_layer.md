# Trust & Security Layer — "Evidence-Grade by Design"

**The thesis that makes this impressive instead of a checkbox:** our product's endgame is a legal escalation. A demand letter and an ODR filing bundle are only as persuasive as the integrity of the records behind them. So security and compliance aren't decoration here — they're what makes the core artifact credible. One pitch line: *"We don't just chase money — we produce records a tribunal can trust."*

## 1. Tamper-evident audit chain (the centerpiece)

- Every event (invoice created/edited, reminder sent, promise recorded, dispute raised, letter generated, payment matched) appends to a **SHA-256 hash chain**: `entry_hash = SHA256(prev_hash + canonical_json(event))`. Stored beside the event row.
- Every demand letter and ODR bundle footer prints the chain-head hash + a **QR code linking to `/verify/:hash`** — a public page that shows the entry, its timestamp, and whether the chain verifies. **Demo moment: a judge scans the QR on the letter and sees "Record verified — unaltered since 24 Oct, 10:02 IST."**
- Why it matters legally: the ODR bundle's timeline (reminders, dispute windows, promise dates) is exactly what an MSEFC/conciliator weighs; a verifiable chain is a genuine advancement over every incumbent (none of Vyapar/myBillBook/Recordent/Vasuli evidences this).
- Not blockchain. Say so proudly: "a hash chain — the honest 48-hour version of evidence integrity."
- Build cost: ~2h engine + 1h verify route/QR.

## 2. DPDP-aligned data handling (feature → principle map)

Context for the deck (verified): DPDP Act 2023; **DPDP Rules notified 13–14 Nov 2025, phased over 12–18 months — full obligations by ~May 2027.** Every Indian SMB tool must get ready; none of our researched competitors markets it. **Wording rule: "designed to DPDP principles" — NEVER "DPDP compliant/certified"** (enforcement is phased; overclaiming is a judge-trap).

| DPDP principle | Our concrete feature (demoable) |
|---|---|
| Notice & purpose limitation | Customer pay-page footer: what data the business holds (name, contact, invoice history) and the single purpose (dues communication). Notice text in EN + customer's preferred language. |
| Data minimization | Contact model = name, phone, email, GSTIN, language. Nothing else collected; no trackers on the pay page. |
| Correction & erasure **with statutory carve-out** | "Delete customer data" anonymizes PII (name→`Customer #A4F2`, contact wiped) while **retaining the invoice ledger, because CGST Act s.36 requires records kept ~72 months** ⚠(verify section/period Fri). Showing we understand the DPDP-vs-GST retention tension is the sophistication moment — most teams will either hard-delete (breaks tax law) or ignore erasure (breaks DPDP). |
| Consent withdrawal / opt-out | Per-contact "do not message" flag; the dunning engine honors it and converts sends into "call instead" tasks. One line in every message footer: how to opt out. |
| Portability | One-click export of a customer's data (JSON/CSV). |
| Breach readiness | The audit chain doubles as the breach-investigation log; roadmap slide: Data Protection Board notification workflow. |
| Security safeguards (Rules' "reasonable safeguards") | Below. |

## 3. Security safeguards (48h-honest)

- **Field-level encryption** (AES-256-GCM, app-layer middleware) for phone/email at rest; key in env.
- Pay links: **128-bit random tokens, 30-day expiry, revocable** per invoice; rate-limited verify/claim endpoints; "already paid" claims require a reference and land in the confirm-gated inbox (no self-service state change).
- TLS by default (Render); secrets only in env (+`.env.example`); **no PII in logs**; ORM-parameterized queries; React's XSS-safe rendering; CSV export sanitized against formula injection (`=`,`+`,`-`,`@` prefixes).
- Threat-model mini table (deck appendix): token guessing → entropy+expiry · log tampering → hash chain · PII leak → encryption+no-log · fake "paid" claim → confirm gate · email abuse → 1/customer/day cap + opt-out · CSV injection → sanitization.
- Explicit non-claims (honesty slide): no auth/multi-tenant in MVP, no pen-test, demo keys rotated after event.

## 4. Sponsor synergy (15 LOC, big smile)

Outbound **webhook on escalation events** (configurable URL) — demoed firing into **n8n** (HackCache's in-kind sponsor; every team got n8n pro): "plug your own automations into Taqaada — here it posts each demand-letter event to an n8n flow." One POST call; zero risk.

## 5. Plan integration (deltas applied to 10_build_plan.md)

- Layer 2 additions: hash-chain + `/verify/:hash` QR (Dev A, Sat 2–7 PM block, +3h), field encryption middleware (+1h), DPDP strings/opt-out flag/anonymize-delete/export (Dev B, Sat 7–11 PM, +1.5h), n8n webhook (should-have top).
- Paid-for by demoting LLM-tone drafting to last Layer-3 item and trimming what-if toggles to two.
- Acceptance additions: (a) manually editing an event row makes `/verify` fail; (b) opted-out contact never receives an email on an unattended run; (c) anonymize-delete keeps ledger totals identical; (d) pay-link token expired/revoked → friendly error, no data.
- Demo beat 4 now ends with the QR-scan verification on the ODR bundle. Deck gains one "Trust by design" slide (the table above, compressed) + threat-model appendix.
- Pitch close upgraded: "Chases politely, escalates lawfully, remembers everything — on records a tribunal can trust, handled the way the DPDP Act will soon require of every tool in this market."

## 6. What we deliberately do NOT add (asked and answered)

Consent-manager integration (Rules give it 12 months; roadmap), India data-residency hosting (Render has no Mumbai region — roadmap line: "production target: AWS ap-south-1"), DPO designation, SOC2 language, blockchain. Each is one sentence on the roadmap slide — showing we know the full landscape but scoped like adults.
