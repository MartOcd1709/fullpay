# The 3-minute demo

For judges scoring practical usefulness, invoice management, follow-up automation, accuracy of the money, cash-flow
forecasting, document generation, ease of use, technical execution and real-world impact.
Open https://fullpay-web.onrender.com two minutes early (the free plan wakes in about 50 s), press **Reset demo**, then
**Open the live demo**. Keep a phone with WhatsApp next to the laptop.

| Time | Screen and what to do | What to say (the problem it solves) |
|---|---|---|
| 0:00 | Landing page → **Open the live demo** | "Harpreet makes brake parts in Ludhiana. ₹8.1 lakh crore is stuck in late payments to firms like his, and he has no accounts team." |
| 0:10 | **Dashboard**: money to collect, overdue, the ageing bar, top 5 to chase | "He sees in one screen who owes what and what is already late, instead of a notebook and memory." |
| 0:25 | Dashboard warning → **See the 3 invoices that would cover it** → Cash forecast | "Salaries are due on the 1st. FullPay shows the week cash drops below his safety buffer, weeks ahead, and the three invoices that would close the gap." |
| 0:45 | **Today's follow-ups** → a 7-days-overdue card → **WhatsApp** (opens with the message filled in, pay link included) → **Mark as sent** | "He forgets to follow up and doesn't know how to escalate politely. Every reminder is drafted at the right step, in the customer's language; one tap sends it." |
| 1:05 | Phone: the customer's link `/pay/whoZYlu9YOc2d-scWQ-yx1mX1ukgynkn` → **Something's wrong with this invoice** → "Quantity short" → laptop: **Inbox**, "Reminders paused" | "A disputed bill should not keep getting reminders. The customer tells him from the link, the chasing pauses, and the problem lands in his Inbox." |
| 1:25 | **Payments → Load sample statement** → the card "Short by exactly 2 %, possibly TDS" → **Confirm, and record as TDS** | "Matching bank credits by hand takes hours. FullPay matches every line with a reason, spots that a 2 % shortfall is TDS rather than a short payment, and marks nothing paid until he confirms." |
| 1:45 | **New invoice**: ₹10,000 at 18 % for a Punjab customer (CGST ₹900 + SGST ₹900 = ₹11,800), then switch the place of supply to Haryana (IGST ₹1,800 = ₹11,800) | "GST must be right to the paisa. Same state splits CGST and SGST, another state is IGST, and the total is in words the Indian way." |
| 2:00 | **Invoices → INV/26-27/0042 → Payment Demand Letter** | "At 30 days he needs a firm letter that is clearly not a legal notice. It lists what is owed, the pay-by date, how to pay, and the MSMED Act interest, worked out across the RBI rate change on 7 Oct." |
| 2:20 | Banner **+1 day** (the demo date) → Today's follow-ups and the forecast change | "Time moves and FullPay acts: the next day's reminders are due, and the forecast moves with them." |
| 2:35 | **View as → Accountant**, confirm a payment ("Sent to the owner for approval") → **View as → Owner → Approvals → Approve** | "With staff, nothing that moves money happens without the owner, and the record keeps who prepared and who approved." |
| 2:45 | **Invoices → Import from Tally → Try the Tally sample** | "On day one he brings his existing Tally book in, checked line by line before anything is saved." |
| 2:52 | `/proof` | "And every rule the organisers listed is checked live: 34 of 34 pass, right now." |

Words to avoid on screen and in the voice-over: "legal notice", "penalty", "default". Say "pay-by date" and "interest".

## What could go wrong in a live demo, and how we avoid it

| Risk | How we avoid it |
|---|---|
| The free server is asleep, and the first page takes about 50 s | Open the site two minutes before; optional keep-alive ping (`docs/deploy.md`) |
| Another visitor has changed the shared demo | **Reset demo** in the banner; it also resets every night after 01:00 IST |
| The demo date was moved forward | Reset demo restores the seeded day |
| WhatsApp doesn't open on the laptop | Use the phone, or show the filled `wa.me` link; Mark as sent works either way |
| A real customer gets an email during the demo | Email runs in test mode (`MAIL_TEST_MODE=1`): every email goes to the owner's own address |
| The venue network fails | Run locally (`npm run dev` with the seeded database) and keep the recorded video ready |
| The print preview looks different | Use Chrome's Print → Save as PDF; pages are A4, and the ₹ and Hindi fonts load from the site itself |
| Hindi text appears in boxes | The fonts are self-hosted, not fetched from Google at view time; still, test once on the demo laptop |
| A number looks wrong | `/proof` shows the same calculation, expected against actual, run live |
