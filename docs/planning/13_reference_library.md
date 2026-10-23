# 13 — FullPay Reference Library

**Status (Fri 23 Oct 2026, Day 0):** planning complete · research complete · **0 lines of code** · kickoff **tonight 9:30 PM IST** · build starts on team approval of this document + dossier §0.

How to read this file:

| Part | Answers |
|---|---|
| A | What we have done so far |
| B | What we researched — 144 sources in 4 buckets, verified 22 Oct 2026 |
| C | What is novel, what is not |
| D | Values to pin in `config` |
| E | Rev F — corrections the research forces on the LLD / build plan |
| F | Day-0 checklist, repo plan, open questions for the team |

Verdict legend used throughout: **COPY** = permissive licence, paste ≤20 lines with notice · **READ** = GPL / AGPL / unlicensed / other language — pattern only, never paste · **SKIP** = don't add · **DATA** = value to pin · **UNVERIFIED** = primary source could not be opened.

---

## Part A — What we have done so far

### A1 Event intelligence (verified via the official API, 21–22 Oct)

| Fact | Value |
|---|---|
| Event | HackCache '26 · CachedInfo × GCET Jammu · fully online · 48 h |
| Window | Fri 23 Oct 9:30 PM → **Sun 25 Oct 9:30 PM IST** (guide text says "Saturday 24 October, before midnight" — **confirm tonight**; contingency: freeze Sat 6 PM, video 7–9 PM, submit Sat 10:30 PM) |
| Criteria | Innovation · Technical Execution · Design & UX · Impact · Presentation (no weights; 6 judges, async online) |
| Submission | 4 links: GitHub repo · live URL · video ≤3 min · deck. "Submitting is final." |
| Bonus track | Render: deploy on Render **and** use Render Workflows → $500/$300/$100 credits; $50 to every participant |
| Sponsor | n8n Pro team voucher (claim by 1 Nov) |
| Prompt pack | Every team gets the same 16-section "Build it with AI" pack (frontend-only, localStorage, app "Baaki", Sharma Packaging Pune). Its BEFORE-YOU-FINISH checklist = our acceptance suite. |
| Build-fresh rule | Project built during the 48 h; pre-existing work must be declared → planning docs are declared in the README, code starts after 9:30 PM |

### A2 Selection

- 7 statements analysed (`01_…` to `06_…`). Healthcare (#2 hospital queue, #5 menstrual health) excluded by team choice.
- **Chosen: PS4 "The Small Business Invoice Chase" — 82.5/100** on our internal weights (Impact 20 / Innovation 20 / Feasibility 20 / UX 15 / Demo 10 / Delivery 10 / Competitive 5 — ours, not the organiser's).
- Backup: PS6 Government Accountability — 76.5.
- Why PS4 wins: real money (₹7.34 → ₹8.1 lakh crore stuck), a strong law nobody operationalises, a fresh legal shift (Samadhaan → ODR, 15 Oct 2025), a pack whose ceiling is easy to clear with a real backend, and a demo that fits 3 minutes.

### A3 Design set (all adversarially reviewed and cross-synced)

| File | What it is | Rev |
|---|---|---|
| `00_hackathon_overview.md` … `09_demo_and_judging_strategy.md`, `sources.md` | Selection analysis set | final |
| `10_build_plan.md` | **Locked** build plan: hours, stack, must/should, demo seed, production stance | E → **F** (this research) |
| `11_prompt_pack_review.md` | Section-by-section map of the 16-section pack to our build | final |
| `12_trust_and_security_layer.md` | Hash chain + QR verify, DPDP map, threat model | final |
| `report.html` | Selection report (artifact) | v4 |
| `dossier.html` | Build dossier for team review — §0 is the sign-off | v5 / Rev E |
| `hld.html` | High-level design | Rev B |
| `lld.html` | Low-level design: schema, algorithms, API, seed, tests | Rev B |
| `explainer.html` | Plain-language problem → six jobs → stack → one-liner | v2 |
| `13_reference_library.md` | **This file** — research synthesis + Rev F deltas | new |
| `briefs/`, `problemstatement/chase` | Official statement texts (byte-identical to API, updatedAt 2026-10-21) | — |

### A4 Decisions locked

- **Name: FullPay.** "Every -Pay app helps you pay. FullPay is for getting paid — in full." Rejected: Vasooli (collision), Payfull (Turkish gateway), Taqaada/Chukta/Bakaya/Poora/PaidFull/ZeroDue.
- **Persona/seed:** Arora Auto Components, Ludhiana (Udyam small enterprise), 14 customers (Haryana IGST, unregistered, NULL-terms cases), ~40 invoices, `INV/26-27/0042` pinned at demand-letter rung with a fixed hash (QR target), bank CSV with the pack's 6 matching cases + debit + malformed row. Never demo as "Baaki".
- **Stack:** Next.js App Router (plain JS) + Postgres on Render · Render cron (04:30 UTC) → Render Workflow → `POST /api/tick` · cron-job.org keep-alive / nightly reseed / tick fallback · Resend email · Invoify (MIT) invoice UI · shadcn/ui · recharts · to-words · papaparse · fuse.js · qrcode · react-to-print + `@page` A4 CSS (jsPDF banned: ₹ and Devanagari) · node `crypto` SHA-256 · `node:test`. GPL repos read-only. LLM only behind a flag for tone drafting — "No LLM in the money path, by design." n8n webhook output-only.
- **Money & time invariants (LLD):** integer paise `Number` end-to-end, rates in bps, `qty_milli`, dates only via `lib/time.js`, errors `{error:{code,message}}`.
- **Ladder:** six rungs; auto email only for heads-up / due-date; +7 / +15 are one-tap owner sends (wa.me / mailto / sms); letter and ODR bundle are owner-initiated; customer dispute pauses rungs; interest stops only when the owner accepts the dispute; max one advance per tick; tick is one transaction under an advisory lock.
- **Production stance:** production-*shaped* in 48 h (real DB, auth boundary, transactions, idempotent jobs, tests, deployed) + a path-to-production slide.
- **Scope rule:** plan is frozen; new scope only if both teammates agree the demo is at risk.

### A5 Research sweep (this document)

Four parallel research passes on 22 Oct 2026, every item opened and licence-checked: **Infrastructure 37 · Borrowable code 45 (two passes merged) · Compliance & law 30 · Product/UX/prior art 32 = 144 sources.** Outcome: no new runtime dependency is needed; ~10 snippets are copy-safe; 30 corrections to the LLD/plan (Part E), the biggest being a wrong RBI rate in the spec.

### A6 Not done yet

Code · git repo · Render account/services · Resend domain DNS · n8n voucher claim · demo video · deck · team sign-off on dossier §0 and on Part E below.

---

## Part B — Research library

### B1 Infrastructure & deployment (37 sources)

#### Render Workflows — the bonus-track qualifier

| Source | Status / licence | Verdict | What we take |
|---|---|---|---|
| [Workflows intro](https://render.com/docs/workflows) | GA, Flex billing since 1 Sep 2026 | DATA | "Workflows do not yet natively support scheduling" → the **cron → Workflow hop is required**. Triggers: SDK, REST, CLI, Dashboard. Max run 24 h. |
| [Defining tasks](https://render.com/docs/workflows-defining) | current | pattern | `task()` options; `@renderinc/sdk ^1.0`; args ≤4 MB; default timeout 2 h (30 s–24 h); **retries default 3** (1 s, doubling); chaining only inside one service |
| [Triggering runs](https://render.com/docs/workflows-running) | current | pattern | `workflows.startTask(slug, input)` → `await result.get()`; `RENDER_API_KEY` auto-detected; slug `{workflow-slug}/{task-name}`; REST body `{task, input}` |
| [TypeScript SDK reference](https://render.com/docs/workflows-sdk-typescript) | current | doc | `name` (required), `timeoutSeconds` 30–86400, `plan` default flex, `retry {maxRetries, waitDurationMs, backoffScaling}` |
| [Limits & pricing](https://render.com/docs/workflows-limits) | current | DATA | Flex $0.20/CPU-h + $0.05/GB-h, min charge 1 s at 0.1 CPU; 50 root runs/min (Hobby); 500 task defs; **no free tier** — a daily 2 s run ≈ ₹0 |
| [Quickstart](https://render.com/docs/workflows-tutorial) | current | doc | `render workflows init`; Dashboard → New → Workflow; Start Task with input `[]` |
| [Blog: pricing change / GA](https://render.com/blog/upcoming-changes-to-workflows-pricing) | 10 Aug 2026, effective 1 Sep | doc | Flex replaces Starter/Standard |
| [render-oss/sdk](https://github.com/render-oss/sdk) | MIT (npm metadata) | COPY | `import { task } from "@renderinc/sdk/workflows"`; `new Render({ token })`; `render.workflows.runTask("wf/task", [...])` |
| [@renderinc/sdk on npm](https://registry.npmjs.org/@renderinc/sdk/latest) | 1.4.0, MIT, Node ≥18, CJS+ESM | tool | Plain JS works; deps redis, eventsource, openapi-fetch |
| [render-workflows-examples-ts](https://github.com/render-examples/render-workflows-examples-ts) | **no LICENSE file** | READ | Shape only: `task({ name:"calculateSquare" }, (_ctx, a) => a*a)`; `"type":"module"`; rewrite in plain JS |
| [REST: POST /v1/task-runs](https://api-docs.render.com/reference/createtask/) | current | COPY | The whole cron job is one curl (below); 202 with `id/status`; optional `idempotencyKey` |

Workflow task (plain JS, our only Workflow code):

```js
import { task } from "@renderinc/sdk/workflows";
task({ name: "daily-tick", timeoutSeconds: 120, retry: { maxRetries: 0 } }, async () =>
  fetch(process.env.APP_URL + "/api/tick", {
    method: "POST", headers: { "x-tick-secret": process.env.TICK_SECRET },
  })
);
```

Cron job start command (zero dependencies):

```
curl -fsS -X POST https://api.render.com/v1/task-runs \
  -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json" \
  -d '{"task":"fullpay-workflows/daily-tick","input":[]}'
```

Gotcha: the Blueprint spec lists `type: workflow`, but the intro says "no Blueprint replication yet". If `render blueprints validate` rejects it, create the Workflow in the Dashboard and keep `render.yaml` for web + db + cron.

#### Render platform / render.yaml

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [Blueprint YAML spec](https://render.com/docs/blueprint-spec) | current | COPY | `type: cron` + `schedule: '30 4 * * *'` (UTC); `fromDatabase: {name, property: connectionString}`; `generateValue: true` (SESSION_SECRET, TICK_SECRET); `sync: false` (RESEND_API_KEY, OWNER_PASSWORD, RENDER_API_KEY); database `plan: free` |
| [Deploy Next.js SSR + API routes](https://render.com/articles/how-to-deploy-next-js-applications-with-ssr-and-api-routes.md) | 25 Nov 2025 | COPY | web service: runtime node, `npm install && npm run build`, `npm start`, `healthCheckPath: /api/health`; Node 20/22 |
| [render-examples/nextjs-hello-world](https://github.com/render-examples/nextjs-hello-world) | licence not shown | READ | render.yaml shape only (Pages Router) |
| [Cron jobs](https://render.com/docs/cronjobs) | current | DATA | **≥$1/month** per cron; UTC; one active run (late runs delayed, not skipped); killed at 12 h; manual "Trigger Run" |
| [Free tier](https://render.com/docs/free) | current | DATA | **Free Postgres expires 30 days after creation** (+14 d grace, then deleted), 1 GB, one per workspace → create it today; free web spins down after 15 min idle (~1 min cold start) → **Starter for judging** (covered by the $50 participant credit) |
| [Postgres connection strings](https://render.com/tutorials/postgres-on-render/connection-strings) | current | doc | Internal URL has no `sslmode`; external needs `?sslmode=require` (TLS 1.2+) for laptop/CI |

Pin Node via `.node-version` (20 or 22).

#### Resend (transactional email)

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [Send with Next.js](https://resend.com/docs/send-with-nextjs) | current | COPY | Route handler; `resend.emails.send({from,to,subject,html})` **returns `{data,error}` — errors are not thrown** |
| [resend-nextjs-app-router-example](https://github.com/resend/resend-nextjs-app-router-example) | MIT | READ | Layout: `app/api/send/route`, `components/email-template`, `.env.example` |
| [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) | current | pattern | 2nd arg of `send()`; 1–256 chars; 24 h window; same key + different body → 409 `invalid_idempotent_request`; in-flight → 409 `concurrent_idempotent_requests` → key = `outbox-<id>-<attempt>` |
| [Add a domain](https://resend.com/docs/add-a-domain.md) | current | doc | DKIM + SPF TXT + MX on the `send.` subdomain, records exactly as generated (Cloudflare: DNS-only); "often within 15 minutes", worst 72 h; "Restart verification" button |
| [403 with resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) | current | DATA | `onboarding@resend.dev` delivers **only to the account owner's own inbox** → a **verified domain is mandatory** for demo recipients |
| [Pricing](https://resend.com/pricing) | current | DATA | Free: 100/day, 3,000/month, 3 domains |
| [API intro](https://resend.com/docs/api-reference/introduction) | current | DATA | 10 req/s per team → 429 → outbox `flush()` stays serial |

#### node-postgres / PostgreSQL

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [pg: Transactions](https://node-postgres.com/features/transactions) | MIT | COPY | `pool.connect → BEGIN → COMMIT / ROLLBACK → release` block verbatim as `withTxn()`. "Do not use transactions with the pool.query method." |
| [pg: Data types](https://node-postgres.com/features/types) | MIT | DATA | **DATE/TIMESTAMP become JS `Date` in process TZ by default** → override OID 1082 so DATE stays `'YYYY-MM-DD'` (otherwise `lib/time.js` breaks) |
| [pg: Pool](https://node-postgres.com/apis/pool) | MIT | doc | defaults max 10, idle 10 s; always release; add `pool.on('error')` or idle-client errors crash Node |
| [pg: SSL](https://node-postgres.com/features/ssl) | MIT | doc | `sslmode` in the URL *replaces* any `ssl` object — use one or the other |
| [pg-types](https://github.com/brianc/node-pg-types) | MIT | COPY | OIDs: INT8 **20**, NUMERIC **1700**, DATE **1082**, TIMESTAMP 1114, TIMESTAMPTZ **1184**, INT4 23, BOOL 16; int8 is a string by default |
| [PG advisory lock functions](https://www.postgresql.org/docs/current/functions-admin.html) | PostgreSQL | pattern | `pg_advisory_xact_lock(bigint)` waits; `pg_try_advisory_xact_lock(bigint) → boolean` for the tick's 409 path; `hashtext()` is undocumented → use constants (42 chain, 7 tick) |
| [PG explicit locking §13.3.5](https://www.postgresql.org/docs/current/explicit-locking.html) | PostgreSQL | doc | Transaction-level locks auto-release at COMMIT/ROLLBACK; never combine an advisory lock with `LIMIT` in one query |

```js
import pg from "pg";
pg.types.setTypeParser(20, Number);      // INT8  → paise as Number
pg.types.setTypeParser(1700, Number);    // NUMERIC
pg.types.setTypeParser(1082, v => v);    // DATE stays 'YYYY-MM-DD'
pg.types.setTypeParser(1184, v => v);    // TIMESTAMPTZ stays ISO string
```

#### cron-job.org (free scheduler: keep-alive, nightly reseed, tick fallback)

| Source | Verdict | What we take |
|---|---|---|
| [cron-job.org FAQ](https://cron-job.org/faq/) | DATA | Free; 1-min granularity; POST body + custom headers (not User-Agent/Connection) → `x-tick-secret` works; **30 s timeout** → `/api/reseed` must answer 202 first, then work; auto-disables after **25 consecutive failures**; response bodies stored 2 days → **return no secrets**; 64 KB cap |

#### Next.js 16 auth boundary

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [Authentication guide](https://nextjs.org/docs/app/guides/authentication) | updated 16 Sep 2026 | COPY | `proxy.js` cookie check + matcher; `cookies().set` options; proxy "should not be your only line of defense" |
| [proxy.js convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) | v16 | DATA | **`middleware.js` is deprecated → `proxy.js`** (codemod `npx @next/codemod@canary middleware-to-proxy .`); Node runtime; matcher must be a literal; `_next/data` always hits proxy |
| [cookies()](https://nextjs.org/docs/app/api-reference/functions/cookies) | async since v15 | doc | `await cookies()`; `.set/.delete` only in Route Handlers / Server Functions |
| [Upgrade to v16](https://nextjs.org/docs/app/guides/upgrading/version-16) | updated 15 Oct 2026 | doc | Node ≥20.9; sync `cookies()` removed; Turbopack default; `next lint` removed; `runtimeConfig` removed → env vars |
| [Vercel postmortem CVE-2025-29927](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) | patched 15.2.3 / 14.2.25 | DATA | `x-middleware-subrequest` header bypassed middleware on self-hosted `next start` → **re-check the session cookie inside every owner API route** |

```js
// proxy.js
import { NextResponse } from "next/server";
const ALLOW = ["/login", "/pay/", "/verify/", "/api/health", "/api/tick", "/api/pay/", "/api/verify/"];
export function proxy(req) {
  const p = req.nextUrl.pathname;
  if (ALLOW.some(a => p.startsWith(a))) return NextResponse.next();
  if (!req.cookies.get("session")?.value) return NextResponse.redirect(new URL("/login", req.nextUrl));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

**B1 gotchas that change the plan:** DATE parser (1082) · `proxy.js` not `middleware.js` · verified Resend domain is mandatory · free Postgres 30-day clock · Starter web for judging · cron ≥$1/mo · reseed must reply in <30 s · Workflow may need Dashboard creation.

---

### B2 Borrowable code (45 sources, two passes merged) — **no new runtime dependency**

#### Hash-chained audit log (`escalation_events`, `chain.js`, `/verify`)

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [Solana SDP `0047_audit_ledger_integrity.sql`](https://github.com/solana-foundation/solana-developer-platform/blob/main/apps/sdp-api/src/db/migrations/postgres/0047_audit_ledger_integrity.sql) | MIT (file 2026-08-07) | **COPY** | `sdp_reject_audit_log_mutation()` + BEFORE UPDATE/DELETE and BEFORE TRUNCATE triggers → Postgres itself keeps `escalation_events` append-only. Their comment: a chain alone cannot prove the newest rows weren't deleted (they park the head hash in Redis) → our answer is the **debtor-held anchor** (Part C). `/api/reseed` must `ALTER TABLE … DISABLE TRIGGER USER` first. |
| [Heimdall-DFIR `auditChain.js`](https://github.com/RaiseiX/Heimdall-DFIR/blob/main/backend/src/services/auditChain.js) | MIT (2026-09-24) | READ | Nearly our design: GENESIS `'0'×64`, `prev + '\n' + payload`, `pg_advisory_xact_lock`, verify walk. Copy the result shape `{ok, reason: chain_break / hash_mismatch, breakAtSeq}`. **BIGSERIAL gaps are not evidence of deletion.** They use HMAC; we keep plain SHA-256 so anyone can verify. |
| [NestJS hash-chain article](https://dev.to/elwin_ernst/building-a-tamper-evident-audit-log-in-nestjs-with-hash-chains-4l76) | none; repo no LICENSE | READ | Per-scope advisory lock at txn start (their `SELECT … FOR UPDATE` version failed ~55 % at concurrency 20); 4-check verifier: seq gaps, payload hash, prev link, chain hash |
| [PostgreSQL tamper-evident trails](https://appmaster.io/blog/tamper-evident-audit-trails-postgresql) | article | pattern | SQL second checker: `LAG(row_hash) OVER (ORDER BY id)` vs `prev_hash`, recompute with pgcrypto `digest(…,'sha256')`, flag `BROKEN_LINK` / `HASH_MISMATCH` — independent verifier for the demo |
| [Zero-dep SHA-256 chain article](https://dev.to/veritaschain/building-a-tamper-evident-audit-log-with-sha-256-hash-chains-zero-dependencies-h0b) | none | READ | Confirms `SHA-256(prev_hash + canonical)` with GENESIS sentinel = LLD §6 |

#### Canonical JSON (`canonicalize()`)

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785) | IETF | cite | Property names sorted by UTF-16 code units (= JS default `sort()`), no whitespace, NaN/Infinity must error. RFC *serialises* floats; ours **throws** — say so in the comment |
| [JCS test vectors (cyberphone)](https://github.com/cyberphone/json-canonicalization/tree/master/testdata) | Apache-2.0 | **COPY** | `input/weird.json`, `output/weird.json`, `input/french.json`, `output/french.json` as golden tests. A literal transcription of LLD §6 `canonicalize` matched both **byte for byte** on 22 Oct; float/Date inputs threw |
| canonicalize 5.1.0 · safe-stable-stringify 3.0.0 · json-stable-stringify 1.3.0 (5 deps) · fast-json-stable-stringify 2.1.0 (2019) · json-canonicalize 3.0.1 | Apache-2.0 / MIT | SKIP | None rejects floats or Dates; our 15-line function + the vectors above are enough |

#### UPI deep link (`upi.js`, QR on invoice / pay page)

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [NPCI UPI Linking Spec v1.6 draft, Nov 2017 (mirror)](https://www.labnol.org/files/linking.pdf) | **UNVERIFIED** (npci.org.in returned 403) | doc | Params: `pa` (M), `pn` (M), `am` (M for dynamic), `tn` (O), `cu` (O, INR), `tr` (C: merchant/dynamic), `mc`, `url`. Our `pa, pn, am, tn, cu` set is valid. Don't cite as authoritative until an official copy is found |
| NPCI Circular 37 (1 Nov 2017) | UNVERIFIED (not opened) | doc | Official anchor for the `upi://` scheme |
| [Google Pay India in-app payments](https://developers.google.com/pay/india/api/android/in-app-payments) | 2024-10-16 | reference | Lists `pa, pn, mc, tr, tn, am, cu, url`; defers to the NPCI spec |
| [upiqr `intent.ts`](https://github.com/bhar4t/upiqr/blob/main/src/qr/intent.ts) | MIT, 1.4.1, 0 deps | READ / SKIP install | Param mapping incl. `mam`, `tid`; rejects `pa` <5 or `pn` <4 chars; **`URLSearchParams` encodes a space as `+`** → test a `pn` with a space on 2–3 UPI apps. PNG-only output → useless for print; `qrcode` stays |
| [upi-parser](https://github.com/bupd/upi-parser) | MIT, 1.0.3, 0 deps | optional devDep | `parseUPI(str)` round-trips `upiString()` in one `node:test` (npm name `upi-parser`, README says `upiparser`) |
| upi-link 1.0.1 (2019) · @adityavijay21/upiqr | MIT | SKIP | stale / thin wrapper over qrcode |

#### GST data & e-invoice shape (`gst.js`, `einvoiceJson()`)

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [gst-states `index.json`](https://github.com/refrens/gst-states) | MIT (2.1.1) | **COPY** | 40 codes `{"01":"Jammu And Kashmir",…}` incl. 38 Ladakh, 97 Other Territory. **99 is labelled "Other Countries"; GSTN calls 99 "Centre Jurisdiction"** → relabel or drop; add **96**. CDN: `cdn.jsdelivr.net/gh/refrens/gst-states/index.json` |
| [GST e-invoice Master Codes](https://einvoice1.gst.gov.in/Others/MasterCodes) | official | DATA | Authoritative states: 1–38 except 28, plus 96, 97, 99. Also the **UQC unit codes** (KGS, LTR, PCS…) for the `invoice_items.unit` dropdown |
| [india-compliance `constants`](https://raw.githubusercontent.com/resilient-tech/india-compliance/develop/india_compliance/gst_india/constants/__init__.py) | GPL-3.0 | READ | Cross-check only (has 38 and 97, omits 99) |
| [hsn-code-package](https://github.com/karthi-21/HSN-Code-Package) | ISC in package.json, **no LICENSE file** | dev-time only | Pull ~15 `code, description` rows for the seed; don't ship 12,604 codes |
| [HSN_SAC.xlsx](https://tutorial.gst.gov.in/downloads/HSN_SAC.xlsx) | govt (668 KB, modified 2026-10-21) | DATA | Pick ~10 six-digit auto-parts codes for `db/seed.js` |
| [NIC sandbox: Generate IRN](https://einv-apisandbox.nic.in/version1.03/generate-irn.html) | official | **COPY shape** | draft-07 JSON Schema + sample inline → `db/einv-schema.json` + a shape test. `Version "1.1"`; sections `TranDtls, DocDtls, SellerDtls, BuyerDtls, DispDtls, ShipDtls, ItemList, ValDtls, PayDtls, RefDtls, AddlDocDtls, ExpDtls, EwbDtls`. `DocDtls.No` regex `^[a-zA-Z1-9][a-zA-Z0-9/-]{0,15}$` (`INV/26-27/0007` passes); dates `DD/MM/YYYY`; **amounts are rupee decimals — keep them out of `canonicalize`**; Seller `Pin` required; `Unit` is a UQC code. No IRN calls |
| [india-compliance `e_invoice.py`](https://raw.githubusercontent.com/resilient-tech/india-compliance/develop/india_compliance/gst_india/utils/e_invoice.py) | GPL-3.0 | READ | `get_invoice_data()` field mapping (SupTyp/RegRev, `RndOffAmt`) — ideas only |

#### Bank statement CSV (`recon.js`, `db/bank-statement.csv`)

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [burnrate `hdfc_bank_csv.py`](https://github.com/pratik-devx/burnrate/blob/main/backend/parsers/hdfc_bank_csv.py) | Apache-2.0 (2026-04-05) | **COPY** | Four header-synonym lists (`_DATE/_DESC/_DEBIT/_CREDIT_COL_NAMES`: "withdrawal amt.", "txn date", "transaction remarks", "particulars"…) with attribution → accept real exports. HDFC header: `Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance`; **DD/MM/YY** |
| [hdfc-pdf-converter](https://github.com/vishwaraja/hdfc-pdf-converter) | MIT | READ | Same positional columns; multi-line narrations |
| [Paisa HDFC fixture](https://github.com/ananthakumaran/paisa/tree/master/fixture/import/HDFC%20Account%20Statement) | **AGPL-3.0** | READ | Real export: `Date, Narration, Value Dat, Debit Amount, Credit Amount, Chq/Ref Number, closing balance`; space-padded; no thousands separators |
| [Firefly III import-configurations `in/`](https://github.com/firefly-iii/import-configurations/tree/main/in) | CC BY-SA 4.0 | READ | HDFC 7-column d-m-Y; ICICI: strip lines before the header and after the last txn; **first row is a zero-amount opening balance** → keep the `skipped[]` path with reasons |
| [bout (ICICI CSV→QIF)](https://github.com/codito/bout) | MIT | READ | col0 `DD-MM-YYYY`, col2 "Transaction Remarks", col3 Deposit, col4 Withdrawal; skip junk until header |
| [upi-transaction-parser](https://github.com/SurajMeena/upi-transaction-parser) | MIT | READ | ICICI UPI remark `UPI/<ref>/<note>/<vpa>/…` → use this narration shape in the seed CSV |
| SBI | — | SKIP | nothing verifiable |

Seed narrations should look like `UPI/52831…/INV 26-27 0007/acme@okaxis` and `NEFT CR-HDFC0001234-ACME PVT LTD-…`. Label the sample "HDFC-like".

#### Company-name normalisation (before fuse.js)

[cleanco `termdata.py`](https://github.com/psolin/cleanco/blob/master/cleanco/termdata.py) (MIT) — India list is only `ltd., pse, psu, pvt. ltd.`; adopt its "strip twice for stacked suffixes" tip. No package needed — one regex in `recon.js`: lowercase → strip `m/s`, `messrs`, `pvt`, `private`, `ltd`, `limited`, `llp`, `opc`, `&`, `and`, `co`, `company` and punctuation → apply twice → fuse threshold ≤0.35 (already specced).

#### Dunning / tick / state machine (`ladder.js`, `/api/tick`)

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [Kill Bill overdue config](https://docs.killbill.io/latest/overdue.html) | Apache-2.0 (Java/XML) | READ | Ordered states, `timeSinceEarliestUnpaidInvoiceEqualsOrExceeds`, `autoReevaluationInterval`, `isClearState`; state order matters and **all** conditions must hold; payment clears the state; **no interest at all** — validates "highest rung whose due + offset ≤ today" |
| [Advisory locks for distributed cron](https://dev.to/mukesh_13/postgres-advisory-locks-for-distributed-cron-killing-duplicate-job-runs-without-a-redis-dependency-1bfl) | article (Python) | COPY SQL | `SELECT pg_try_advisory_xact_lock(7) AS ok` inside the txn; `false` → 409; auto-releases on COMMIT/ROLLBACK |
| xstate 5.33.3 · pg-boss 12.38.0 · graphile-worker 0.18.0 | MIT | SKIP | Six rungs + a lookup table beat a statechart runtime; the tick is HTTP-triggered, no queue needed |

#### AR aging (`forecast.js` dashboard)

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [ERPNext `accounts_receivable.py`](https://github.com/frappe/erpnext/blob/develop/erpnext/accounts/report/accounts_receivable/accounts_receivable.py) | GPL-3.0 | READ | Ranges `"30, 60, 90, 120"` → 5 buckets; `age = as_on − due_date`; first `i` with `age ≤ range[i]`; future → `range0` (not due); **ERPNext puts "due today" (age 0) in the first overdue bucket — we pin due-today = `not_due` and test it**. ~8 lines to rewrite |
| [ERPNext `dunning.py`](https://github.com/frappe/erpnext/blob/develop/erpnext/accounts/doctype/dunning/dunning.py) | GPL-3.0 | READ | **Novelty evidence:** interest = `outstanding × rate/100/365 × overdue_days` — simple interest, one rate (lines 101–105). No rests, no RBI series, no dispute spans |

#### A4 print (`/print/*`)

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [MDN `@page`](https://developer.mozilla.org/en-US/docs/Web/CSS/@page) | Baseline 2024 | COPY | `@page { size: A4; margin: 12mm }` + `@media print` + `break-inside: avoid` on rows |
| [Chrome 131: print margin boxes](https://developer.chrome.com/blog/print-margins) | 2024-10-30 | DATA | `@page` margin boxes with `counter(page)` / `pages` → native "Page X of Y" → **no paged.js** |
| paged.js 0.4.3 (2023) · paper-css 0.4.1 (2018) · sparksuite/simple-html-invoice-template | MIT | SKIP | Native CSS covers one-page invoices/letters; Invoify covers the preview |

**B2 fixes this surfaced:** append-only trigger blocks reseed → `DISABLE TRIGGER USER` · verify must ignore BIGSERIAL gaps (retry after `unique_violation` burns ids) · pin due-today = not_due · seed CSV should match a real HDFC header or be labelled "HDFC-like" · `99` label mismatch in gst-states · rupee-decimal e-invoice values stay out of the hash.

---

### B3 Compliance & law (30 sources)

#### RBI Bank Rate — the §16 base (3 × Bank Rate, monthly rests)

MSMED §16 uses the RBI **Bank Rate** (aligned to the MSF rate = repo + 25 bps), **not the repo rate**. Effective on the announcement date. Every entry below was opened in the RBI press release.

| From | Bank Rate | §16 rate | Source |
|---|---|---|---|
| 2023-02-08 | 6.75 % | 20.25 % | [prid 55178](https://www.rbi.org.in/scripts/bs_pressreleasedisplay.aspx?prid=55178) — unchanged through all of 2024 (Dec 2024 minutes prid 59347) |
| 2025-02-07 | 6.50 % | 19.50 % | [prid 59692](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=59692) — repo 6.25 %, so **the LLD's `{2025-02-07, 625}` was the repo rate** |
| 2025-04-09 | 6.25 % | 18.75 % | [prid 60176](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=60176) — the only window where 625 bps is right |
| 2025-06-06 | 5.75 % | 17.25 % | [prid 60604](https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=60604) — held 6 Aug, 1 Oct 2025 |
| 2025-12-05 | 5.50 % | 16.50 % | [prid 61749](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=61749) — held 6 Feb, 8 Apr, 5 Jun, 5 Aug 2026 |
| **2026-10-07** | **5.75 %** | **17.25 %** | [prid 63742](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63742) — repo hiked to 5.50 % |

Our June–October 2026 seed **crosses the 7 October hike** — a live demo moment ("this invoice's interest rate changed two weeks ago; we show both segments").

#### MSMED Act 2006

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [MSMED Act, Gazette copy (dcmsme.gov.in)](https://www.dcmsme.gov.in/MSMED2006.pdf) | in force | READ / quote | §2(b) **acceptance = delivery date unless the buyer objects in writing within 15 days**; §2(n) only **micro and small** suppliers qualify; §15 agreed credit **capped at 45 days** → `Math.min(credit_days ?? 15, 45)`; §16 three times the Bank Rate, compound, monthly rests — quote verbatim in the letter footnote; §18(5) 90 days; §19 75 % pre-deposit on appeal; §§22–24 |
| [India Code record](https://www.indiacode.nic.in/handle/123456789/2013) | UNVERIFIED (403/504) | cite | Canonical citation link only |
| [Gurpreet Singh v. Union of India, SC Constitution Bench, 19-10-2006](https://api.sci.gov.in/jonew/judis/28157.pdf) | binding (general rule) | cite | Part-payments go "first towards interest and costs and then towards the principal" → `appropriation = interest_first`, cited in the conventions footnote |
| [LiveLaw: stringency of MSMED interest (24-11-2025)](https://www.livelaw.in/amp/law-firms/law-firm-articles-/the-stringency-of-interest-provisions-under-msmed-act-implementation-and-judicial-interpretation-310929) | secondary | READ | Practitioner support for interest-first; cites *DSL Enterprises v. MSEDCL* (Bom HC 2018) and *Rungta Projects v. SAIL* (Jhar HC 2012) — not opened |
| [iPleaders: recovering a delayed payment (06-10-2026)](https://blog.ipleaders.in/?p=130194) | secondary | READ | Appointed day = day after 15 days from acceptance; attach the invoice schedule + interest calculation to the demand |
| [Taxmann: V.K. Patel & Co v. Simplex (Cal HC 2024)](https://taxmann.com/post/blog/interest-under-msmed-act-is-to-be-calculated-monthly-at-variable-rbi-rates-hc-directs-award-debtor-to-pay-full-interest) | secondary summary | READ | The RBI rate **varies and is taken at each monthly rest** → our engine switches on the change date; say so in the footnote |

#### MSME ODR portal (replaced Samadhaan for new filings)

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [Samadhaan home banner](https://samadhaan.msme.gov.in/MyMsme/MSEFC/MSEFC_Welcome.aspx) | live, undated | quote | "All new delayed payment applications will now be filed at the MSME ODR Portal" → wording for the ODR card |
| [MoMSME Annual Report 2025-26 (Apr 2026)](https://www.msme.gov.in/static/uploads/2026/05/1bfda06b460e72543530b40817573495.pdf) | official | DATA | ODR filing **"w.e.f. 15th October, 2025"**; portal launched MSME Day 2025; **17 cases disposed in 8 months (₹60.60 lakh)**; Economic Survey estimate **₹8.1 lakh crore** delayed; MSEs avoid filing for fear of losing the buyer; MSME classes from 1-4-2025: micro ≤₹2.5 cr investment & ≤₹10 cr turnover, small ≤₹25 cr & ≤₹100 cr, medium ≤₹125 cr & ≤₹500 cr |
| [MSE Scheme on ODR — Guidelines](https://odr.msme.gov.in/assets/pdf/MSE_Scheme_on_ODR_for_Delayed_Payment_Guidelines.pdf) | FY 2023-24 → 2026-27 | **COPY list** | §12.1.4 (a)–(h) application contents = our bundle checklist (Part D). Reimburses up to ₹2,000 documents + ₹2,000 MSEFC fees |
| [ODR portal FAQ (46 Q&As)](https://odr.msme.gov.in/) | live (portal omits its TLS intermediate — Node/curl fail, browsers work) | DATA | Udyam **mandatory and must predate the supply**; micro or small only; **traders (NIC 45–47) ineligible**; no purchase order needed; several invoices per filing; no legal notice required; Limitation Act applies |

#### GST

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [Notification 9/2025-IT(R), 17-09-2025](https://courier.cbic.gov.in/ECCS/advisory/2025/NOTIFICATION%20NO.%209_2025-INTEGRATED%20TAX%20(RATE)%20-1759486719.pdf) | from 22-09-2025 | DATA | Slabs 5, 18, 40, 3, 0.25, 1.5 and 28 % (0.25 % rough diamonds; 1.5 % other stones) |
| [GST Council newsletter Dec 2025 (Notification 19/2025)](https://gstcouncil.gov.in/sites/default/files/2026-01/monthly_newsletter_december_2025_1_0.pdf) | effective 01-02-2026 | DATA | **28 % slab dropped**; tobacco/pan masala → 40 %, biris → 18 %, cess nil → final `gst_rates_bps = [0, 25, 150, 300, 500, 1800, 4000]`. The pack's list (0, 5, 18, 3, 40) never included 28 %; we add 0.25 and 1.5 for completeness |
| [Notification 10/2023-CT](https://www.gstcouncil.gov.in/sites/default/files/2024-05/10ct_eng.pdf) | from 01-08-2023 | DATA | E-invoicing mandatory above **₹5 crore** turnover |
| [CGST Rule 48](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule48_v1.00.html) | in force | READ | 48(5): an invoice an e-invoicing person issues without the IRP "shall not be treated as an invoice" → **the demo's ₹38 cr turnover would make its printed B2B invoices invalid → set `turnover_paise ≤ 5000000000`** |
| [NIC Generate-IRN JSON Schema](https://einv-apisandbox.nic.in/version1.03/generate-irn.html#JSONSchema) | current | COPY | → `db/einv-schema.json` + shape test (see B2) |
| [Notification 78/2020-CT](https://www.gstcouncil.gov.in/sites/default/files/2024-05/notfctn-78-central-tax-english-2020.pdf) | from 01-04-2021 | DATA | HSN digits: previous-year turnover ≤₹5 cr → **4** (may be omitted on B2C); >₹5 cr → **6** |
| [CGST Rule 46](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html) | in force | READ | Print checklist (a)–(s): serial ≤16 chars unique per FY; unregistered buyer ≥₹50k → address, delivery address, state code; reverse-charge flag; **no signature needed on an electronic invoice** |
| [CGST s.36](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter8/section36_v1.00.html) + [Rule 80](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter8/rule80_v1.00.html) | in force | DATA | Retain **72 months from 31 December after the FY** (GSTR-9 due date), or 1 year after any appeal ends → FY 2026-27 records kept until **31-12-2033** (privacy card) |

#### TDS — Income-tax Act 2025 (in force 1 Apr 2026)

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [Income-tax Act 2025, Gazette (Act 30 of 2025)](https://egazette.gov.in/WriteReadData/2025/265620.pdf) | in force 01-04-2026 | DATA | **Rates unchanged, labels changed.** s.393(1) Sl. **6(i)** (was 194C) 1 %/2 %, >₹30k single or >₹1 L aggregate · Sl. **6(iii)** (was 194J) 2 %/10 %, >₹50k · Sl. **8(ii)** (was 194Q) 0.1 % on the amount above ₹50 L, only if the buyer's turnover >₹10 cr → `rates_bps [10, 100, 200, 1000]` confirmed |
| [Income Tax portal: TDS compliance FAQ](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/tds-compliance) | current | READ | Payments from 01-04-2026 must quote the s.393(1) serial, e.g. "Sl. 6(i)" instead of "194C" |
| [PIB: Act in force 1 Apr 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2248005) | 01-04-2026 | cite | Assented 21-08-2025; Rules 2026 notified 20-03-2026 |

#### DPDP Act 2023 + Rules 2025

| Source | Status | Verdict | What we take |
|---|---|---|---|
| [DPDP Act 2023, Gazette (MeitY)](https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf) | phased | READ | **s.8(7)**: erasure "unless retention is necessary for compliance with any law" → anonymise the person, keep the GST ledger |
| [G.S.R. 843(E), 13-11-2025 — commencement](https://egazette.gov.in/WriteReadData/2025/267647.pdf) | official | DATA | Phase 1 (definitions, Data Protection Board) **13-11-2025** · s.6(9), s.27(1)(d) (consent managers) **13-11-2026** · ss.3–17 and the rest (data-fiduciary duties) **13-05-2027** |
| [DPDP Rules 2025, G.S.R. 846(E)](https://egazette.gov.in/WriteReadData/2025/267650.pdf) | official | DATA | Rules 1, 2, 17–21 now · Rule 4 13-11-2026 · Rules 3, 5–16, 22, 23 13-05-2027; Rules 6(1)(e), 8(3): keep processing **logs ≥1 year** → fits the append-only chain |
| [PIB: DPDP Rules notified (14-11-2025)](https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2190014) | official | cite | 18-month phased compliance; standalone consent notices; 90-day response to data-principal requests |

Wording rule stands: **"designed to DPDP principles — fiduciary duties are not yet in force; this is voluntary early compliance."** Never "DPDP-compliant".

---

### B4 Product, UX, prior art (32 sources)

#### Prior art — closest first

| Project | Licence / date | What it has | What it lacks (our gap) |
|---|---|---|---|
| [PayUpPal — RPay-build-recovery-agent](https://github.com/uditdaftary/RPay-build-recovery-agent) | **no LICENSE file** (README claims Apache-2.0) · Aug–Sep 2026 · 9 stars | MSMED §15/16 + 43B(h), promise-to-pay, dispute halt, Resend email, Form 26AS TDS checks | `DEFAULT_RBI_BANK_RATE_PCT = 6.75` (20.25 %, stale since Feb 2025); 30-day rests at r/12; subject "Formal Statutory Notice" signed "Credit & Legal Department"; Hinglish only; append-only log **without a hash chain**. **Read only — the closest prior art; name-check it** |
| [invoice-chaser (Kanakbaghel)](https://github.com/Kanakbaghel/invoice-chaser) | MIT · AWS "Agents for Humans" hackathon · 14 Oct 2026 | Chase-first with explained reasons, CSV import, rules core with AI on top | No Indian law, no letter, no verification. Proves these ideas are **not novel** |
| [billing-ai (BryanTheLai)](https://github.com/BryanTheLai/billing-ai) | none · Great Malaysia AI Hackathon 2025 | Twilio WhatsApp, Stripe webhooks, Bedrock, aging buckets, human review queue | Rails don't fit Indian MSMEs |
| [SirigangaBS/InvoiceChaser](https://github.com/SirigangaBS/InvoiceChaser) | none · **17 Oct 2026** | Indian freelancers, GST invoices, 4 stages (−1/0/+3/+7), gpt-4o-mini drafts, integer paise | **This is the baseline other teams will ship**: no MSMED, no letter, no bank matching |
| [Vyapar: send payment reminder](https://vyaparapp.in/videos/how-to-send-payment-reminder) · [Khatabook growth story](https://ameya.substack.com/p/how-khatabook-became-the-premier) · [OkCredit CEO (MediaNama)](https://www.medianama.com/2021/05/223-okcredit-merchants-interview/) | proprietary | WhatsApp/SMS reminders with editable text; free reminder dates | Reminders alone are table stakes. OkCredit: the barrier is "inertia, lack of trust" → **show the verify page and the interest workings on screen** |
| Vasuli (Product Hunt) · FundRaksha | from the selection research | Same "ladder" pitch | Name-check on the prior-art slide |

#### GST invoice UI references

| Source | Licence | Verdict | What we take |
|---|---|---|---|
| [Free-GST-Billing-Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software) | MIT · 73 stars · 19 Oct 2026 | READ / optional COPY | `InvoicePreview.jsx` (tax invoice, reverse charge, UPI QR), `PartyOutstandingReport.jsx`; may copy the 10-line `openWhatsAppShare` (digits-only phone, new tab — issue #12) with notice, or retype its 3 lines |
| [BillForge-gst-invoice](https://github.com/Vaibhav-Samdani/BillForge-gst-invoice) · [technodweep/gst-invoice](https://github.com/technodweep/gst-invoice) | MIT | READ | Layout only (BillForge handles IGST correctly; technodweep is PHP) |
| [prithwirajbose/gst-invoice](https://github.com/prithwirajbose/gst-invoice) | GPL-3.0 | never copy | — |

#### Demand-letter templates (read only — all of them threaten)

| Source | What we borrow | What we refuse |
|---|---|---|
| [forms-legal MSME delayed-payment notice](https://forms-legal.com/india/business/letters/msme-delayed-payment-notice-india) | Content checklist: Udyam number, GSTIN, invoice list with acceptance dates, §15 due date, principal + interest, pay-by date, where it escalates (uses a stale 18.75 % rate) | "without further notice", MSEFC threat, "notice" framing |
| [righttoinformation.wiki MSME guide](https://righttoinformation.wiki/practical-guides/msme-delayed-payment-samadhaan-complaint-interest-guide) | The line **"Please confirm receipt"** and the ODR pointer | "Formal Demand … Under MSMED Act" subject, "constrained to file" |

→ Letter adds: the **Udyam number** (config has only `udyam: true` today), each invoice's **acceptance date**, "please confirm receipt". Letter drops: "without further notice", 43B(h) references, any MSEFC/ODR threat (the pack forbids threats; the ODR pointer lives on the owner's bundle page instead).

#### WhatsApp template rules (Meta) — for the one-tap sends and a future API path

| Source | What it fixes |
|---|---|
| [Template Library](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-library) | Use-cases `PAYMENT_DUE_REMINDER`, `PAYMENT_OVERDUE` (utility) |
| [Template categorisation](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/) | Utility = non-promotional follow-up on the user's own transaction; any promotion → marketing |
| [Template components](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components) | Header ≤60 (1 param) · **body ≤1024** · **footer ≤60, no variables** · ≤2 URL buttons, 1 variable each at the end · 1 phone button · labels ≤25 · sample values required |
| [Template review](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review) | Rejected for: a variable at the **start or end**, non-sequential variables, **"threatening a customer with legal action"**, asking for full card/account numbers |
| [Supported languages](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/supported-languages) | `hi`, `en` |
| [WhatsApp Business Messaging Policy (23-09-2026)](https://whatsappbusiness.com/policy/) | Opt-in required; **"debt collection" is restricted** → frame every message as an invoice/payment update |

Consequences: our 82-char safety footer is too long → EN **"We never ask for OTP/PIN or change bank details."** (48) · HI **"हम कभी OTP/PIN नहीं मांगते, न बैंक विवरण बदलते हैं।"** (51). Body ends with "Reply STOP to stop reminders." (never a variable). Five templates: `invoice_sent`, `payment_due_soon`, `payment_due_today`, `payment_overdue`, `payment_overdue_final`; buttons **Pay** `/pay/{{1}}` and **Verify** `/verify/{{1}}`. The demand letter goes by email or print only.

#### Hindi terminology (official sources)

| Source | Terms |
|---|---|
| [RBI English–Hindi Banking Glossary, 8th ed. 2023](https://uco.bank.in/documents/d/guest/rbi-english-hindi-glossary-2023) | invoice **बीजक** · due date **भुगतान की तारीख** / नियत तारीख · amount due **देय रकम** · balance due बकाया रकम · outstanding **बकाया** · overdue **अतिदेय** · interest **ब्याज** · compound interest **चक्रवृद्धि ब्याज** · part payment **आंशिक भुगतान** · delayed payment विलंबित भुगतान · demand letter **मांग पत्र** · receipt भुगतान रसीद. "Reminder" is absent → we use **याद दिलाना** |
| [CBIC Hindi e-flier: tax invoice](https://cbic-gst.gov.in/hindi/pdf/e-version-gst-fliers/tax-invoice-efliers-hindi.pdf) | Print headings: **कर बीजक** (tax invoice) · **आपूर्ति का बिल** (bill of supply) · **आपूर्ति का स्थान** (place of supply) · संशोधित बीजक · क्रेडिट/डेबिट नोट · रिवर्स चार्ज |
| [Bank of Baroda Hindi FAQ](https://bankofbaroda.bank.in/hi-in/faqs/iracp-norms) | Everyday bank Hindi: अतिदेय, नियत तिथि / देय तिथि, ब्याज, **मूलधन** (principal) |

Rule: screens use everyday words (**बिल, बकाया**); print pages use the formal RBI/CBIC terms.

#### UX for low-digital-literacy users

| Source | What we apply |
|---|---|
| [UX4G Typography](https://ux4g.gov.in/foundations/typography) | Body ≥16 px (12 px absolute floor); line-height ≥1.5, **1.8 for Devanagari**; Noto Sans with system-ui fallback |
| [UX4G Accessibility](https://ux4g.gov.in/foundations/accessibility) | Contrast 4.5:1 text, 3:1 UI; focus ring 4 px with 2 px offset; **never colour alone**; text resizes to 200 %; declare page language |
| [UX4G Color](https://ux4g.gov.in/foundations/color) | Status tokens: success `#00522c` · error `#8a1a16` · warning `#ad4e00` · info `#006d75` |
| [Medhi, Sagar, Toyama — text-free UIs (MSR/ITID 2007)](https://www.microsoft.com/en-us/research/?p=160568) | **Icon + word on every status**; one help button that never moves |
| OkCredit interview (above) | Trust is the barrier → verify page and interest workings are first-class screens, not footnotes |

#### §16 worked examples → golden tests (₹5,00,000 at 19.5 %)

| Source | Method | 3 mo | 6 mo | 12 mo / 120 d |
|---|---|---|---|---|
| [TaxGuru, Kumar Ashu (11-10-2026)](https://taxguru.in/?p=1088754) | 1.625 %/month compounded | ₹24,773 | ₹50,774 | ₹1,06,704 |
| [TaxGuru, CA Gagan Bareja (13-10-2026)](https://taxguru.in/?p=1089563) | `5,00,000 × 1.01625⁶` | — | ₹50,774 | — |
| [TaxClue calculator](https://taxclue.in/tools/msme-samadhaan-interest-calculator) | `(1 + r/1200)^(days/30)`, single rate | — | — | 120 d: ₹33,301 |
| [CalcGuru calculator](https://calcguru.in/?p=1858) | days/365, compounds at calendar month-end, **part payments interest-first**; rate table says 5.50 % (5 Dec 2025–6 Oct 2026) → 5.75 % from 7 Oct 2026 — **matches the RBI bucket** | — | — | — |
| **Our LLD engine, rerun 22 Oct** (due 15 Jan 2026) | actual/365, monthly rests on due-date anniversaries | 120 d: ₹32,837.74 | 181 d: ₹50,343.85 | 365 d: **₹1,06,708.15** |

- **Golden test:** 12 months → ₹1,06,704 ± ₹5 (we are ₹4.36 off).
- **Footnote obligation:** at 6 months we are ₹430 lower because we count days/365, not months/12; the letter's conventions footnote must state the day-count, the rest dates, the rate-switch rule and the appropriation rule.

---

## Part C — What is novel, what is not

### C1 The problem is real, not new — our framing is new

- **Scale:** ₹8.1 lakh crore stuck in delayed MSME payments (Economic Survey, via the MoMSME Annual Report 2025-26); the older ₹7.34 lakh crore (Mar 2024) still appears in most pitches.
- **Enforcement gap:** the law is strong — §15 caps credit at 45 days, §16 charges three times the Bank Rate, compound — yet MSEs don't file because they fear losing the buyer (Annual Report). The new ODR portal, live for filings since 15 Oct 2025, has disposed **17 cases in 8 months**.
- **Fresh legal shift:** Samadhaan → ODR cutover; two GST slab changes (Sep 2025, Feb 2026); the Income-tax Act 2025 renumbered TDS (1 Apr 2026); the RBI Bank Rate moved five times since Feb 2025, including a **hike on 7 Oct 2026**; DPDP phases in to May 2027. Every tool with hard-coded values is already wrong — PayUpPal and forms-legal both carry stale rates.
- **The buyer is also a victim:** invoice-redirection fraud (altered payee details) hits the payer; a public verify page protects both sides.

→ One line: **"The law already gives small suppliers 17.25 % compound interest and a portal. Nobody gives them the paperwork — politely, in Hindi, with proof. FullPay does."**

### C2 Not novel — never pitch these as new

| Thing | Who already does it |
|---|---|
| Reminder ladders, WhatsApp/SMS reminders | Vyapar, Khatabook, OkCredit, SirigangaBS/InvoiceChaser |
| "Chase first, explain why", CSV import, rules core with AI on top | invoice-chaser (MIT) |
| MSMED §15/16 interest engine, promise-to-pay, dispute halt, TDS checks | PayUpPal (Aug–Sep 2026) |
| Hash-chained audit logs, canonical JSON | Solana SDP, Heimdall, RFC 8785, many articles |
| UPI deep links / QR | upiqr and friends |
| Dunning state machines; AR aging buckets | Kill Bill; ERPNext |
| Bank-CSV parsing | Paisa, burnrate, Firefly III |

### C3 Novel — "we found no tool that…"

| # | Lever | Evidence of absence | Where it lives |
|---|---|---|---|
| 1 | **Period-correct §16 interest**: dated RBI Bank Rate series, monthly rests, rate switches on the change date (V.K. Patel, Cal HC), **0 % inside accepted dispute spans**, part-payments interest-first (Gurpreet Singh, SC) | ERPNext Dunning: simple interest at one rate · PayUpPal: fixed 20.25 % · Kill Bill: no interest · TaxClue/CalcGuru: single rate, no disputes | `lib/interest.js`, letter footnote, golden tests |
| 2 | **The debtor holds the anchor**: the QR on the letter carries `entry_hash`; `/verify` shows the payee VPA / bank last-4 **as recorded at issue** — catches rewritten history *and* swapped payee details | Solana parks its head hash in Redis; Heimdall relies on a server secret; no invoice tool found publishes a public verifier | `chain.js`, `/verify/[hash]`, print pages |
| 3 | **Promise → forecast reflow → broken promise auto-resumes the ladder** | PayUpPal records promises but has no cash forecast; no forecast tool found reflows on promises | `promises`, `forecast.js`, `ladder.js` |
| 4 | **One record from GST invoice → bank match (TDS-short, partial, multi-invoice) → ODR §12.1.4 pack** | The parsers found feed personal-finance ledgers; no OSS prepares an ODR filing | `recon.js`, `/print/bundle` |
| 5 | **A letter that does not threaten, in Devanagari Hindi** | PayUpPal: "Formal Statutory Notice", Hinglish; every template found threatens MSEFC/ODR; the pack forbids threats | letter template, `i18n/hi.json` |
| 6 | **Dated-and-sourced legal config**: every rate, slab and threshold carries its from-date, source and verified date, surfaced in the conventions footnote | No tool found exposes this; most carry stale values | `config` row, `/about/method` |

The invention is the **connected chain** — invoice → ladder → promise → interest → letter + QR → bank match → ODR pack — not any single link.

### C4 Pitch discipline

Say **"we found none that…"**, never "first". Put Vasuli, FundRaksha and PayUpPal on the prior-art slide by name. Show the interest workings and the verify page on screen (trust is the barrier). Label the demo clock honestly ("demo clock: 1 day = 5 s").

---

## Part D — Config values to pin (`config` JSONB row)

```jsonc
{
  "rbi_bank_rate": {
    "unit": "bps", "verified": "2026-10-22",
    "source": "RBI MPC resolutions prid 55178, 59692, 60176, 60604, 61749, 63742",
    "series": [
      { "from": "2023-02-08", "bps": 675 },
      { "from": "2025-02-07", "bps": 650 },
      { "from": "2025-04-09", "bps": 625 },
      { "from": "2025-06-06", "bps": 575 },
      { "from": "2025-12-05", "bps": 550 },
      { "from": "2026-10-07", "bps": 575 }
    ]
  },
  "msmed": {
    "s16_multiplier": 3, "default_credit_days": 15, "max_credit_days": 45,
    "acceptance_default": "delivery_date", "appropriation": "interest_first",
    "day_count": "actual/365", "rests": "monthly_from_due_date",
    "eligible": ["micro", "small"],
    "sources": ["MSMED Act 2006 s.2(b), s.2(n), s.15, s.16", "Gurpreet Singh v UoI (SC 2006)", "V.K. Patel v Simplex (Cal HC 2024)"]
  },
  "gst": {
    "rates_bps": [0, 25, 150, 300, 500, 1800, 4000],
    "einvoice_threshold_paise": 50000000000,
    "hsn_digits": { "upto_5cr": 4, "above_5cr": 6 },
    "sources": ["Notif 9/2025-IT(R) 22-09-2025", "Notif 19/2025-CT(R) 01-02-2026 (28% dropped)", "Notif 10/2023-CT", "Notif 78/2020-CT", "Rule 46", "Rule 48(5)"]
  },
  "tds": {
    "rates_bps": [10, 100, 200, 1000],
    "labels": {
      "10":   "IT Act 2025 s.393(1) Sl. 8(ii) (was 194Q) — 0.1% above ₹50L, buyer turnover > ₹10cr",
      "100":  "Sl. 6(i) (was 194C) — 1% individual/HUF, > ₹30k single or ₹1L aggregate",
      "200":  "Sl. 6(i) 2% others / Sl. 6(iii) 2% technical services, > ₹50k",
      "1000": "Sl. 6(iii) (was 194J) — 10% professional fees, > ₹50k"
    },
    "in_force": "2026-04-01"
  },
  "retention": { "gst_records_months_after_31dec": 72, "fy_2026_27_until": "2033-12-31", "source": "CGST s.36 + Rule 80" },
  "dpdp": {
    "phase1": "2025-11-13", "consent_managers": "2026-11-13", "fiduciary_duties": "2027-05-13",
    "logs_min_years": 1, "erasure_exception": "s.8(7) retention for compliance with law",
    "wording": "designed to DPDP principles; duties not yet in force"
  },
  "odr": {
    "cutover": "2025-10-15", "portal": "https://odr.msme.gov.in",
    "gates": ["udyam_before_supply", "micro_or_small", "not_trader_nic_45_47", "within_limitation"],
    "bundle_checklist_s12_1_4": [
      "a. Seller details and Udyam Registration Number",
      "b. Buyer details and contact",
      "c. Undertaking that the facts are true",
      "d. Facts of the case with work order / agreement / invoices",
      "e. Payments received against the invoices",
      "f. Amount due and interest claimed (§16 calculation attached)",
      "g. Signature of the applicant",
      "h. ID proof"
    ]
  },
  "business": {
    "udyam_number": "UDYAM-PB-XX-XXXXXXX", "pin": "141003",
    "turnover_paise": 4500000000,
    "note": "≤ ₹5 cr keeps e-invoicing optional and HSN at 4 digits"
  },
  "messaging": {
    "footer_en": "We never ask for OTP/PIN or change bank details.",
    "footer_hi": "हम कभी OTP/PIN नहीं मांगते, न बैंक विवरण बदलते हैं।",
    "templates": ["invoice_sent", "payment_due_soon", "payment_due_today", "payment_overdue", "payment_overdue_final"]
  },
  "ui": {
    "status_colors": { "success": "#00522c", "error": "#8a1a16", "warning": "#ad4e00", "info": "#006d75" },
    "body_px": 16, "line_height": { "latin": 1.5, "devanagari": 1.8 }, "font": "Noto Sans"
  }
}
```

Impact numbers for the deck: **₹8.1 lakh crore** stuck (Economic Survey via MoMSME AR 2025-26) · ODR **17 cases** disposed in 8 months · §16 today = **17.25 %** compound.

---

## Part E — Rev F: corrections the research forces (apply before coding)

**Money & law**
1. Replace the LLD's RBI series with Part D — the spec's `{2025-02-07, 625}` was the **repo** rate. Current §16 rate is 17.25 %. The seed window crosses the 7 Oct 2026 hike → demo it.
2. `gst_rates_bps = [0, 25, 150, 300, 500, 1800, 4000]`. The pack's list (0, 5, 18, 3, 40) is right as far as it goes; we add 0.25 and 1.5 (diamonds/stones) for completeness and leave out 28 %, withdrawn 1 Feb 2026 — note the withdrawal on the method page.
3. Demo business `turnover_paise ≤ 5_000_000_000` (₹4.5 cr) so Rule 48(5) doesn't void the printed invoices; HSN 4 digits required, 6 allowed; add `udyam_number` and `pin` to the business config.
4. TDS: rates unchanged; labels become Income-tax Act 2025 s.393(1) serials with "(was 194C/194J/194Q)".
5. Effective credit = `Math.min(credit_days ?? 15, 45)`; `acceptance_date` defaults to the delivery date (§2(b)); only micro/small suppliers get the §16 line (§2(n)).
6. Conventions footnote states: actual/365 day count, monthly rests from the due date, rate switches on the RBI change date, 0 % inside accepted dispute spans, part payments interest-first (Gurpreet Singh). Golden tests: ₹5,00,000 @ 19.5 % × 365 d = ₹1,06,704 ± ₹5; document the 6-month ₹430 gap.
7. Privacy card: retention 72 months from 31 Dec after the FY (FY26-27 → 31-12-2033); DPDP dates 13-11-2025 / 13-11-2026 / 13-05-2027; s.8(7) anonymise-keep; wording "designed to DPDP principles".
8. ODR card: §12.1.4 (a)–(h) checklist as i18n strings; gates (Udyam before supply, micro/small, not NIC 45–47, Limitation Act); cite Annual Report "w.e.f. 15 Oct 2025" + Samadhaan banner.

**Data layer**
9. `pg.types.setTypeParser(1082, v => v)` and `(1184, v => v)` next to the 20/1700 parsers; `pool.on('error')`; never `pool.query` inside a transaction.
10. Advisory lock keys are constants (42 chain, 7 tick) — `hashtext()` is undocumented; tick: `SELECT pg_try_advisory_xact_lock(7) AS ok` → 409.
11. `escalation_events` gets the append-only trigger (Solana, MIT, with notice); `/api/reseed` runs `ALTER TABLE escalation_events DISABLE TRIGGER USER` … `ENABLE TRIGGER USER` inside its transaction.
12. `/verify` ignores BIGSERIAL id gaps (retry after `unique_violation` burns ids); result shape `{ok, reason, breakAtSeq}`; walk from genesis as specced.
13. Tests: add the JCS `weird`/`french` vectors (Apache-2.0); keep float/Date throw; e-invoice rupee decimals never enter `canonicalize`.
14. Aging: due today = `not_due` (pin in a test; ERPNext differs).

**Platform**
15. Next.js 16: `proxy.js` (not `middleware.js`), `await cookies()`, re-check the session cookie in every owner API route, Node ≥20.9 via `.node-version`.
16. Render: create the free Postgres **today** (30-day clock); web on **Starter** for judging; cron ≥$1/mo, schedule in UTC; Workflow `daily-tick` with `timeoutSeconds: 120, retry: { maxRetries: 0 }`; if Blueprint rejects `type: workflow`, create it in the Dashboard; cron start command = the single curl in B1.
17. Resend: verified domain is mandatory (resend.dev only reaches our own inbox) → DNS **today**; `from` must match the verified (sub)domain exactly; flush serially (10 req/s); idempotency key `outbox-<id>-<attempt>`; handle the returned `{error}`.
18. cron-job.org: `/api/reseed` answers 202 immediately then works (30 s timeout); no secrets in any response body; watch the 25-failure auto-disable.

**Copy & UX**
19. WhatsApp: footer ≤60 chars (Part D strings); body never starts/ends with a variable; no "legal action" wording; frame as payment updates; five template names; Pay + Verify buttons; letter by email/print only.
20. Letter: add Udyam number, per-invoice acceptance dates, "please confirm receipt"; drop "without further notice", 43B(h), MSEFC/ODR threats.
21. Hindi print terms from RBI/CBIC (Part B4); screens use बिल / बकाया.
22. UX tokens: body ≥16 px, line-height 1.5 / 1.8 Devanagari, Noto Sans, status colours, icon + word on every status, one fixed help button.

**Seed & matching**
23. Bank CSV: HDFC-style header, DD/MM/YY, UPI narration `UPI/<ref>/<note>/<vpa>/…`, NEFT `NEFT CR-…`, zero-amount opening-balance row → `skipped[]` with reasons; label "HDFC-like"; optionally accept burnrate's header synonyms (Apache-2.0, with notice).
24. Company-name normalisation = one regex applied twice, then fuse ≤0.35.
25. `STATE_CODES` from gst-states (MIT, with notice); relabel/drop 99; add 96; UQC list from Master Codes for the unit dropdown.
26. Print: native `@page` + Chrome 131 margin boxes; no paged.js.

**Pitch**
27. Impact slide: ₹8.1 lakh crore (with the ₹7.34 lakh crore 2024 figure as the trend); ODR 17 cases in 8 months.
28. Prior-art slide: Vasuli, FundRaksha, **PayUpPal (Aug–Sep 2026)**, **SirigangaBS/InvoiceChaser (17 Oct 2026)**.
29. Dependencies: **none added at runtime.** Dev-only optional: `upi-parser` (test), `hsn-code-package` (seed rows). Skip xstate, pg-boss, graphile-worker, paged.js, canonicalize libs, upiqr.
30. `NOTICE` file in the repo: gst-states (MIT) · Solana trigger (MIT) · JCS vectors (Apache-2.0) · burnrate header synonyms (Apache-2.0, if used) · Free-GST `openWhatsAppShare` (MIT, if copied).

---

## Part F — Day-0 checklist, repo plan, open questions

### F1 Today, before 9:30 PM IST (accounts and DNS only — no project code before kickoff)

| # | Item | Why today |
|---|---|---|
| 1 | Confirm in the organiser group: deadline (Sat midnight vs Sun 9:30 PM), video length (3 vs 5 min), any live round. Screenshot the answer | plan hinges on it |
| 2 | Render: sign in, pick the team account, note the $50 participant credit; create the **free Postgres** (30-day clock starts); test a hello-world Workflow in a scratch service; generate `RENDER_API_KEY` | Workflow + Blueprint quirks are unknown until tried |
| 3 | Resend: sign up, **add the sending domain, publish DKIM/SPF/MX** (`send.` subdomain, DNS-only on Cloudflare), start verification | 15 min typical, 72 h worst case — the only item we cannot speed up |
| 4 | Decide which domain FullPay sends from (we need one we control) | blocks #3 |
| 5 | n8n: claim the team voucher; create the 3-node webhook receiver | sponsor visibility |
| 6 | cron-job.org account | fallback tick + keep-alive |
| 7 | GitHub org/repo name `fullpay` reserved (empty) | first commit lands after 9:30 PM |
| 8 | Read the Rev F list (Part E) and dossier §0; reply "approve" or list changes | freezes scope |

### F2 Repo plan (one repository, created at kickoff)

- **`fullpay`** — public, **MIT** `LICENSE`, `NOTICE` for third-party snippets, `README` with a "Pre-event planning (declared)" section linking this folder's docs.
- First commit after 9:30 PM: README, `.node-version`, `.gitignore`, `render.yaml`, `db/schema.sql`, `tests/` skeleton, the planning docs under `docs/`.
- Layout (from the LLD):
  ```
  app/            Next.js App Router (plain JS): (owner)/…, pay/[token], verify/[hash], print/{invoice,letter,bundle}, api/…
  lib/            time.js money.js gst.js interest.js ladder.js chain.js recon.js forecast.js db.js i18n/{en,hi}.json
  db/             schema.sql seed.js bank-statement.csv einv-schema.json
  workflows/      daily-tick task (own package.json, @renderinc/sdk)
  tests/          node:test — interest goldens, JCS vectors, GST split/round-off, GSTIN check digit, ladder, recon cases
  proxy.js  render.yaml  .node-version  LICENSE  NOTICE  README.md
  ```
- Trunk-based: `main` deploys to Render (autoDeploy on until the Saturday freeze, then manual). Small commits; each money/security path lands with its test.
- Hour-by-hour schedule, must/should list and demo script: `10_build_plan.md` (now Rev F).

### F3 Open questions for the team

1. Deadline / video length / live round — confirmed?
2. Which domain do we send email from? Who holds its DNS?
3. "CSI key" — what is it? (plan assumes free tiers; an LLM key only upgrades tone drafting)
4. n8n voucher claimed?
5. Approve Rev F items 1–3 explicitly (RBI series, GST slabs, demo turnover ≤ ₹5 cr) — they change seed data and tests.
6. Approve dossier §0 — scope freeze.

---

## Part G — Conformance check against the official statement and prompt pack (23 Oct)

Checked line by line against `problemstatement/chase` (byte-identical to the official API, updatedAt 2026-10-21). Verdict: **we follow the pack.** The 11 "possible areas", the 13 Build-1 screens, the money rules, the demand-letter rules, the 10-point BEFORE-YOU-FINISH list and the 18-point Build-2 list are all in the plan as Layer 1. We deviate only on the pack's suggested *stack* (localStorage → Postgres backend; Vite → Next.js), which the brief allows ("integration … is not mandatory"; "you do need to be able to explain what you built").

### G1 Coverage matrix

| Official statement / pack item | Where the plan covers it |
|---|---|
| Invoice management (customer, due date, status, GST, outstanding) | Screen 2 Invoices list + filters + search; `invoices`, `invoice_items` |
| Automated reminders by overdue level, email / WhatsApp | Six-rung ladder, outbox, Resend auto-send for the first two rungs, wa.me / mailto / sms one-tap with "Mark as sent" |
| GST-compliant tax invoices | Invoify UI + `gst.js`: per-line paise rounding, CGST/SGST vs IGST by state code, round-off line, Tax Invoice / Bill of Supply / plain by registration type, Rule 46 fields, GSTIN check digit, e-invoice note above ₹5 cr, HSN 4/6 digits, UPI QR `pa pn am tn cu` |
| Payment-demand letters, clearly not legal notices | Rung +30: exact title "Payment Demand Letter", the "not a GST / legal notice" line, invoice schedule with part-payments, 7-day config deadline, bank + UPI QR, dispute contact, Udyam-gated MSMED line, interest only if the owner ticks |
| Escalation workflow | −3 / 0 / +7 / +15 / +30 / +45, editable in Settings, pauses on dispute or promise, never repeats a stage, whole IST days |
| Evidence & documentation | Per-invoice timeline, hash-chained `escalation_events`, evidence pack / ODR bundle print page, `/verify` |
| Payment reconciliation | `recon.js`: CSV import + manual entry, the six pack cases, TDS 1 / 2 / 10 % of taxable value, confidence + reason, confirm gate, re-import idempotency |
| Cash-flow forecasting | 13 weeks from `expenses` + `opening_balance_paise`, week-chaining, buffer week, what-ifs, promise reflow |
| Smart prioritisation ("Chase these first") | Score from amount, days overdue, customer reliability and cash-gap impact with a one-sentence reason; dashboard top 5 (in the LLD) |
| Dispute handling | `/pay/:token`: "I've already paid" and "Something's wrong" → Inbox; dispute pauses rungs; interest stops only on owner acceptance |
| Simple dashboard | Totals, ageing bar (not due / 1–30 / 31–60 / 61–90 / 90+), top 5 to chase |
| Customers | Credit days, contacts, total owed, average days late, % on time, A / B / C grade with the reason in words (in the LLD) |
| Money rules (whole paise, en-IN, amount in words, IST, April–March FY) | LLD global invariants; `lib/time.js`; to-words |
| 45-day next steps | Call · lawyer · **MSME ODR portal (formerly Samadhaan)**: the pack still says Samadhaan, so we show both names |
| Design rules (360 px, 16 px text, 48 px buttons, AA contrast, focus, labels, status words, full language switch) | Rev F #22 + UX4G tokens; EN/HI i18n wired at scaffold |
| BEFORE-YOU-FINISH list (10) and Build-2 list (18) | Layer 1 acceptance suite; Sunday 9–12 regression sweep |
| Add-on "Send reminders for real" | Layer 2: Render cron 10:00 IST → Workflow → `/api/tick`; Resend; owner-enabled rungs only; letters never auto-sent; dedupe rules; send log with retry; the five WhatsApp templates in the README |
| Add-ons photo OCR and Marathi | Roadmap only (optional add-ons; Rev B #11) |
| Submit: README structure, deploy steps, 3-minute script, live-demo risk list | Plan §7 and deltas; README mirrors the pack's headings |
| Debug prompts | Unit-test matrix: GST cases, reminder timing, matching, phone layout, deploy |

### G2 Twelve small additions the check surfaced (each under 30 minutes; fold into the build)

1. **"Invoices that would cover the gap"** under the forecast's shortfall week. The pack names it and its demo script shows it; the LLD has the forecast but not this list (about 15 lines: outstanding invoices sorted by due date until the gap is covered).
2. Keep **all three what-ifs** (customer pays 30 days later · big order · supplier payment delayed) unless the Sat 11 PM red trigger fires. The pack names all three.
3. **Settings exposes everything the pack lists**: ladder day offsets, safety buffer, per-rung auto-send toggles, language, text size, Demo date, Reset demo, and the business profile (name, address, state, GSTIN, registration type, turnover, Udyam yes/no, bank details, UPI ID, logo as an optional image URL with an initials fallback).
4. Inbox "accept" records the adjustment as a **credit note** (`credit_note_no` in the `invoice_adjusted` event payload, shown on the timeline), beside "mark paid" and "reject with reply".
5. Email goes out **in the business's name with `reply_to` set to the owner's email**, with the invoice and pay links; **`.env.example`** lands in the first commit.
6. **Test mode** (`MAIL_TEST_MODE=1` sends every email to the owner's own inbox). The add-on asks for it, and it de-risks the live demo.
7. Keep the **signature line** on the Tax Invoice (pack requirement). Rule 46's "not needed on an electronic invoice" is a footnote, not a reason to drop it.
8. Invoice filters offer **all seven pack statuses** (draft, sent, due soon, overdue, part paid, paid, disputed); due soon and overdue are derived, not stored.
9. **Plain words with the accounting term in a tooltip** ("money to collect" → "receivables"): i18n keys come in label + hint pairs.
10. Seed: expenses include **salaries on the 1st, rent on the 5th, supplier bills with due dates, electricity, and the GST payment on the 20th**; exactly one seeded **disputed** invoice; the e-invoice banner is demoed by raising turnover above ₹5 cr in Settings (the seed stays at ₹4.5 cr).
11. README gets a **"where the pack's files live"** table: `src/data/*` → `db/seed.js` + `db/bank-statement.csv`; `config.js` → the `config` row; `templates.js` → `lib/templates.js`; `src/i18n/*` → `lib/i18n/{en,hi}.json`.
12. **Demo script.** The pack tells judges to expect the dashboard, the forecast's shortfall week with covering invoices, a one-tap WhatsApp send and a customer dispute pausing the ladder. Our four novelty beats show none of the first three. Proposal: open with a 20-second guided montage of those four screens, then the four beats with the hook trimmed to 10 seconds. Team decides on Day 0.

### G3 Where we knowingly differ from the pack (state it in the README)

- Stack: Postgres + Next.js on Render instead of localStorage + Vite. "No backend" was the pack's convenience for no-coders; the brief sets no stack.
- The 45-day step points to the MSME ODR portal and names Samadhaan as its predecessor.
- GST rate list adds 0.25 % and 1.5 %; 28 % stays out (withdrawn 1 Feb 2026).
- Interest uses a dated RBI Bank Rate series instead of one config number: the pack's "check rbi.org.in" note, done properly.
- Statuses are stored as five and displayed as seven.
