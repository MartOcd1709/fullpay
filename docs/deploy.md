# Putting FullPay online (Render, free plan)

FullPay is a Next.js server with a PostgreSQL database, so it runs on Render rather than as static files on Netlify.
Live: https://fullpay-web.onrender.com

## Step by step

1. **Push the repo to GitHub** (it is already at `MartOcd1709/fullpay`).
2. **Sign in to Render** with GitHub and give it access to the repo.
3. **New → Blueprint**, pick the repo. Render reads `render.yaml` and proposes two resources on the free plan:
   `fullpay-web` (web service, Singapore) and `fullpay-db` (PostgreSQL, Singapore).
4. **Fill the values Render asks for** (everything else is generated or fixed in `render.yaml`):
   | Variable | Value |
   |---|---|
   | `OWNER_PASSWORD` | a password for the owner login (the demo buttons don't need it) |
   | `APP_URL` | `https://<your-service>.onrender.com`, used in pay links, letters and QR codes |
   | `MAIL_FROM`, `MAIL_REPLY_TO`, `RESEND_API_KEY` | optional: real email through Resend (needs a verified domain). Leave empty to keep email in test mode |
5. **Apply.** The build runs `npm ci --include=dev && npm run build`; the start command `npm run start:render` creates the
   tables and loads the demo book on the first start, then starts Next.js. First deploy takes about 4 minutes.
6. **Check it:** `https://<your-service>.onrender.com/api/health` shows `"db":"up"` and the commit, `/proof` shows the pack's
   checks passing, `/status` shows the daily runs.
7. **Every push to `main` redeploys** automatically.

## The daily 10:00 IST run

Built in: the server checks every 5 minutes and runs that day's reminders at or after 10:00 IST (`lib/scheduler.js`),
and resets the shared demo after 01:00 IST. Render's free plan puts a service to sleep after 15 minutes without visitors; a
sleeping server catches up on its first visit. For an exact 10:00 send, add a free keep-alive (cron-job.org: `GET /api/health`
every 10 minutes). `/api/tick` with the `x-tick-secret` header also still works for an outside timer, and `render.paid.yaml`
adds a Render cron job and Workflow on a paid plan. A second trigger on the same day does nothing (no stage twice).

## "A page refresh shows a 404"

That happens to single-page apps on static hosts, where only `index.html` exists and `/pay/abc` must be rewritten to it
(Netlify `_redirects`: `/* /index.html 200`; Vercel: a rewrite of `/(.*)` to `/`). FullPay renders every route on the
server, so `/pay/<token>`, `/v/<code>` and every owner screen open directly and survive a refresh; no rewrite is needed.

## If you must use Vercel

It works with a hosted Postgres (for example Neon): set `DATABASE_URL` and the variables above, and run `npm run db:migrate`
and `npm run db:seed` once. Serverless functions don't keep a timer running, so add a Vercel Cron entry that calls
`POST /api/tick` at `30 4 * * *` (04:30 UTC = 10:00 IST) with the `x-tick-secret` header.

## When the deploy fails

| Symptom | Cause and fix |
|---|---|
| Build: `Cannot find module '@tailwindcss/…'` | Dev dependencies skipped: the build command must be `npm ci --include=dev && npm run build` |
| `/api/health` shows `"db":"down"` | `DATABASE_URL` not linked: in the Blueprint it comes from `fullpay-db`; for an external URL add `?sslmode=require` |
| Pay links point at localhost | `APP_URL` not set |
| Emails don't arrive | Resend needs a verified domain; until then `MAIL_TEST_MODE=1` sends everything to `MAIL_TEST_TO` |
| A file works locally but not on Render | Letter case in an import path (Linux is case-sensitive) |
