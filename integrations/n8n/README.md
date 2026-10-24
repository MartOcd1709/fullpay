# FullPay → n8n: setup guide (about 15 minutes)

FullPay sends a short, signed notice to n8n whenever something important happens. The workflow in this folder turns each
notice into:

- a row in a **Google Sheet** (a live collections register your CA can open), and
- a **Telegram** message to the owner's phone for what needs attention, plus one morning digest after the 10:00 run.

Nothing is sent to customers. No phone number, email address or bank detail ever leaves FullPay.

## What you need

- Your n8n workspace (redeem the HackCache n8n Pro code first, using the steps that came with it).
- A Google account (for the sheet) and Telegram on your phone.
- Access to the FullPay service's environment settings on Render.

Keep every secret to yourself: type tokens and passwords straight into n8n or Render, never into chat or a commit.

## 1. Make a secret

Pick a random string of at least 16 characters. It is shared by FullPay and n8n. In a terminal:

```
openssl rand -hex 24
```

## 2. Import the workflow

In n8n: create a new workflow, open the **⋯** menu, choose **Import from File**, and pick `fullpay-workflow.json` from this
folder. You will see five nodes: *FullPay webhook* → *Row for the register* → *Append to Google Sheet*, and
*FullPay webhook* → *Alert text* → *Telegram to the owner*.

## 3. Connect the three credentials

**FullPay webhook** (Header Auth): open the node, create a new *Header Auth* credential with
- Name: `X-FullPay-Token`
- Value: the secret from step 1

**Append to Google Sheet**:
1. Make a Google Sheet with a tab called `Register` and this header row:
   `Date | Event | Customer | Bill | Amount (₹) | Still owed (₹) | Note | Record`
2. In the node, sign in with Google, and paste the sheet's address into *Document*. Check *Sheet* says `Register`.

**Telegram to the owner**:
1. In Telegram, message **@BotFather**, send `/newbot`, follow the steps, and copy the bot token it gives you.
2. Open your new bot and press **Start** (a bot can only message people who started it).
3. Message **@userinfobot** to get your chat id (a number).
4. In the node, create a *Telegram* credential with the bot token, and paste your chat id into *Chat ID*.

## 4. Turn it on

Switch the workflow to **Active**. Open the *FullPay webhook* node and copy the **Production URL** (it ends in
`/webhook/fullpay`).

## 5. Tell FullPay (on Render)

Render → the FullPay service → **Environment** → add:

| Key | Value |
|---|---|
| `N8N_WEBHOOK_URL` | the Production URL from step 4 |
| `N8N_WEBHOOK_SECRET` | the secret from step 1 |

Save. Render restarts the service with the new settings.

## 6. Test it

FullPay → **Settings** → *Integrations: n8n* should say *Connected to …*. Press **Send a test event**: a row
*Test from FullPay* appears in the sheet and Telegram says *FullPay is connected to n8n.* The card lists the last
deliveries and whether each one arrived.

For the video: open a customer's pay link, tap **Something's wrong**, and watch the Telegram alert and the sheet row
arrive within seconds.

## What FullPay sends

| `type` | When |
|---|---|
| `bill.sent` | a bill is sent (or imported) |
| `payment.confirmed` | a payment is confirmed, with its receipt number |
| `customer.claimed_paid` | the customer says it is already paid |
| `customer.disputed` | the customer says something is wrong |
| `customer.promised` | the customer promises a date |
| `customer.plan_offered` | the customer offers to pay in parts |
| `customer.balance_confirmed` | the customer confirms the balance |
| `promise.broken`, `plan.broken` | a promised date or plan part is missed |
| `letter.ready` | a Payment Demand Letter is drafted (30 days late) |
| `daily_run` | after the 10:00 run: reminders, calls, letters, the first short week of cash |
| `test` | the Settings button |

Each request is a JSON body like:

```json
{
  "id": "evt_3f9a1c21e0b4", "type": "customer.disputed", "at": "2026-10-24T15:02:11+05:30",
  "business": "Arora Auto Components",
  "invoice": { "number": "INV/26-27/0047", "total": 64192, "outstanding": 64192, "due_date": "2026-10-08", "status": "disputed" },
  "customer": { "name": "Malhotra Auto Spares" },
  "details": { "reason": "Rate is higher than our purchase order" },
  "links": { "invoice": "https://…/invoices/47", "verify": "https://…/v/3f9a1c21e0b4d5a7" }
}
```

Amounts are in rupees. Headers: `X-FullPay-Event` (the type), `X-FullPay-Delivery` (the id), `X-FullPay-Token` (the
secret, checked by n8n's Header Auth) and `X-FullPay-Signature` (`sha256=` HMAC of the exact body with the secret, for any
receiver that wants to verify the body too).

## How FullPay behaves

- Notices go out only after the change is saved; a change that is undone sends nothing.
- A slow or broken n8n never slows or blocks FullPay: 3-second timeout, one retry, then a line in *Last deliveries*.
- With no `N8N_WEBHOOK_URL` set, nothing is sent. The address must be `https://` and is set on the server only, never on a
  screen (on a public demo, anyone can be the owner).
- *Send a test event* works at most once a minute.
