# 16 — n8n plan: what FullPay sends, what n8n does with it, and what it is worth

Written Sat 24 Oct 2026, 15:15 IST. Status: plan only, waiting for the team's go-ahead. Nothing here is built yet.

## 1. Facts this plan rests on

- n8n is a sponsor perk: every team got n8n Pro (the voucher expires 1 Nov). There is no n8n prize track; the five judging criteria (Innovation, Technical Execution, Design & UX, Impact, Presentation) have no published weights.
- The team decided no real messages go to customers. n8n here only talks to **our own team** (a Google Sheet and a Telegram or email alert to the owner). No customer receives anything from n8n.
- FullPay already writes every business event (bill sent, reminder, payment, dispute, promise, plan, call, daily run) into its tamper-evident record through one function, `event()` in `lib/services/common.js`. That is the single place to hook n8n.

## 2. The idea in one line

FullPay becomes an event source: every time something important happens, it sends a short, signed notice to an n8n webhook, and n8n puts it where the owner and the CA already work (a live Google Sheet, a phone alert).

## 3. What FullPay sends (10 event types, not every record row)

| Event sent to n8n | Comes from | Why the owner cares |
|---|---|---|
| `payment.confirmed` | payment confirmed (with receipt number) | Money in: the CA's sheet updates itself |
| `customer.claimed_paid` | "I've already paid" on the pay link | Check the bank today |
| `customer.disputed` | "Something's wrong" | Fix it before the customer goes quiet |
| `customer.promised` | promise to pay a date | Plan cash around it |
| `customer.plan_offered` | "Pay in parts" offer | Needs your answer: reminders are paused |
| `customer.balance_confirmed` | "Yes, this amount is right" | Proof for the books and any dispute |
| `promise.broken` / `plan.broken` | a promised date or part missed | Time to call |
| `letter.ready` | Payment Demand Letter drafted at 30 days | Decide whether to send it |
| `daily_run` | the 10:00 run summary | One morning digest instead of many pings |
| `test` | the "Send a test event" button in Settings | Proves the connection |

Each notice is small and the same shape (an example, from the demo data):

```json
{
  "id": "evt_3f9a1c21e0b4", "type": "customer.disputed", "at": "2026-10-24T15:02:11+05:30",
  "business": "Arora Auto Components",
  "invoice": { "number": "INV/26-27/0047", "total": 64192, "outstanding": 64192, "due_date": "2026-10-08", "status": "disputed" },
  "customer": { "name": "Malhotra Auto Spares" },
  "details": { "reason": "The brake drums are billed at a higher rate than our purchase order" },
  "links": { "invoice": "https://fullpay-web.onrender.com/invoices/47", "verify": "https://fullpay-web.onrender.com/v/3f9a1c21e0b4d5a7" }
}
```

No phone numbers, no email addresses, no bank details: only what the owner's own sheet needs (DPDP: least data). The `verify` link ties every sheet row back to FullPay's tamper-evident record.

## 4. What n8n does (two workflows we ship as files to import)

**Workflow A — "Collections register" (Google Sheet).** Webhook → keep the event types above → Google Sheets "Append row": Date · Event · Customer · Bill · Amount · Still owed · Link. The CA or accountant opens one sheet and sees every payment, dispute and promise as it happens, without logging in to FullPay or asking for an export.

**Workflow B — "Owner alerts" (Telegram, or Gmail to yourself).** Webhook → Switch on type → one short line to the owner's phone:
- "Kohli Fleet paid ₹97,857.80 for INV/26-27/0058 · receipt RCPT-000053"
- "Malhotra Auto Spares says INV/26-27/0047 is wrong: 'rate higher than our PO' · open: <link>"
- "Garewal Motors offers to pay INV/26-27/0063 in 2 parts · answer in the Inbox"
- Each morning after the 10:00 run: "Today: 3 reminders, 5 calls, 1 letter ready, cash low in week 3".

Telegram is free and takes two minutes to set up (a bot from @BotFather). WhatsApp to the owner would need the WhatsApp Business Platform, which we already decided against.

Both are plain n8n nodes (Webhook, Switch, Google Sheets, Telegram), so the team can change them later without touching FullPay: forward to Zoho Books, Slack, Notion, or the WhatsApp Business node once approved.

## 5. How FullPay sends it (safe by design)

- **After the change is saved, never inside it.** Notices are collected while the request runs and sent once the database commit succeeds (the same way receipt emails go out today). A slow or broken n8n never slows, blocks or undoes the owner's action.
- **Fire and forget, with a log.** 3-second timeout, one retry, then give up. The last 20 deliveries (type, time, HTTP status) show in Settings, so a failure is visible, not silent.
- **Signed.** Each request carries `X-FullPay-Signature: sha256=<HMAC of the body>` and `X-FullPay-Token` for n8n's built-in Header Auth. A stranger who finds the webhook URL cannot post fake payments into the sheet.
- **Configured on the server, not in the screen.** `N8N_WEBHOOK_URL` (https only) and `N8N_WEBHOOK_SECRET` are environment variables on Render. On a shared public demo anyone can be "owner", so the URL must not be editable from Settings: that would let a visitor redirect our data or make the server call internal addresses (SSRF).
- **Off by default.** With no URL set, nothing is sent and nothing changes.
- **Daily run included.** The 10:00 scheduler run is not a web request, so it sends its notices right after its own commit.

Settings gets a small "Integrations: n8n" card: connected or not (host name only), the last deliveries, and "Send a test event".

## 6. What it is worth, honestly

| For | Impact | How big |
|---|---|---|
| The owner | Knows within seconds when a customer pays, disputes, promises or asks to pay in parts, without opening FullPay. Faster answers mean faster money, and a dispute caught today is cheaper than one found at 30 days. | Real, everyday |
| The CA / accountant | A live register in Google Sheets, the tool they already use; no exports, no "send me the list". | Real for Indian MSMEs, where books are often kept by an outside CA |
| Extending FullPay | "Plug it into the tools you already use": n8n connects to hundreds of apps, so new destinations need no FullPay code. | Strong story, small code |
| Judges | Uses the sponsor's tool for a real job, not a toy. Shows up in **Technical Execution** (signed, after-commit, logged), **Impact** (fits how MSMEs and CAs work) and **Presentation** (a live moment in the video). | Modest: no n8n prize, but a visible plus |
| The video | A 5-second beat: the customer taps "Something's wrong" on a phone, and the owner's Telegram alert and the sheet row appear at once. | Good demo moment |

What it does not do: it does not send anything to customers, it is not required by the problem statement, and it adds one outside service to the live demo (if n8n is down, FullPay keeps working and Settings shows the failed deliveries).

## 7. Who does what, and how long

**FullPay side (Claude, about 1.5 hours), in one pull request:**
1. `lib/services/webhooks.js`: the event map, the notice builder (least data), signing, after-commit delivery, the delivery log table.
2. Hook into `event()`, the route wrapper (after commit) and the scheduler (after the daily run).
3. Settings card with "Send a test event" (owner only).
4. `integrations/n8n/collections-register.json` and `integrations/n8n/owner-alerts.json`, ready to import, plus a one-page setup guide.
5. Tests: notice shape and no personal data, signature, filter, off by default, a failing n8n never breaks a payment.
6. README, screenshots, checklist.

**Team side (about 15 minutes):**
1. Claim the n8n Pro voucher (before 1 Nov) and open n8n Cloud.
2. Import the two workflow files.
3. Connect your Google account in the Sheets node; create a Telegram bot with @BotFather and paste its token and your chat id into the Telegram node.
4. Activate both workflows and copy the production webhook URL; pick a secret.
5. On Render: Environment → add `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` (you do this; secrets never go in chat).
6. Press "Send a test event" in Settings and watch the sheet row and the Telegram message arrive.

Fits before the Sunday-noon code freeze with room to spare.

## 8. Decisions needed from the team

1. Go ahead with this plan?
2. Outputs: Google Sheet register + Telegram alerts (recommended), or Gmail to yourself instead of Telegram?
3. Morning digest: yes (recommended, one message a day) or only per-event alerts?
