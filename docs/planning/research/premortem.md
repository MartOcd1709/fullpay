# Technical pre-mortem — FullPay on Next.js 16 + Render + Resend (verified Fri 23 Oct 2026, late morning IST)

Scope: the exact stack the plan locks (Next 16 App Router in plain JS · node-postgres on Render free Postgres · Render cron → Render Workflow → `POST /api/tick` · Resend · browser-print A4 · Invoify fork · shadcn/ui · recharts · to-words · qrcode · papaparse · fuse.js · node:test · GitHub Actions). Everything below was checked today against npm registry metadata, vendor docs or the GitHub repos themselves; the Sources list has the URL for every claim. No application code is proposed before kickoff — every pre-check is a doc read, a vendor-dashboard action, or a throw-away scratch project outside the `fullpay` repo.

## 0. Verdict

The stack is compatible: every library on the list has a current release that declares React 19 / Node 20+ support, and the versions pinned in §5 resolve together without `--legacy-peer-deps`. The danger is not version conflicts; it is five platform behaviours that silently break a demo built in 48 hours:

1. **Next.js prerenders DB-backed pages at build time unless told otherwise** (dashboard baked at `next build`, `/verify/:hash` cached forever after the first hit, or the Render build failing because it cannot reach the DB). One line in the root layout (`export const dynamic = 'force-dynamic'`) removes the whole class [S20][S21].
2. **Resend will not deliver to any address except the account owner's until the domain is verified** — DNS is the only item nobody can speed up, so it starts today (already P0.4) and the Sat 2 PM fallback is `MAIL_TEST_MODE=1` + `onboarding@resend.dev`, which still lands a real email in the owner inbox for the video [S27][S28].
3. **Render Workflows are fine but have a Node/ESM/rootDir surface nobody on the team has touched**; the hello-world (P0.3) must be done with the CLI's local task server *and* a Dashboard deploy, and the cron→Workflow hop needs a second trigger (cron-job.org → `POST api.render.com/v1/task-runs`) as insurance [S9][S10][S11][S12].
4. **A `package-lock.json` generated on macOS omits the Linux native binaries Tailwind v4, Lightning CSS and Next's SWC need, and `npm ci` on Render/CI fails with "Cannot find module … linux-x64-gnu"** [S37][S38][S39]. Generate the lockfile on Linux (Ved's box) and never regenerate it elsewhere.
5. **Invoify is no longer a drop-in template.** Its Aug-2026 refactor splits each look into a 3 KB layout plus a 20 KB shared `parts/index.tsx` typed against Invoify's own Zod schema (single `taxDetails`, no per-line tax, no HSN, no place of supply), renders PDFs through Puppeteer and a 1 MB generated Tailwind-3 stylesheet, and still runs React 18.2 [S30][S31][S32]. The plan's "biggest saver ~8 h" is wrong; budget 2 h to write our own ~150-line A4 Tax Invoice component and use Invoify only as a visual reference.

Two dependencies should be dropped before they are installed: **react-to-print** (the plan already has `/print/{invoice,letter,bundle}` routes; a `window.print()` button is the entire implementation, and react-to-print's iframe copies only the printed subtree so `next/font` CSS variables and Devanagari fonts set on `<html>` do not carry over without extra work [S33]) and the LLD's single **Playwright e2e** (browser download + flake, no judge sees it).

## 1. Version matrix (npm `latest` as of 23 Oct 2026)

| Package | Pin | Node / peers | What matters | Source |
|---|---|---|---|---|
| next | **16.4.2** (published 2026-10-15) | Node ≥20.9.0; react/react-dom `^18.2 ‖ ^19` | `proxy.js` replaces `middleware.js`; sync `cookies()/params/searchParams` removed; Turbopack default; `next lint` removed; CVE-2026-64642 (proxy auth bypass, Turbopack + single i18n locale) fixed in 16.2.11 — 16.4.2 is past it | [S1][S2][S3] |
| react / react-dom / react-is | **19.3.1** | — | recharts declares `react-is` as a *peer*; pin it to the React version to avoid the 2.x-era mismatch | [S4][S6] |
| shadcn (CLI, run via npx) | **4.22.1** | Node ≥20.18.1; ESM-only | `components.json` `tsx:false` → `.jsx`; aliases may come from `jsconfig.json`; `isTsx` is detected from the presence of `tsconfig.*` files (no tsconfig → JS); `tailwind.config` left blank for v4; `style` must be `new-york` | [S5][S7][S8] |
| tailwindcss / @tailwindcss/postcss | **4.3.3** | — | native `@tailwindcss/oxide-*` + `lightningcss-*` binaries → lockfile/OS trap (§3 R4) | [S37][S38] |
| radix-ui · lucide-react · class-variance-authority · clsx · tailwind-merge · tw-animate-css | **1.8.1 · 1.61.0 · 0.7.1 · 2.1.1 · 3.7.0 · 1.4.0** | react `^19` peers OK | installed by `shadcn init/add`; pin afterwards | [S4] |
| recharts | **3.10.1** | react/react-dom/react-is `^19`; depends on immer `^11.1.8`, @reduxjs/toolkit, react-redux | immer ≥11.1.8 means the "lanes is read-only" React-19 bug (immer 11.0.0) cannot occur; `responsive` prop exists since 3.3 and avoids `ResponsiveContainer`'s resize-state issues; shadcn's `chart` component targets Recharts v3 | [S6][S13][S14][S15] |
| react-to-print | 3.3.0 (peer react `~19`) | — | **recommend not installing** (see §0) | [S16][S33] |
| pg | **8.23.1** | Node ≥16 | `pg` is in Next's default `serverExternalPackages` list → Turbopack leaves it alone, no `cloudflare:sockets` noise; `sslmode=require` in a URL means *verify* (`ssl: true`), `sslmode=no-verify` means `rejectUnauthorized:false` unless `uselibpqcompat=true` | [S17][S18][S19] |
| resend | **6.34.1** | Node ≥20 | SDK field is `replyTo` (camelCase), API payload is `reply_to`; `from` as `Name <addr@verified-domain>`; idempotency via header, 24 h window | [S26][S27][S28] |
| @renderinc/sdk | **1.4.0** | Node ≥18; no `type` field → CJS, `exports` has both `import`/`require` → `./workflows` subpath | deps `redis ^5.11`, `eventsource ^4`, `openapi-fetch`; plain JS works (`require("@renderinc/sdk/workflows")`) | [S9] |
| to-words | **7.4.0** | Node ≥20; zero deps | `hi-IN` exists and outputs Devanagari (रुपया/रुपये, पैसा/पैसे, लाख, करोड़) but its `only` text is empty; `en-IN` gives "Rupees … Only" exactly as the pack wants | [S22][S23][S24] |
| qrcode | **1.5.4** | Node ≥10.13 | server-side `toString(text,{type:'svg'})`; `browser` field swaps in `lib/browser.js` but pulls `pngjs`/`fs` shims if imported from a client component → keep it in RSC/route handlers only | [S25] |
| papaparse / fuse.js | **5.7.0 / 7.5.0** | UMD main / dual ESM+CJS | both import cleanly in Node ESM and Turbopack | [S25b][S25c] |
| @fontsource/noto-sans, @fontsource/noto-sans-devanagari | **5.3.0** | — | offline alternative to `next/font/google` (§3 R7) | [S4] |
| Node | **22.23.4** (`.node-version`) | Render default for services created ≥ 2026-10-21 is **24.22.1** — pin or dev/prod drift | precedence `NODE_VERSION` env > `.node-version` > `.nvmrc` > `engines` | [S34][S35] |
| GitHub Actions | `actions/checkout@v7` (7.0.1), `actions/setup-node@v7` (7.1.0) | `node-version-file: .node-version`, `cache: npm` | — | [S36] |

## 2. Invoify: what a "fork" actually buys

Repo facts (default branch `master`, MIT, 6,376 stars, last push 2026-08-24): `next 15.3.8`, `react 18.2.0`, `typescript 5.2.2`, `tailwindcss 3.3.5`, `next-intl 4`, `react-hook-form 7` + `zod 3`, `puppeteer-core 24` + `@sparticuz/chromium`, `nodemailer`, `react-signature-canvas`, `number-to-words`, `react-email` [S30]. Template code lives in `app/components/templates/invoice-pdf/`: thirteen `layouts/*.tsx` (2.4–4.4 KB each, e.g. `Classic.tsx` is a 90-line composition of `<Logo/> <PartyBlock/> <DocumentMeta/> <ItemsTable/> <TotalsBlock/> <PaymentBlock/> <NotesBlock/> <SignatureBlock/>`), a 19.8 KB `parts/index.tsx` holding those blocks, `invoiceTheme.ts` (accent colour, 4 fonts, 3 densities), `invoiceLabels.ts`, `TemplateFrame.tsx`, `registry.ts`, a prebuild script that generates a **1 MB** `lib/pdfStyles.generated.ts` for Puppeteer, and an 18 KB `contexts/InvoiceContext.tsx` [S31]. Data shape: `lib/schemas.ts` has `items[]`, one optional `taxDetails` (amount or %), `discountDetails`, `shippingDetails`, `totalAmountInWords` — no per-line GST rate, no CGST/SGST/IGST split, no HSN/SAC, no place of supply, no GSTIN fields [S32].

Consequences: (a) nothing can be copied as-is into a plain-JS, Tailwind-v4, React-19 app without stripping types, re-mapping every field and rewriting `ItemsTable`/`TotalsBlock` for the GST columns the pack mandates; (b) the PDF path (Puppeteer + generated CSS) is irrelevant because we print from the browser; (c) what *is* worth borrowing is the look: `invoiceTheme.ts`'s density scale idea and one layout's spacing. Realistic cost of our own `components/print/InvoicePrint.jsx` (header, parties, place of supply, items table with HSN · qty · unit · rate · discount · taxable · CGST/SGST or IGST · total, round-off, words, UPI QR, reverse-charge line, signature) is ~2 h for Dev B with Claude, versus 1–2 h of fighting the fork before writing the same thing anyway. Re-label the Sat 9 AM–2 PM slot "own A4 Tax Invoice component (Invoify as visual reference)"; if any class strings are copied, keep the MIT notice line already planned.

## 3. Risk register

Each entry: likelihood · impact · pre-kickoff check (no project code) · mitigation/fallback · pins.

**R1 — Build-time prerender hits the database / Full Route Cache freezes pages.** High · High. In App Router without `cacheComponents`, a server component that only queries Postgres and uses no request-time API is static: `next build` executes the query on Render's build box (which may not reach the internal DB hostname) and bakes the HTML; dynamic-segment pages like `/verify/[hash]` render on first hit and are then cached — after a nightly reseed the hash page or dashboard shows stale numbers with no error [S20][S21]. *Check:* read the two docs pages. *Mitigation:* `export const dynamic = 'force-dynamic'` in `app/layout.js` (applies to every route and route handler beneath it) and `await connection()` in any lib that must be request-time; CI runs `npm run build` without a `DATABASE_URL` so a regression fails fast.

**R2 — Resend domain not verified when the autonomy beat is recorded.** Medium · High. Verification is "often within 15 minutes", worst 72 h, and `onboarding@resend.dev` delivers only to the account owner's inbox [S27][S28]. *Check:* publish the DKIM/SPF/MX records today (P0.4), then prove delivery with one `curl https://api.resend.com/emails` to a teammate's address once the dashboard says Verified. *Fallback (decision at Sat 2 PM):* `MAIL_FROM=onboarding@resend.dev` + `MAIL_TEST_MODE=1` — every email goes to the owner inbox, which is exactly what the video shows; `replyTo` must be camelCase in the SDK [S26].

**R3 — Render Workflow friction (service creation, rootDir, Node, env).** Medium · Medium (bonus-track credits, not the demo). Facts: Blueprints *do* support `type: workflow` (runtime `node`/`python` only); Workflows have no scheduler; the TypeScript SDK is a JS package with CJS entry points; examples use `"type":"module"` with `tsc && node dist/main.js` or `tsx`; the CLI has a local task server (`render workflows dev -- <start cmd>` and `render workflows tasks start <task> --local --input='[]'`) [S9][S10][S11][S12]. *Check (P0.3, extended):* run the hello-world locally with the CLI, then deploy it from a scratch repo through the Dashboard **and** through a scratch `render.yaml` containing `type: workflow` + `rootDir`, note which one works and whether `.node-version` is honoured under `rootDir`. *Mitigation:* our task file is `workflows/index.cjs` using `require("@renderinc/sdk/workflows")` (no ESM interop at all), `NODE_VERSION=22.23.4` set as an env var on the workflow service (highest precedence), `TICK_SECRET` copied with Blueprint `fromService … envVarKey`. *Fallbacks:* cron-job.org job that POSTs `https://api.render.com/v1/task-runs` with the Bearer header (so the Workflow still runs daily if the Render cron misbehaves); last resort `node-cron` started from `instrumentation.js` `register()` under `NEXT_RUNTIME==='nodejs'` [S40] (loses track eligibility, keeps the demo).

**R4 — Lockfile from macOS breaks `npm ci` on Render and GitHub Actions.** Medium · High. npm records only the optional native package for the platform that ran `npm install`; a lockfile made on a Mac lacks `@tailwindcss/oxide-linux-x64-gnu` / `lightningcss-linux-x64-gnu`, and Linux installs then fail with "Cannot find module" [S37][S38][S39]. *Check:* ask Dev B which OS they use; decide now that `package-lock.json` is generated and regenerated only on Linux. *Mitigation:* `.npmrc` with `save-exact=true`; if a Mac must regenerate, `rm -rf node_modules package-lock.json && npm install` on Linux before committing; Render build command `npm ci` (not `npm install`) so drift is loud.

**R5 — Invoify "lift" eats the Saturday-morning slot.** High · Medium. See §2. *Check:* done (repo read). *Mitigation:* own component, 2 h, Invoify as reference only; the on-screen GST view stays in the never-cut list regardless.

**R6 — react-to-print prints without our fonts/CSS variables.** Medium · Medium. The library's own README: only styles that target the printed nodes apply because parent nodes do not exist in the print DOM; custom fonts need the `fonts` option [S33]. `next/font` and Tailwind v4 theme tokens live on `<html>`. *Mitigation:* do not install it; `/print/*` routes + `<button onClick={() => window.print()}>` + `@page { size: A4; margin: 12mm }`; Chrome's Save as PDF embeds Devanagari correctly from a real page.

**R7 — `next/font/google` fails the production build when fonts.googleapis.com is unreachable.** Low-Medium · High. Dev falls back to a system font; `next build` throws ("Failed to fetch `…` from Google Fonts") — a transient DNS/timeout on Render's build box kills a deploy at the worst moment [S41][S42]. *Mitigation:* vendor via `@fontsource/noto-sans` + `@fontsource/noto-sans-devanagari` CSS imports in `globals.css` (zero network at build) or `next/font/local` with the two woff2 files in `public/fonts`.

**R8 — UTC runtime shifts IST day boundaries.** High · Medium. Render containers and GitHub runners run in UTC; the 10:00 IST tick is 04:30 UTC, so any `new Date()`-based "today" is the previous day and every rung fires a day late. *Mitigation:* `lib/time.js` computes dates with `timeZone: 'Asia/Kolkata'` explicitly, **and** `TZ=Asia/Kolkata` is set in `render.yaml` envVars, the CI job `env`, and `.env.example`; one test asserts `today()` under `TZ=UTC` equals the IST date [S43].

**R9 — pg over TLS to the external Render URL from laptops/CI.** Medium · Low. External connections require TLS with Render-managed certificates, reject `sslmode=disable`, and need the hostname (SNI); internal connections offer optional self-signed TLS [S19]. With pg, `sslmode=require` *verifies* the chain [S18]; whether Render's external cert chains to a public CA is not documented. *Check:* from the laptop, in the scratch dir, `node -e` with `pg` against the external URL twice (`?sslmode=require`, then `?sslmode=no-verify`) and record which works. *Mitigation:* Render services use the internal URL (no `sslmode`); laptops/CI use the external URL with `sslmode=no-verify` only if `require` fails; never mix an `ssl` object with a URL `sslmode`.

**R10 — Turbopack and node:test disagree on module resolution.** High · Low-Medium. `@/` aliases from `jsconfig.json` and extension-less relative imports work in Next but not in Node; Node 22 runs ESM-syntax `.js` files without `"type":"module"` thanks to syntax detection (enabled by default) [S44], and `node --test` picks up `**/*.test.{cjs,mjs,js}` running each file in its own process [S45]. *Mitigation:* rule in README: `lib/**` and `tests/**` use relative imports with explicit `.js`; `@/` only inside `app/` and `components/`; keep create-next-app's default (no `"type":"module"`, `next.config.mjs`, `postcss.config.mjs`).

**R11 — shadcn init in a JavaScript project.** Low-Medium · Low. Documented path exists (`tsx:false`, `jsconfig.json` aliases, `new-york` style, blank `tailwind.config` for v4) [S7][S8]. *Check:* scratch `create-next-app --js` + `npx shadcn@4.22.1 init -y -b neutral` + `add button chart` + `npm run build`. *Mitigation:* if prompts misbehave, write `components.json` by hand (`{"$schema":"https://ui.shadcn.com/schema.json","style":"new-york","rsc":true,"tsx":false,"tailwind":{"config":"","css":"app/globals.css","baseColor":"neutral","cssVariables":true},"aliases":{"components":"@/components","utils":"@/lib/utils","ui":"@/components/ui"}}`).

**R12 — recharts "width(0) and height(0)" and client boundary.** Medium · Low. Charts must sit in a `'use client'` component; a zero-size first render during hydration logs the warning [S14][S15]. *Mitigation:* `<BarChart responsive height={240} …>` (3.3+ prop) inside a wrapper with explicit height, or `next/dynamic(() => import('./Chart'), { ssr:false })`.

**R13 — Free Postgres and Starter plan logistics.** Low · High. Free DB expires 30 days after creation (+14 days grace), 1 GB, no connection pooling, one per workspace; free web spins down after 15 idle minutes (~1 min cold start); 100 connections for <8 GB instances [S46][S19]. *Check (P0.2):* create the DB today, add a payment method, confirm the $50 participant credit covers a Starter web for judging week. *Mitigation:* `pg.Pool` singleton on `globalThis` with `max: 5` (dev HMR otherwise leaks pools), `pool.on('error')`; keep-alive ping only matters if the web stays on Free.

**R14 — Node version drift.** Medium · Low. Render's default for new services is 24.22.1 while the team develops on 22 [S34][S35]. *Mitigation:* `.node-version` = `22.23.4` at repo root, `NODE_VERSION` env on the workflow service, `engines: {"node": ">=22.12 <23"}` (Render advises an upper bound), CI reads the same file.

**R15 — Memory on Starter (512 MB) / builds.** Low · Medium. Community reports put Render build containers at a fixed 8 GB and show 512 MB runtime OOMs mostly from `next/image` optimisation [S47][S48]. *Mitigation:* no `next/image` on remote logos (plain `<img>`), `images.unoptimized: true`; if the process ever OOMs, `NODE_OPTIONS=--max-old-space-size=400`.

**R16 — Shipping a Next.js below the patched line.** Low · High. CVE-2026-64642 affects 16.0.0–16.2.10 [S3]; the plan's `proxy.js` is the auth boundary. *Mitigation:* pin 16.4.2 exactly and keep the in-route cookie re-check the plan already requires.

**R17 — `qrcode` imported from a client component.** Medium · Low. Its `browser` field maps `fs` to false and swaps the entry, dragging `pngjs` into the bundle [S25]. *Mitigation:* `lib/upi.js` is server-only (imported from RSC/route handlers); the pay page receives an SVG string.

**R18 — Hindi amount-in-words lacks the closing word.** High · Low. `hi-IN` `texts.only` is `''` [S23]. *Mitigation:* append "मात्र" in `inWords(paise,'hi')`; `en-IN` already yields "Rupees One Lakh Eighteen Thousand Only" [S24].

**R19 — The LLD's Playwright e2e.** Medium · Medium (time). Browser download in CI and a flaky login flow for a test no judge sees. *Mitigation:* cut; the Sunday acceptance suite is manual on the deployed URL.

**R20 — Lightning CSS/Turbopack and `@page` margin boxes.** Low · Low (unverified). *Mitigation if print CSS misbehaves:* ship it as `public/print.css` with `<link rel="stylesheet" media="print">` — bypasses the bundler entirely.

**R21 — Render cron container lacks `curl`.** Low · Low. *Mitigation:* start command uses Node's global `fetch` (`node -e …`), build command `echo skip`; Node is guaranteed by `runtime: node` [S10].

## 4. Pre-kickoff checks that are NOT project code (≈45 min total, Fri afternoon)

1. **Scratch probe (20 min, in `~/scratch`, deleted afterwards):** `npx create-next-app@16.4.2 probe --js --app --tailwind --no-eslint --no-src-dir --import-alias "@/*" --use-npm --yes` → `npx shadcn@4.22.1 init -y -b neutral && npx shadcn@4.22.1 add -y button chart` → `npm i pg@8.23.1 recharts@3.10.1 react-is@19.3.1 qrcode@1.5.4 to-words@7.4.0 @fontsource/noto-sans@5.3.0 @fontsource/noto-sans-devanagari@5.3.0` → one server page importing `pg` and `qrcode.toString(...,{type:'svg'})`, one `'use client'` chart with `responsive`, `export const dynamic='force-dynamic'` in the layout → `npm run build && npm start`. Pass = clean build, no `cloudflare:sockets`/`fs` resolve errors, no width(0) warning, `.jsx` files generated, Devanagari visible in print preview. Also `node -e "import('to-words').then(({ToWords})=>console.log(new ToWords({localeCode:'hi-IN',converterOptions:{currency:true}}).convert(118000)))"`.
2. **pg TLS probe (5 min):** in the same dir, `node -e` with `new Pool({connectionString: EXT_URL+'?sslmode=require'}).query('select 1')`, then `?sslmode=no-verify`; write the result in the decisions log.
3. **Render Workflow hello-world (P0.3, 15 min):** `render workflows init` → `render workflows dev -- npm start` → `render workflows tasks start calculateSquare --local --input='[5]'` → push to a scratch repo → create via Dashboard (Node, `npm install` / `npm start`) → trigger from the Tasks page → then try a scratch `render.yaml` with `type: workflow` and `rootDir`.
4. **Resend (P0.4):** DNS now; after Verified, one `curl` send to a non-owner address.
5. **Team OS check (1 min):** who runs macOS; lockfile rule agreed.

## 5. Recommended pins and skeleton files

**`.npmrc`**: `save-exact=true` · **`.node-version`**: `22.23.4` (also set `NODE_VERSION=22.23.4` on the workflow service).

**Root `package.json`** (no `"type"` field; `next.config.mjs`, `postcss.config.mjs` as create-next-app generates them):
```json
{
  "name": "fullpay", "private": true, "version": "0.1.0",
  "engines": { "node": ">=22.12 <23" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node db/migrate.js && next start",
    "test": "node --test \"tests/**/*.test.js\"",
    "db:migrate": "node db/migrate.js",
    "db:seed": "node db/seed.js"
  },
  "dependencies": {
    "next": "16.4.2", "react": "19.3.1", "react-dom": "19.3.1", "react-is": "19.3.1",
    "pg": "8.23.1", "resend": "6.34.1",
    "recharts": "3.10.1",
    "radix-ui": "1.8.1", "lucide-react": "1.61.0", "class-variance-authority": "0.7.1",
    "clsx": "2.1.1", "tailwind-merge": "3.7.0",
    "qrcode": "1.5.4", "papaparse": "5.7.0", "fuse.js": "7.5.0", "to-words": "7.4.0",
    "@fontsource/noto-sans": "5.3.0", "@fontsource/noto-sans-devanagari": "5.3.0"
  },
  "devDependencies": {
    "tailwindcss": "4.3.3", "@tailwindcss/postcss": "4.3.3", "tw-animate-css": "1.4.0"
  }
}
```
Notes: Render sets `NODE_ENV=production` at runtime only, not at build, so devDependencies install during the build [S49]; if a build ever says "Cannot find module 'tailwindcss'", add `NPM_CONFIG_PRODUCTION=false`. Not installed: `react-to-print`, `eslint`/`eslint-config-next` (no `next lint` in 16; nobody scores lint), `@playwright/test`, `node-cron` (fallback only; `node-cron@4.6.0` if R3's last resort fires — it is also in Next's default external list).

**`workflows/package.json`**: `{"name":"fullpay-workflows","private":true,"dependencies":{"@renderinc/sdk":"1.4.0"}}` and **`workflows/index.cjs`**:
```js
const { task } = require("@renderinc/sdk/workflows");
task({ name: "daily-tick", timeoutSeconds: 120, retry: { maxRetries: 0 } }, async () => {
  const r = await fetch(process.env.APP_URL + "/api/tick", { method: "POST", headers: { "x-tick-secret": process.env.TICK_SECRET } });
  if (!r.ok) throw new Error("tick " + r.status);
  return r.json();
});
```

**`render.yaml` fragments** (web + db + cron as already planned; these two are the changes):
```yaml
- type: workflow
  name: fullpay-workflows
  runtime: node
  rootDir: workflows
  buildCommand: npm ci
  startCommand: node index.cjs
  envVars:
    - { key: NODE_VERSION, value: "22.23.4" }
    - { key: APP_URL, sync: false }
    - key: TICK_SECRET
      fromService: { type: web, name: fullpay-web, envVarKey: TICK_SECRET }
- type: cron
  name: fullpay-daily-tick
  runtime: node
  schedule: "30 4 * * *"        # 10:00 IST
  buildCommand: echo skip
  startCommand: >-
    node -e "fetch('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+process.env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:'fullpay-workflows/daily-tick',input:[]})}).then(r=>{console.log(r.status);process.exitCode=r.ok?0:1})"
  envVars:
    - { key: RENDER_API_KEY, sync: false }
```
Add `TZ: Asia/Kolkata` to the web service envVars.

**`lib/db.js` shape** (pins the R9/R13 decisions): `const pool = globalThis.__fullpayPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }); pool.on('error', …)` plus the four `setTypeParser` lines already in the reference library; the URL carries `sslmode` only when it is the external one.

**`.github/workflows/ci.yml`**:
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    env: { TZ: Asia/Kolkata }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version-file: .node-version, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build   # catches prerender/Turbopack errors before Render does; needs no DATABASE_URL once force-dynamic is set
```

## 6. Schedule deltas this implies

- Dev B Sat 9 AM–2 PM: "Invoify-based template" → "own `InvoicePrint.jsx` (Invoify look as reference)", +1 h realistic; funded by the react-to-print and Playwright cuts (−1.5 h).
- P1.2 adds `export const dynamic = 'force-dynamic'` to the root layout and `TZ` to all three environments (10 min).
- P0.3 gains the local task-server run and the Blueprint `type: workflow` trial; P0.2 gains the pg TLS probe; a new P0 row holds the scratch probe.
- Sat 2 PM gate wording: "Workflow run id on an event row in production, else cron-job.org → task-runs; if Workflows are hopeless, `instrumentation.js` + node-cron and we drop the track claim, not the demo."

## 7. Sources

- [S1] npm registry, `next@latest` metadata (16.4.2; engines `>=20.9.0`; peers) — https://registry.npmjs.org/next/latest ; publish time via `npm view next time` (16.4.2 → 2026-10-15)
- [S2] Next.js "How to upgrade to version 16" (Node 20.9+, Turbopack default, async APIs, `middleware`→`proxy`, `next lint` removed) — https://nextjs.org/docs/app/guides/upgrading/version-16
- [S3] CVE-2026-64642 / GHSA-6gpp-xcg3-4w24 (proxy bypass, fixed 16.2.11) — https://app.opencve.io/cve/CVE-2026-64642
- [S4] npm registry `latest` for react, react-dom, react-is (19.3.1), tailwindcss/@tailwindcss/postcss (4.3.3), radix-ui (1.8.1), lucide-react (1.61.0), class-variance-authority, clsx, tailwind-merge (3.7.0), tw-animate-css (1.4.0), @fontsource/noto-sans(-devanagari) (5.3.0) — https://registry.npmjs.org/<pkg>/latest
- [S5] npm registry `shadcn@latest` (4.22.1, ESM-only, Node ≥20.18.1) — https://registry.npmjs.org/shadcn/latest
- [S6] npm registry `recharts@latest` (3.10.1; peers incl. react-is; immer ^11.1.8) — https://registry.npmjs.org/recharts/latest
- [S7] shadcn `components.json` docs (`tsx`, `rsc`, `style: new-york`, blank `tailwind.config` for v4, aliases from jsconfig) — https://ui.shadcn.com/docs/components-json
- [S8] shadcn CLI `isTsx` detection from `tsconfig.*` glob — https://github.com/shadcn-ui/ui/blob/main/packages/registry/src/get-project-info.ts ; Next install page — https://ui.shadcn.com/docs/installation/next
- [S9] npm registry `@renderinc/sdk@latest` (1.4.0; no `type`; `./workflows` export; deps; Node ≥18) — https://registry.npmjs.org/@renderinc/sdk/latest
- [S10] Render Blueprint spec (`type: workflow`; workflow runtime node/python; cron `schedule`, `buildCommand` required for non-Docker) — https://render.com/docs/blueprint-spec
- [S11] Render Workflows overview (Blueprints supported; no scheduling; TS/Python only; no previews/replication) — https://render.com/docs/workflows ; defining tasks (timeouts, retries, 4 MB args) — https://render.com/docs/workflows-defining ; tutorial (Dashboard creation, Start Task) — https://render.com/docs/workflows-tutorial
- [S12] Render Workflows TypeScript examples (`"type":"module"`, `npm install && npm run build` / `node dist/main.js`, `render workflows dev -- …`, `render workflows tasks start … --local`) — https://github.com/render-examples/render-workflows-examples-ts (etl-job/template.yaml, hello-world/template.yaml)
- [S13] recharts 3.3.0 release notes (`responsive` prop) — https://newreleases.io/project/npm/recharts/release/3.3.0
- [S14] Chakra UI charts installation notes (Recharts 3.6+ with React 19, immer 11.0.0 bug, prefer `responsive` prop) — https://chakra-ui.com/docs/charts/installation
- [S15] recharts issue on zero initial width/height — https://github.com/recharts/recharts/issues/1767 ; shadcn chart "now uses Recharts v3" — https://ui.shadcn.com/docs/components/chart
- [S16] npm registry `react-to-print@latest` (3.3.0, peer react `~19`) — https://registry.npmjs.org/react-to-print/latest
- [S17] Next.js `serverExternalPackages` default list (includes `pg`, `node-cron`, `puppeteer`) — https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
- [S18] pg-connection-string README (`sslmode=require` → `ssl: true`; `no-verify` → `rejectUnauthorized:false`; `uselibpqcompat`) — https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/README.md ; pg changelog — https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md ; `pg@latest` 8.23.1 — https://registry.npmjs.org/pg/latest
- [S19] Render "Creating and connecting to Render Postgres" (external TLS mandatory, Render-managed certs, `sslmode=require`, SNI, internal self-signed optional TLS, 100 connections <8 GB) — https://render.com/docs/postgresql-creating-connecting
- [S20] Next.js route segment config `dynamic` ('force-dynamic' = render per request; applies to layout/page/route) — https://nextjs.org/docs/app/guides/caching-without-cache-components and https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- [S21] Next.js `connection()` ("prerendering stops here") — https://nextjs.org/docs/app/api-reference/functions/connection
- [S22] npm registry `to-words@latest` (7.4.0, Node ≥20, 137 locales) — https://registry.npmjs.org/to-words/latest
- [S23] to-words `hi-IN` locale (Devanagari; `only: ''`) — https://raw.githubusercontent.com/mastermunj/to-words/master/src/locales/hi-IN.ts ; locale listing — https://api.github.com/repos/mastermunj/to-words/contents/src/locales
- [S24] to-words `en-IN` locale (`Rupees`, `Only`) — https://raw.githubusercontent.com/mastermunj/to-words/master/src/locales/en-IN.ts
- [S25] npm registry `qrcode@latest` (1.5.4; `browser` field; pngjs/yargs/dijkstrajs) — https://registry.npmjs.org/qrcode/latest ; [S25b] `papaparse@latest` 5.7.0 — https://registry.npmjs.org/papaparse/latest ; [S25c] `fuse.js@latest` 7.5.0 dual ESM/CJS — https://registry.npmjs.org/fuse.js/latest
- [S26] Resend Node SDK `replyTo` field — https://github.com/resend/resend-node/blob/main/src/emails/interfaces/create-email-options.interface.ts ; `resend@latest` 6.34.1 Node ≥20 — https://registry.npmjs.org/resend/latest
- [S27] Resend 403 with resend.dev (only the account owner's inbox) — https://resend.com/docs/knowledge-base/403-error-resend-dev-domain ; add a domain (DKIM/SPF/MX, 15 min–72 h) — https://resend.com/docs/add-a-domain.md
- [S28] Resend send-email API (`from` as `Name <email>`, Idempotency-Key 24 h) — https://resend.com/docs/api-reference/emails/send-email
- [S30] Invoify `package.json` on `master` (Next 15.3.8, React 18.2.0, TS, Tailwind 3.3.5, puppeteer-core, next-intl, zod) — https://raw.githubusercontent.com/al1abb/invoify/master/package.json ; repo metadata (MIT, default branch master, pushed 2026-08-24) — https://api.github.com/repos/al1abb/invoify
- [S31] Invoify template tree (`layouts/*.tsx`, `parts/index.tsx`, `invoiceTheme.ts`, `pdfStyles.generated.ts` 1 MB, `services/invoice/server/*`) — https://api.github.com/repos/al1abb/invoify/git/trees/master?recursive=1 ; `layouts/Classic.tsx` — https://raw.githubusercontent.com/al1abb/invoify/master/app/components/templates/invoice-pdf/layouts/Classic.tsx
- [S32] Invoify `lib/schemas.ts` (single `taxDetails`, no per-line tax/HSN) — https://raw.githubusercontent.com/al1abb/invoify/master/lib/schemas.ts
- [S33] react-to-print README (parent nodes absent from print DOM; `fonts` option; Tailwind notes) — https://cdn.jsdelivr.net/npm/react-to-print@3.3.0/README.md
- [S34] Render "Setting your Node.js version" (default 24.22.1 for services created ≥ 2026-10-21; precedence; upper bound advice) — https://render.com/docs/node-version
- [S35] Node.js release index (v22.23.4 latest 22; v24.22.1 LTS "Krypton") — https://nodejs.org/dist/index.json
- [S36] actions/setup-node README (`node-version-file`, `cache: npm`); releases checkout v7.0.1, setup-node v7.1.0 — https://github.com/actions/setup-node ; https://api.github.com/repos/actions/checkout/releases/latest ; https://api.github.com/repos/actions/setup-node/releases/latest
- [S37] npm/cli issue #4828 (lockfile omits other platforms' optional deps; `npm ci` silently skips them) — https://github.com/npm/cli/issues/4828 ; [S38] npm/cli issue #8320 — https://github.com/npm/cli/issues/8320
- [S39] Netlify/Tailwind oxide lockfile case — https://www.hackdesign.org/docs/solutions/build-errors/netlify-tailwind-oxide-pnpm-lock.html ; Render build-failure guide — https://render.com/tutorials/when-deploys-go-wrong/build-failures
- [S40] Next.js instrumentation (`register()` runs once per server start; `NEXT_RUNTIME` check) — https://nextjs.org/docs/app/guides/instrumentation
- [S41] Next.js e2e test "google-fetch-error" (dev warns, build errors) — https://github.com/vercel/next.js/blob/canary/test/e2e/next-font/google-fetch-error.test.ts ; [S42] NixOS thread "Failed to fetch `Inter` from Google Fonts" — https://discourse.nixos.org/t/how-to-buildnpmpackage-with-nextjs-and-google-fonts/45649
- [S43] Node.js CLI `TZ` environment variable — https://nodejs.org/api/cli.html#tz
- [S44] Node.js packages: "Syntax detection is enabled by default" — https://nodejs.org/docs/latest-v22.x/api/packages.html#syntax-detection
- [S45] Node.js test runner (default patterns `**/*.test.{cjs,mjs,js}`, process isolation) — https://nodejs.org/docs/latest-v22.x/api/test.html
- [S46] Render free instances (Postgres 30 days + 14 grace, 1 GB, no pooling; web spin-down 15 min; 750 h) — https://render.com/docs/free
- [S47] Render community: build containers limited to 8 GB — https://community.render.com/t/failed-to-build-due-to-out-of-memory-issues-for-next-js-app/11813
- [S48] Render community: 512 MB runtime OOM / next/image — https://community.render.com/t/next-js-app-with-13mb-image-server-failed-out-of-memory/1686 ; https://community.render.com/t/server-unhealthy-ran-out-of-memory-used-over-512mb-while-running-your-code/14648
- [S49] Render environment variables (`NODE_ENV=production` default at runtime only; `PORT` 10000) — https://render.com/docs/environment-variables
- [S50] Render REST `POST /v1/task-runs` — https://api-docs.render.com/reference/createtask/ ; cron-job.org FAQ (custom headers, 30 s timeout) — https://cron-job.org/faq/


## Candidate additions

- **Drop react-to-print; print routes + window.print()** (Technical Execution, ~10 min, demo-visible: True) — Do not install react-to-print. Each /print/{invoice,letter,bundle}/[id] page gets one button: 'Print / Save as PDF' → window.print(); print CSS is `@page { size: A4; margin: 12mm }` + `@media print` in globals.css (fallback: public/print.css linked with media="print" if the bundler ever touches @page). _Why:_ Technical Execution judges open the PDF: react-to-print copies only the printed subtree into an iframe, so next/font variables and Devanagari fonts set on <html> are lost unless re-declared (its own README). A real page printed by Chrome embeds ₹ and Hindi correctly with zero extra code — the pack's 'browser Save as PDF, no PDF library' rule met literally.
- **Replace the Invoify fork with our own 150-line A4 Tax Invoice component** (Technical Execution, ~120 min, demo-visible: True) — Dev B Sat 9 AM–2 PM: write components/print/InvoicePrint.jsx (header with GSTIN, both parties, place of supply + state code, items table HSN·qty·unit·rate·discount·taxable·CGST/SGST or IGST·total, round-off, amount in words, UPI QR SVG, reverse-charge line, ship-to, signature). Open Invoify's layouts/Classic.tsx and invoiceTheme.ts only as a visual reference (spacing, density scale, accent colour). _Why:_ Invoify's Aug-2026 refactor is React 18.2 + TypeScript + Tailwind 3 + Puppeteer with a 20 KB shared parts file typed against a schema that has one tax line and no HSN/GST split. Lifting it costs more than writing the GST table we need; a clean component is what judges will read in the repo and see in the PDF.
- **force-dynamic at the root layout + CI build without a database** (Technical Execution, ~5 min, demo-visible: False) — app/layout.js: `export const dynamic = 'force-dynamic'`. lib/db.js is imported only from server files (RSC, route handlers). CI runs `npm run build` with no DATABASE_URL so any page that would prerender against the DB fails the build in GitHub, not on Render. _Why:_ Without it, the dashboard is baked at build time and /verify/[hash] is cached after its first hit — after the nightly reseed every judge sees stale numbers or a 'record not found', silently. One line prevents the single most likely silent demo failure.
- **Vendor Noto Sans + Noto Sans Devanagari via fontsource (no Google Fonts at build)** (Design & UX, ~10 min, demo-visible: True) — `npm i @fontsource/noto-sans@5.3.0 @fontsource/noto-sans-devanagari@5.3.0`; in app/globals.css: `@import "@fontsource/noto-sans/400.css"; @import "@fontsource/noto-sans/600.css"; @import "@fontsource/noto-sans-devanagari/400.css"; @import "@fontsource/noto-sans-devanagari/600.css";` and `font-family: 'Noto Sans', 'Noto Sans Devanagari', system-ui`. Do not use next/font/google. _Why:_ next/font/google aborts `next build` when fonts.googleapis.com is slow or unreachable from Render's build box; vendored fonts also guarantee the Hindi print pages and the ₹ glyph render identically on the judges' machines (UX4G asks for Noto Sans).
- **Pin Node 22.23.4 everywhere (Render now defaults to 24.22.1)** (Technical Execution, ~5 min, demo-visible: False) — `.node-version` = 22.23.4 at repo root; `engines: { node: '>=22.12 <23' }`; `NODE_VERSION=22.23.4` env var on the Render workflow service (rootDir=workflows may not see the root file); CI uses setup-node@v7 with node-version-file. _Why:_ Render's default Node for services created on or after 2026-10-21 is 24.22.1; without a pin, dev (22), CI and prod run different majors and the 'works on my laptop' hour is spent on Sunday.
- **Workflow task as plain CommonJS (workflows/index.cjs) validated with the CLI's local task server** (Technical Execution, ~15 min, demo-visible: True) — workflows/package.json has only `@renderinc/sdk: 1.4.0`; index.cjs does `const { task } = require('@renderinc/sdk/workflows')` and defines `daily-tick` (timeoutSeconds 120, maxRetries 0) that POSTs APP_URL/api/tick with x-tick-secret. Render service: runtime node, rootDir workflows, build `npm ci`, start `node index.cjs`; TICK_SECRET via Blueprint `fromService … envVarKey`. P0.3 adds `render workflows dev -- node index.cjs` + `render workflows tasks start daily-tick --local --input='[]'` on the scratch hello-world. _Why:_ Removes every ESM/CJS interop question (the SDK ships CJS with a dual exports map) and lets the team prove the task runs before deploying — the bonus-track qualifier is verified on Friday night instead of debugged at the Sat 2 PM gate.
- **Cron start command via Node's fetch + cron-job.org backup trigger** (Technical Execution, ~10 min, demo-visible: True) — render.yaml cron: runtime node, buildCommand `echo skip`, startCommand `node -e "fetch('https://api.render.com/v1/task-runs',{method:'POST',headers:{Authorization:'Bearer '+process.env.RENDER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({task:'fullpay-workflows/daily-tick',input:[]})}).then(r=>{console.log(r.status);process.exitCode=r.ok?0:1})"`. Also create a cron-job.org job at 10:05 IST that POSTs the same URL with the same Authorization header (custom headers are supported). _Why:_ No dependency on curl being in the cron image, no npm install in the cron container, and a second scheduler that still exercises the Render Workflow — the 'this ran at 10 AM without us' beat survives a Render cron misconfiguration.
- **IST pinned in three places + one timezone test** (Technical Execution, ~10 min, demo-visible: False) — lib/time.js computes 'today' with `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'})` (never `new Date().toISOString().slice(0,10)`); set `TZ=Asia/Kolkata` in render.yaml envVars, in ci.yml `env`, and in .env.example; tests/time.test.js runs one assertion with `process.env.TZ='UTC'` to prove the IST date is still returned. _Why:_ The tick runs at 04:30 UTC; a UTC 'today' makes every rung a day late and breaks the pack's 'whole IST days' rule — exactly what the judges' Debug prompt 'Reminders on the wrong day' tests.
- **Linux-only lockfile rule + .npmrc save-exact** (Technical Execution, ~5 min, demo-visible: False) — `.npmrc`: `save-exact=true`. package-lock.json is generated on Ved's Linux machine and only ever regenerated there (`rm -rf node_modules package-lock.json && npm install`). Render build command stays `npm ci && npm run build`. _Why:_ A Mac-generated lockfile omits @tailwindcss/oxide-linux-x64-gnu / lightningcss-linux-x64-gnu and `npm ci` dies on Render and in Actions with 'Cannot find module' — a known npm bug that has cost other teams their deploy. Exact pins mean the Sunday freeze really is frozen.
- **lib/db.js: globalThis pool singleton, max 5, sslmode decided by the Friday probe** (Technical Execution, ~10 min, demo-visible: False) — `const pool = globalThis.__fullpayPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }); pool.on('error', e => console.error(e))` plus the four setTypeParser lines. Render services use the internal URL (no sslmode). Laptops/CI use the external URL with `?sslmode=require` if Friday's probe verifies, else `?sslmode=no-verify`; never combine a URL sslmode with an `ssl` object. _Why:_ Free Postgres allows 100 connections and no pooling; Next dev HMR re-creates modules, so an un-memoised Pool leaks connections until 'too many clients' mid-demo-prep. Deciding TLS once removes the classic 'self-signed certificate' hour.
- **recharts in a 'use client' wrapper with the responsive prop** (Technical Execution, ~10 min, demo-visible: True) — components/charts/ForecastChart.jsx starts with 'use client', renders `<BarChart responsive height={240} data={weeks}>` (recharts ≥3.3 prop) inside a div with explicit height; dashboards import it via `next/dynamic(() => import('./ForecastChart'), { ssr: false })` so no SSR zero-size warning appears in the judges' console. _Why:_ The pack's finish checklist says 'no console errors on any screen'; the width(0)/height(0) warning and a hydration mismatch are the most common recharts-in-App-Router console noise.
- **Hand-written components.json fallback for the JavaScript project** (Technical Execution, ~5 min, demo-visible: False) — If `npx shadcn@4.22.1 init -y -b neutral` misbehaves in the --js app, commit components.json directly: `{"$schema":"https://ui.shadcn.com/schema.json","style":"new-york","rsc":true,"tsx":false,"tailwind":{"config":"","css":"app/globals.css","baseColor":"neutral","cssVariables":true},"aliases":{"components":"@/components","utils":"@/lib/utils","ui":"@/components/ui"}}` and run `npx shadcn@4.22.1 add button card dialog input label select switch table tabs tooltip` — components land as .jsx. _Why:_ Keeps Dev B's Friday-night shell on schedule regardless of CLI prompts; shadcn's detection of JS vs TS is simply 'is there a tsconfig.*', so the explicit file is authoritative.
- **Cut the LLD's Playwright e2e** (Technical Execution, ~0 min, demo-visible: False) — Remove 'e2e (Playwright, one)' from LLD §12; CI = `npm test` (node:test) + `npm run build`. The Sunday acceptance suite stays manual on the deployed URL. _Why:_ Saves ~1 h of browser download, login-flow flake and CI time that no judge sees; the ~50 money-path unit tests and a green build badge are what the repo reviewer reads.
- **Append 'मात्र' to Hindi amount-in-words** (Design & UX, ~5 min, demo-visible: True) — lib/money.js `inWords(paise, lang)`: for 'hi' use `new ToWords({ localeCode: 'hi-IN', converterOptions: { currency: true, ignoreDecimal: false } })` and append ' मात्र'; for 'en' use en-IN unchanged ('Rupees One Lakh Eighteen Thousand Only'). Test both strings for ₹1,18,000. _Why:_ to-words' hi-IN locale has an empty 'only' text, so the Hindi invoice would read as an unfinished sentence; 'केवल … रुपये मात्र' is how Indian invoices phrase it, and the pack grades the words line.
- **20-minute scratch probe before kickoff (not project code)** (Technical Execution, ~20 min, demo-visible: False) — In ~/scratch: `npx create-next-app@16.4.2 probe --js --app --tailwind --no-eslint --no-src-dir --import-alias "@/*" --use-npm --yes`; `npx shadcn@4.22.1 init -y -b neutral && npx shadcn@4.22.1 add -y button chart`; install pg, recharts, react-is, qrcode, to-words, the two fontsource packages at the §5 pins; add one server page (pg + qrcode SVG), one client chart, `dynamic='force-dynamic'`; `npm run build && npm start`; run the to-words hi-IN one-liner and the pg `sslmode=require` vs `no-verify` probe against the external Render URL; delete the folder. _Why:_ Every compatibility assumption in the plan (shadcn JS output, Tailwind v4 natives on Linux, Turbopack with pg/qrcode, recharts React 19, Hindi words, Render TLS) is proven in one sitting while it is still legal to not be writing project code — Friday night then starts with zero unknowns.

## Risks

- **Next.js prerenders DB-backed pages at build time / caches dynamic pages after first hit** (L: High, I: High — build fails on Render (DB unreachable from the build box) or dashboard and /verify pages silently show stale data after reseeds) — `export const dynamic = 'force-dynamic'` in app/layout.js (covers all routes and route handlers); `await connection()` in any helper that must run per request; CI runs `npm run build` without DATABASE_URL to catch regressions
- **Resend sending domain not verified before the autonomy beat is recorded** (L: Medium, I: High for the 'this ran at 10 AM without us' beat — unverified domains cannot send, and resend.dev only reaches the account owner) — Start DNS today (P0.4); Sat 2 PM rule: if not Verified, set MAIL_FROM=onboarding@resend.dev and MAIL_TEST_MODE=1 so every reminder lands in the owner inbox (still a real email on camera); use `replyTo` (camelCase) in the SDK
- **Render Workflow creation/runtime friction (Dashboard vs Blueprint, rootDir, Node version, env vars)** (L: Medium, I: Medium — bonus-track credits at stake, not the demo; could burn Dev A's Saturday morning) — workflows/index.cjs with require(), NODE_VERSION env on the service, TICK_SECRET via fromService envVarKey; fallback 1: cron-job.org POSTs api.render.com/v1/task-runs; fallback 2: node-cron from instrumation.js register() (loses the track claim only)
- **macOS-generated package-lock.json omits Linux native binaries (Tailwind v4 oxide, Lightning CSS, Next SWC)** (L: Medium, I: High — `npm ci` fails on Render and in GitHub Actions with 'Cannot find module …linux-x64-gnu') — Generate and regenerate the lockfile only on Linux; .npmrc save-exact=true; keep `npm ci` so drift is loud; if a Mac must regenerate, `rm -rf node_modules package-lock.json && npm install` on Linux before commit
- **Invoify cannot be lifted into a plain-JS Next 16 app in the time budgeted** (L: High, I: Medium — Dev B's Sat 9–2 slot overruns; the plan assumed ~8 h saved) — Write our own ~150-line A4 Tax Invoice component (2 h) using Invoify only as a visual reference; re-label the slot now
- **react-to-print iframe drops fonts and CSS variables set on <html> (Devanagari and ₹ wrong in the PDF)** (L: Medium, I: Medium — the GST invoice and demand letter PDFs are judged artefacts) — Do not install react-to-print; /print/* routes + window.print() + @page A4 CSS
- **next/font/google aborts the production build when Google Fonts is unreachable** (L: Low-Medium, I: High — a Render deploy fails during the freeze window) — Vendor Noto Sans + Noto Sans Devanagari with @fontsource packages (CSS imports) or next/font/local
- **UTC runtime on Render and CI shifts IST day boundaries (tick at 04:30 UTC)** (L: High, I: Medium — rungs fire a day late; fails the pack's 'whole IST days' rule) — lib/time.js uses timeZone 'Asia/Kolkata' explicitly; TZ=Asia/Kolkata in render.yaml, ci.yml and .env.example; one test runs with TZ=UTC
- **pg TLS verification against the external Render Postgres URL from laptops/CI** (L: Medium, I: Low — affects local dev and CI only; Render services use the internal URL) — `?sslmode=require` if the probe verifies, else `?sslmode=no-verify` (pg-specific) on the external URL only; never mix URL sslmode with an ssl object; always connect by hostname (SNI)
- **Turbopack and node:test resolve modules differently (@/ alias, extension-less imports)** (L: High, I: Low-Medium — an hour lost on Friday night when the first test imports lib/money.js) — lib/** and tests/** use relative imports with explicit .js; @/ only in app/ and components/; keep create-next-app defaults (no "type":"module"); Node 22 syntax detection runs ESM .js files
- **shadcn CLI init in a JavaScript (no tsconfig) Next 16 project** (L: Low-Medium, I: Low — shell setup slips 30 min) — Hand-written components.json with tsx:false, rsc:true, style new-york, blank tailwind.config, jsconfig aliases
- **recharts SSR zero-size warning / server-component import** (L: Medium, I: Low — console error violates the pack's 'no console errors' check) — 'use client' wrapper, `responsive` prop with explicit height, or next/dynamic with ssr:false
- **Free Postgres clock and Starter plan logistics (payment method, 30-day expiry, no pooling, 100 connections)** (L: Low, I: High — no database or a sleeping web service during judging week) — Create the free DB today; add a payment method; Starter web for judging covered by the $50 credit; pool singleton max 5 with pool.on('error')
- **Node version drift: Render defaults new services to 24.22.1 while the team runs 22** (L: Medium, I: Low — behaviour differences surface only on Render) — .node-version 22.23.4, engines with upper bound, NODE_VERSION env on the workflow service, setup-node reads the same file
- **Memory on a 512 MB Starter instance (next/image optimisation) or during build** (L: Low, I: Medium — OOM restarts mid-judging) — No next/image for remote logos (plain <img>, images.unoptimized); NODE_OPTIONS=--max-old-space-size=400 only if an OOM appears; builds run on Render's larger build containers
- **Shipping a Next.js build below the CVE-2026-64642 patch line (proxy.js auth bypass)** (L: Low, I: High — the owner app's only gate is proxy.js plus per-route cookie checks) — Pin next 16.4.2 exactly (fix landed in 16.2.11); keep the per-route session re-check the plan already mandates
- **qrcode imported from a client component pulls Node-only code into the browser bundle** (L: Medium, I: Low — build warnings or a broken pay page) — lib/upi.js is server-only; QR SVG string generated in RSC/route handlers and passed down
- **Hindi amount-in-words ends without 'मात्र' (to-words hi-IN has an empty 'only' text)** (L: High, I: Low — cosmetic but on a judged PDF) — Append ' मात्र' for lang 'hi'; en-IN already produces 'Rupees … Only'
- **Playwright e2e in the LLD becomes a Sunday time sink** (L: Medium, I: Medium — 1 h of CI browser installs and flaky login steps) — Cut it; CI = node --test + next build
- **Render cron container may not include curl** (L: Low, I: Low — cron run fails silently until noticed) — Start command uses Node's global fetch (`node -e …`); build command `echo skip`