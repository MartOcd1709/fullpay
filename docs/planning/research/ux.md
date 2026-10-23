# FullPay — UX Specification (lens: Design & UX) · Rev 1 · Fri 23 Oct 2026, Day 0

Scope: the 13 pack screens, `/pay/:token`, `/verify/:hash`, `/print/invoice`, `/print/letter`, `/print/bundle` (+ `/login`, one field). 360 px first, laptop second. Builds on `10_build_plan.md` Rev F.1 (screens, hours, cut list), `13_reference_library.md` Part D `ui` tokens and B4 Hindi terms, and the LLD §10 screen→data map. Nothing here is code; every item is sized against Dev B's slots in plan §5 and marked **EXCEEDS** where it does not fit.

Inputs read: `problemstatement/chase` (pack: design rules, 13 screens, BEFORE-YOU-FINISH list), `10_build_plan.md`, `13_reference_library.md`, `14_build_checklist.md`, `lld.html` §4/§7/§8/§9/§10 (grep), `11_prompt_pack_review.md`, `12_trust_and_security_layer.md`.

## 0. Verdict in ten lines

1. The pack's design rules (360 px, plain words + jargon tooltip, 16 px, 48 px buttons, AA, focus, labelled icons, word on every status, full language switch) are the judges' Design & UX rubric. We pass them with a **12-piece shared kit** built once (§1.6), not per screen.
2. **Hover tooltips fail the pack on phones.** Radix/shadcn `Tooltip` opens on focus or hover only ([Radix docs](https://www.radix-ui.com/primitives/docs/components/tooltip): "Opens when the trigger is focused or hovered"; open touch issues [#1573](https://github.com/radix-ui/primitives/issues/1573), [#2589](https://github.com/radix-ui/primitives/issues/2589)). The plain-word label + accounting-term pair becomes one `Term` component: label + ⓘ button → `Popover` (tap, click, keyboard). Same component everywhere; it also feeds the help sheet's glossary for free.
3. **Hindi is not longer, it is taller.** Measured on 60 label pairs (Node 22 ICU, grapheme clusters): Hindi labels run at a median **65%** of the English grapheme count, but five short English words grow to 125–183% ("Snooze" → "बाद में याद दिलाएँ" 183%, "Pay by" → "इस तारीख तक दें" 183%, "Before GST" → "GST से पहले की रकम" 150%, "Pay by UPI" 130%, "Sent"/"Paid" 125%). Devanagari also needs line-height 1.8 ([UX4G typography](https://ux4g.gov.in/foundations/typography)). Rules: `min-height: 48px` never `height`, buttons may wrap to two lines, 2×2 button grids below `sm`, no uppercase or letter-spacing on `[lang=hi]`.
4. **Light theme only.** The UX4G status tokens (#00522c / #8a1a16 / #ad4e00 / #006d75) pass AA on white and on their tints (5.4:1 to 9.4:1, computed locally with the WCAG formula) and fail on a dark surface (success on #0f172a = 1.9:1). Dark mode would cost ~1 h and new tokens; print is light anyway. Skip it.
5. **Layout in rem only.** Tailwind v4 breakpoints are rem-based (`sm` = 40rem; [Tailwind docs](https://tailwindcss.com/docs/responsive-design)), so the pack's "largest text size" pass is automatic if every width/gap is rem: raising root font-size reflows the grid by itself. Text size = `html { font-size: 16 / 18 / 20px }`, three steps (LLD has two: 1rem/1.125rem — widen to three, zero cost).
6. **Dashboard hierarchy** (§2): two hero tiles (to collect, overdue) → one forecast alert strip → "Chase these first" top-5 with one-tap buttons → ageing bar with worded legend → four small tiles. Owner reads "how much is out, how much is late, is cash OK, who to call" in two seconds.
7. **Escalation timeline with hash stamps** (§3, the named Design & UX signature): one vertical thread where the connector line *is* the chain, every event carries a monospace `#3f9a…c21e` stamp that opens a sheet with the full hash, its previous link, a QR and "Open verify page"; future rungs are hollow milestones ("Next: Final reminder · in 4 days"); a "Chain intact · 14 records" strip sits on top. This single component also renders the pack's "Escalation ladder" visual, the Documents screen and the bundle's printed timeline.
8. **Four screens are filtered views, not screens.** Chase-these-first, Documents, Customers detail and the dashboard top-5 all render the same `InvoiceRow` list and `Timeline`. That is where Dev B's two over-budget slots (Sat 2–7 PM and Sat 7–11 PM, each ~45 min over) are recovered.
9. **Status = icon + word, always** (pack rule; [Medhi, Sagar, Toyama 2007](https://www.microsoft.com/en-us/research/?p=160568); [UX4G accessibility](https://ux4g.gov.in/foundations/accessibility): "Never rely on color alone"). Seven invoice statuses + paused/promise/chain states have a fixed lucide icon and i18n word (§1.4).
10. Budget: 22.5 Dev B hours against ~24.5 h of spec. With the four remedies in §6 it fits with ~15 min slack. Items marked **EXCEEDS** are the ones to drop first, in cut-list order.

## 1. Global system

### 1.1 Type, size, language
- Fonts: Noto Sans + Noto Sans Devanagari via `next/font/google` (self-hosted at build, no runtime fetch on 4G; [Next.js font](https://nextjs.org/docs/app/api-reference/components/font); [Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari)). Stack `"Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif` ([UX4G typography](https://ux4g.gov.in/foundations/typography) prescribes Noto Sans with system-ui fallback).
- Body 16 px (1rem), minimum anywhere 12 px for print footnotes only; UX4G: "Minimum body size 16px (absolute floor 12px)". Inputs 16 px (also avoids iOS Safari's focus auto-zoom on sub-16 px fields, community-documented: [456bereastreet](https://456bereastreet.com/archive/201212/ios_webkit_browsers_and_auto-zooming_form_controls)).
- Line-height 1.5 Latin, **1.8 when `html[lang=hi]`** (UX4G: "Line-height: 1.8 (increased for ascenders/descenders)"). Implement as one CSS rule on `[lang=hi]`, not per component.
- `[lang=hi] { text-transform: none; letter-spacing: normal; }` — Devanagari has no case, and Indic spacing is applied per syllable, not per character ([W3C ILREQ §6](https://www.w3.org/TR/ilreq/)), so CSS letter-spacing mis-places matras. `hyphens: manual` (ILREQ allows syllable breaks but browser support is uneven; we wrap at spaces only).
- Headings: UX4G scale, semibold: H1 28 px (Heading/L) on phone, 32 px on laptop; H2 24; H3 20; tile numbers 28 px with `font-variant-numeric: tabular-nums`.
- `<html lang>` switches `en` ↔ `hi` with the language setting (WCAG 3.1.1, UX4G checklist "Language of page declared in HTML"); Hindi lines embedded in English print pages get `lang="hi"` spans.
- Numerals: Latin digits in both languages (Constitution Art. 343(1): "international form of Indian numerals" for Union purposes — [MEA Part XVII](https://www.mea.gov.in/Images/pdf1/Part17.pdf)); `Intl.NumberFormat('hi-IN')` already defaults to Latin digits (verified: `₹12,34,567.89`). Money everywhere via `Intl.NumberFormat('en-IN', {currency:'INR'})` as the pack requires ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)); lakh sublabel via `notation:'compact'` (`11.8L` in en-IN, `11.8 लाख` in hi-IN — verified locally).
- Dates: `Intl.DateTimeFormat` with `timeZone:'Asia/Kolkata'`; EN `7 Oct 2026`; **HI uses `month:'long'`** (`7 अक्टूबर 2026`) because the medium style yields `7 अक्टू॰ 2026` (abbreviation sign ॰, odd for owners; verified Node 22). Relative: "16 days late" / "16 दिन देर"; `Intl.RelativeTimeFormat('hi')` gives "3 दिन पहले" for timeline times.

### 1.2 Colour (light only)
| Token | Hex | Use | On white | On tint (tint hex) | White on it |
|---|---|---|---|---|---|
| success | #00522c | paid · chain intact · match "Sure" | 9.36:1 | 8.03:1 (#e3f1e8) | 9.36:1 |
| error | #8a1a16 | overdue · chain broken · send failed · promise broken | 9.38:1 | 8.00:1 (#fbe9e7) | 9.38:1 |
| warning | #ad4e00 | due soon · part paid · buffer breach · TDS flag · promise at risk | 5.43:1 | 4.89:1 (#fff1e0) | 5.43:1 |
| info | #006d75 | not yet due · sent · paused (promise/dispute) · "Check" matches | 6.10:1 | 5.35:1 (#e0f4f5) | 6.10:1 |
| text | #1f2937 / muted #4b5563 | body / secondary | 14.7:1 / 7.6:1 | — | — |

Tokens from [UX4G color](https://ux4g.gov.in/foundations/color) (via library Part D). All ≥ 4.5:1 text and ≥ 3:1 UI ([WCAG 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html); UX4G: "4.5:1 for text, 3:1 for UI"). Do not use #6b7280 for text (4.83:1 passes but UX4G flags its own 3.2:1 grey; stay at #4b5563). Focus ring: 4 px, 2 px offset, ≥ 3:1 against neighbours (UX4G) → Tailwind `focus-visible:ring-4 ring-offset-2` on every interactive element via the shadcn base styles, once. `color-scheme: light` on `:root`.

### 1.3 Targets, layout, motion
- Every button, chip-filter, row action, nav item: **`min-height: 3rem` (48 px)**, horizontal padding ≥ 1rem, ≥ 0.5rem gap between neighbours. Pack rule; Android recommends "at least 48dp×48dp" ([Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps)); WCAG 2.2 minimum is 24 px ([2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)), so 48 clears AA with room. Icon-only buttons (ⓘ, copy, close) get the 48 px hit area via padding and an `sr-only` label (UX4G: visually hidden text on icon-only buttons).
- 360 px first: one column; 16 px gutters; tables become stacked cards below `sm` with one CSS utility (`.cardify` → each `<td>` shows its header via `data-label` in `::before`); no fixed px widths; `overflow-wrap: anywhere` only on hashes, GSTINs, UPI IDs, invoice numbers. Satisfies reflow at 320 px ([WCAG 1.4.10](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html): no two-dimensional scrolling; data tables are the allowed exception, we avoid even that on phones).
- Phone nav: bottom bar, 5 items, icon + word: Home (होम) · Today (आज, badge = follow-ups due) · Bills (बिल) · Money (पैसा: Payments, Forecast, Chase first as tabs) · More (और: Customers, Inbox, Documents, Settings). Laptop: shadcn `Sidebar`, three groups (Collect · Money · Setup), all 13 named.
- **One fixed help button** (pack of low-literacy UX: Medhi et al.): `?` bottom-right, `fixed; right:1rem; bottom:4.5rem` on phone (above the nav), `bottom:1rem` on laptop. Never moves, never hides. Opens `Sheet` (side bottom on phone, right on laptop) with: what this screen does (one i18n paragraph per route), "Words we use" (glossary auto-generated from every `label`/`hint` pair in `en.json`/`hi.json`), demo-clock explanation, owner contact.
- Demo clock band (DEMO_MODE only): slim strip under the header "Demo clock · Fri 23 Oct 2026 · +1 day · +7 days · ↺ reset · 1 day = 5 s" (plan Rev C #7 wording). It is the Settings "Demo date" control rendered globally; one component.
- `prefers-reduced-motion`: the demo-clock advance animation and chart transitions off ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).

### 1.4 Status = icon + word (lucide names; [lucide.dev](https://lucide.dev/icons/))
| State | Icon | EN word | HI word (chip) | Token |
|---|---|---|---|---|
| draft | FilePen | Draft | ड्राफ़्ट | neutral |
| sent | Send | Sent | भेजा गया | info |
| due soon (derived) | BellRing | Due soon | तारीख पास है | warning |
| not yet due | Clock | Not yet due | अभी समय है | info |
| overdue (derived) | AlertTriangle | Overdue · 16 days | देर हो चुकी · 16 दिन | error |
| part paid | CircleDot | Part paid | कुछ मिला | warning |
| paid | CheckCircle2 | Paid | पूरा मिला | success |
| disputed | MessageSquareWarning | Disputed | सवाल उठा | info |
| paused: promise | Handshake | Promise till 14 Nov | वादा, 14 नवंबर तक | info |
| paused: snooze | AlarmClockOff | Snoozed till… | …तक रोका | info |
| promise broken | HandshakeOff (or Handshake + X) | Promise missed | वादा टूटा | error |
| send failed | MailX | Failed · Retry | नहीं गया · फिर भेजें | error |
| chain intact | ShieldCheck | Record unaltered | रिकॉर्ड में कोई बदलाव नहीं | success |
| chain broken | ShieldAlert | Record altered | रिकॉर्ड बदला गया | error |
| no record | ShieldQuestion | No record found | रिकॉर्ड नहीं मिला | warning |
| match: Sure / Likely / Check | CheckCheck / Check / Search | Sure · Likely · Check | पक्का · शायद · जांचें | success / info / warning |

Chip words stay ≤ 12 graphemes in Hindi (all above comply); the longer explanation lives in the row's second line or the `Term` popover. `Badge` never wraps; rows do.

### 1.5 States pattern (every screen, one kit)
- Loading: `Skeleton` rows shaped like the final content (3 rows); buttons show `Spinner` + keep their label ("Sending…"). Never a blank page.
- Empty: shadcn `Empty` (icon, title, one body line, one 48 px CTA). Copy is an i18n triple per screen (`*.empty.title/body/cta`).
- Error: `Alert variant=destructive` with the API's `{error:{code,message}}` text and a Retry button; the code in small monospace for the README FAQ. Same `ErrorState` on all screens; route-level `error.jsx` so a crash in one screen never blanks the app (pack debug prompt "Blank white screen").
- Success/status messages: `Toast` (Sonner) with `role="status"` so "Marked as sent", "Match confirmed", "Letter drafted" are announced without moving focus ([WCAG 4.1.3](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)).
- Confirmations that change money or stop reminders use `AlertDialog` with the consequence in the title: "Mark ₹1,18,000 as paid? Reminders stop and the record is sealed."

### 1.6 Shared kit (build once; names are shadcn where they exist — [component list](https://ui.shadcn.com/docs/components))
| # | Component | Built from | Used by | Cost |
|---|---|---|---|---|
| 1 | `PageHeader` | Typography + `Button` | all | 10 min |
| 2 | `Money` | span, en-IN format, tabular-nums, optional lakh sublabel, negative = error colour + word "short" | all | 15 min |
| 3 | `StatusChip` | `Badge` + lucide + i18n word (§1.4) | 9 screens + print | 20 min |
| 4 | `Term` | label + ⓘ `Button` (48 px hit) → `Popover` (EN/HI term + one-line meaning) | all | 30 min |
| 5 | `StatTile` | `Card` + `Term` + `Money` | Dashboard, Customers, Forecast | 15 min |
| 6 | `InvoiceRow` | `Item`: customer · invoice no · `Money` · `StatusChip` · "16 days late" · optional reason line · optional `OneTapSend` | Invoices, Dashboard top-5, Chase first, Customers detail, Documents, Forecast gap-cover, Payments allocation | 40 min |
| 7 | `Timeline` | §3; prop `print` | Invoice detail, Documents, bundle print, ladder preview | 60 + 30 min polish |
| 8 | `EmptyState` / `ErrorState` / `LoadingRows` | `Empty`, `Alert`, `Skeleton`, `Spinner` | all | 20 min |
| 9 | `HelpButton` | fixed `Button` + `Sheet` + glossary from i18n | all | 30 min |
| 10 | `DemoClockBar` | strip + 3 `Button`s, calls `/api/demo/advance|reset` | shell, Settings | 20 min |
| 11 | `PrintFrame` | A4 `@page` CSS, header/footer, verify-QR stamp, no-print toolbar "Print / Save as PDF · Back" | 3 print pages | 30 min |
| 12 | `OneTapSend` | `Button Group`: WhatsApp (`https://wa.me/91XXXXXXXXXX?text=…` URL-encoded, digits only — [WhatsApp FAQ](https://faq.whatsapp.com/5913398998672934)) · Email (`mailto:` with subject/body, [RFC 6068](https://www.rfc-editor.org/rfc/rfc6068)) · SMS (`sms:` with `?body=`, [RFC 5724](https://www.rfc-editor.org/rfc/rfc5724)) · Mark as sent; 2×2 grid below `sm` | Follow-ups, invoice detail, dashboard top-5 | 30 min |
Kit total ≈ 5.5 h, spread over Fri night (1–4, 8, 9, 10) and Sat (5–7, 11, 12). Not optional: it is what makes the per-screen costs below real.

### 1.7 Forms (shared decisions)
- `Field` + `Input`/`Input Group` for every input (visible `Label`, never placeholder-only; error text under the field, `aria-describedby`). Rupee inputs: `Input Group` with "₹" prefix, numeric keyboard (`inputMode="decimal"`), converted to paise once on blur (pack money rule).
- Dates: **native `<input type="date">`**, not shadcn `Date Picker` — the OS picker is localised, touch-sized and free; saves ~30 min and a Hindi calendar.
- Pickers with ≤ 7 options (GST rate, unit, status): `Native Select` on phones (OS sheet), `Select` on laptop — shadcn ships both. Customer pick: `Combobox` (Popover + Command) with "Add new customer" as the last item.
- Toggles: `Switch` with the state word beside it ("Auto-send: On"), never a bare switch.

## 2. Dashboard — hierarchy for a two-second read

Order of attention, top to bottom at 360 px (laptop puts rows 1+2 side by side with 3, and 4+5 in a right column):

```
[Demo clock · Fri 23 Oct 2026 · +1d · +7d · ↺]            (DEMO_MODE only)
Arora Auto Components · Fri 23 Oct              [EN|हिं] [Aa]
┌ Money to collect ⓘ ─────┐ ┌ ⚠ Overdue ⓘ ─────────┐
│ ₹11,80,000              │ │ ₹4,20,000             │   ← row 1: hero tiles, 28 px numbers
│ ≈ 11.8 lakh · 23 bills  │ │ 6 bills · oldest 38 d │      (figures illustrative; seed decides)
└─────────────────────────┘ └───────────────────────┘
⚠ Cash dips below your ₹1,50,000 buffer in week 6 (7–13 Dec).
  Lowest point ₹−42,000 · See the bills that would cover it →   ← row 2: alert strip (warning)
Chase these first ⓘ                                  See all →
① Verma Forgings · INV/26-27/0042 · ₹1,18,000 · 38 days late
   usually pays 20 days late · covers the week-6 gap
   [WhatsApp] [Email] / [SMS] [Call]                           ← row 3: top 5 InvoiceRow + OneTapSend
… ×5
Who owes, by age ⓘ
▓▓▓▓▓▓▓▓░░░░▒▒▒▒▓▓▓▓███                                      ← row 4: single stacked bar (divs, no lib)
● Not yet due  ₹7,60,000 (17)   ● 1–30 days late ₹2,10,000 (3)
● 31–60 ₹1,18,000 (1)  ● 61–90 ₹92,000 (2)  ● 90+ ₹0 (0)
[Expected this week ⓘ ₹2,36,000] [Expected this month ⓘ ₹6,10,000]   ← row 5: 2×2 small tiles
[Bills to pay, 30 days ⓘ ₹3,85,000] [Cash in bank ⓘ ₹4,20,000]
```
All seven pack stats are present: to collect, overdue (row 1), lowest forecast point (row 2), expected week/month, bills 30 d, cash in bank (row 5). When there is no breach, row 2 becomes a success strip: "Cash stays above the ₹1,50,000 buffer for all 13 weeks." The ageing bar never relies on colour: each segment has `aria-label`, the legend carries icon + word + amount + count, and segments under 4% width still get a legend row.

Components: `StatTile` ×6, `Alert` (warning/success), `InvoiceRow` ×5 with `OneTapSend`, plain-div stacked bar + legend list, `Button variant=link` "See all". Data: one call `/api/dashboard`.
States: loading = 2 big + 4 small `Skeleton` tiles + 5 skeleton rows; empty (fresh DB) = `Empty` "No bills yet — add your first" CTA → `/invoices/new` (LLD copy); error = `ErrorState` keeps the header and nav.
Label/tooltip pairs (EN label → EN term | HI label → HI term): Money to collect → Receivables | वसूलना बाकी → प्राप्य राशि · Overdue → Past due | देर हो चुकी → अतिदेय · Expected this week → Projected collections | इस हफ़्ते आने की उम्मीद → अनुमानित वसूली · Bills to pay, 30 days → Payables | 30 दिन में देने हैं → देय राशि · Cash in bank → Opening balance | बैंक में पैसा → आरंभिक शेष · Lowest cash point → Forecast minimum | सबसे कम कैश → न्यूनतम अनुमानित शेष · Who owes, by age → Receivables ageing | किसका कितना, कितने दिन से → प्राप्य आयु विश्लेषण · Chase these first → Collection priority | पहले इनसे वसूलें → वसूली प्राथमिकता.
Hindi length: tile labels are 7–15 graphemes (shorter than EN) but need two lines at 1.8 line-height → tile `min-height: 7.5rem`, label allowed 2 lines, number never wraps (tabular, `white-space: nowrap`). Legend words "देर हो चुकी" fit; "अभी समय है" fits.
Signature detail: the lakh sublabel under each hero amount ("≈ 11.8 lakh" / "≈ 11.8 लाख") — owners think in lakhs; and tapping the alert strip opens Forecast scrolled to the breach week with its covering bills expanded.
Cost: 1.25 h (Sat 12–3 AM, with the invoice list). Within slot.

## 3. Escalation timeline with hash stamps (the signature)

Where: invoice detail (hero, above the action rail), Documents screen, `/print/bundle` (print variant), Settings ladder preview (future rungs only).

Anatomy (phone width; laptop adds a right action rail):
```
✓ Record unaltered · 14 records · checked 10:02        [Verify page ↗]
│
◉ Day +30 · Payment Demand Letter drafted          You · 7 Nov, 10:00
│  Interest shown separately ₹9,214 (2 RBI rate periods)
│  [Open letter] [Send by email]           # 3f9a…c21e ▸
│
◌ Day +45 · Next steps (MSME ODR portal)           due 22 Nov · in 15 days
│
┃ PAUSED · Customer promised to pay by 14 Nov · ₹1,18,000
┃ Reminders resume on their own if the date passes unpaid
│
● Final reminder emailed (day +15)                 System · 22 Oct, 10:00
│                                                   # 8b12…77ae ▸
● Reminder sent by WhatsApp (day +7)               You · 14 Oct, 11:42
│                                                   # c0de…1a2b ▸
● Reminder emailed (due date)                      System · 7 Oct, 10:00
● Heads-up emailed (3 days before)                 System · 4 Oct, 10:00
● Bill sent · pay only to arora@okaxis / A/c …4321  You · 7 Sep, 16:20
● Bill created                                     You · 7 Sep, 16:05
```
Rules:
- Newest at the top (owners ask "what happened last"); milestones (rungs) use a larger filled dot and the pack's rung names in plain words; events between rungs use small dots; **future rungs are hollow dots with their due date** — this is the pack's screen 6 "ladder" visual without a separate screen. Offsets read from config, so editing the ladder in Settings changes these rows.
- The 2 px connector is drawn continuous; a paused span is a thicker hatched band (`info` tint) with the reason and the self-resume sentence. A dispute pause reads "PAUSED · Customer says: 'wrong quantity' → answer in Inbox".
- **Hash stamp**: monospace `# 3f9a…c21e` (first 4 + last 4 hex), `Button variant=ghost`, 48 px hit. Tap → `Sheet` (bottom on phone): full 64-hex hash in two 32-char monospace lines with a Copy button, "links to # …1a2b (the entry above)", event type and time, a QR of `/verify/<hash>` (so a judge watching the laptop can scan with a phone), and a 48 px "Open verify page" button. Only seeded/real hashes; no PII.
- The top strip calls `/api/verify/<newest hash>` once (API already exists): green "Record unaltered · n records" (ShieldCheck), amber "Couldn't check right now" on error (never red for a network error), red "Record altered — chain breaks at record 9" only when the API says so (that is the tamper acceptance test A15, on screen).
- Each row: icon + plain-word event (from `event_type` → i18n: `message_sent` + channel → "Reminder sent by WhatsApp"), actor chip (System · You · Customer), time (`Intl` with IST), optional one-line detail from the payload (interest figure, outbox id, promise date, credit note number).
- Print variant: same rows as a table (Time · Event · Actor · Record hash first 12 hex), monospace hashes, no icons' colour dependence, the chain-head hash and QR on the bundle's last page.
Components: `Item` list, `Badge`, `Button`, `Sheet`, qrcode SVG. Data: `/api/invoices/:id` events + one verify call.
States: loading = 5 skeleton rows; empty (draft) = "Nothing has happened yet — send this bill to start the record"; error = strip amber + rows from cache if any.
Hindi: event sentences are 10–16 graphemes ("रिमाइंडर WhatsApp से भेजा"), two lines allowed; the stamp stays Latin monospace; "रुका है — वादा, 14 नवंबर तक" (20 graphemes) fits one line at 328 px.
Signature detail: the connector line is the chain. In the stamp sheet the line "links to # …1a2b (the entry above)" makes the hash chain legible to a non-technical judge in one glance; the top strip turns the trust layer into a status word, not a footnote (OkCredit's finding that trust is the barrier — library B4).
Cost: 1 h v1 (Sat 2–7 PM) + 30 min polish (Sun 9–12, already allotted as "hero-screen polish" in plan Rev B #11). Within slots.

## 4. Screen by screen

Template: Purpose · First glance (2 s) · Components · States · Pairs (only screen-specific; master list in §5) · Hindi length · Signature · Cost / slot.

### 4.1 Dashboard — see §2.

### 4.2 Invoices (list + detail)
Purpose: find any bill by customer/status/date; open its record.
First glance: filter chips with counts across the top ("Overdue 6 · Due soon 3 · Part paid 4 · Disputed 1 · Paid 8 · Sent 9 · Draft 1"), then rows: customer, invoice no, amount, status chip, "16 days late".
Components: `Input` search (customer or number, separator-tolerant like recon), chip filters = `Toggle Group` of `StatusChip`s (all seven pack statuses, derived ones included), `Native Select` "Sort: oldest due · biggest · newest", `InvoiceRow` list (`Table` with `.cardify` on phone), `Pagination` only above 50 rows (seed has 40: skip). Detail: `PageHeader` with `StatusChip`, three `StatTile`s (Amount · Received · Still owed), **`Timeline`**, action rail (`Button`s: Open print view · Send reminder now (`OneTapSend`) · Record payment · Promise to pay · Mark disputed · Draft demand letter when rung ≥ +30 · Evidence pack when rung ≥ +45).
States: loading skeleton rows; empty per filter "No bills match — clear filters"; detail 404 "This bill doesn't exist or was deleted".
Pairs: Still owed → Outstanding balance | अभी बाकी → बकाया शेष · Received → Payments received | मिला → प्राप्त भुगतान · Days late → Days past due | कितने दिन देर → अतिदेय दिन.
Hindi: chip words ≤ 12 graphemes (§1.4); the row's second line wraps freely.
Signature: the filter chips are the statuses themselves with live counts — the list is the status legend.
Cost: list 1 h (Sat 12–3 AM); detail shell + rail 0.5 h (Sat 12–3 AM), timeline in §3.

### 4.3 New invoice
Purpose: a correct Tax Invoice in under two minutes, GST explained as it happens.
First glance: three stacked sections with numbers: ① Customer, ② Items, ③ Totals; the running total is pinned at the bottom (`position: sticky`) with "Total ₹11,800 · incl. CGST ₹900 + SGST ₹900".
Components: `Combobox` customer (+ "Add new customer" → `Sheet` with name, GSTIN (`Input Group` with validate-on-blur, state and name auto-filled from the first two digits, check-digit error text), address, email, phone, credit days, language); items repeater: each item is a `Card` with `Field`s (description, HSN/SAC with 4/6-digit rule hint, qty + unit `Native Select` from the UQC list, rate ₹, discount ₹, GST rate `Native Select` from config), "Add item" 48 px; totals `Table` (taxable, CGST/SGST or IGST, round off, grand total, amount in words); `Switch` reverse charge, `Collapsible` "Ship to a different address"; due date = acceptance + min(credit days, 45) shown as a sentence with a native date override; `Alert` info "e-invoice (IRN) applies above ₹5 crore — not generated here" when config says so; `Tabs` Edit | Preview (preview = `/print/invoice` in an iframe); actions `Save draft` (secondary) · `Send` (primary, `AlertDialog`: "Allocates the next number INV/26-27/0043 and mints the pay link").
States: GSTIN invalid → field error "Check digit doesn't match — 15 characters, e.g. 03ABCDE1234F1Z5" (made-up example); unsaved-changes `AlertDialog` on leave; send error keeps the form.
Pairs: Before GST → Taxable value | GST से पहले की रकम → कर योग्य मूल्य · Round off → Rounding to the rupee | राउंड ऑफ → पूर्णांकन · Place of supply → (CBIC term) | आपूर्ति का स्थान · Reverse charge → Buyer pays the GST | रिवर्स चार्ज · Credit days → Credit period | उधार के दिन → उधार अवधि · Item code → HSN/SAC | वस्तु कोड → HSN/SAC.
Hindi: "GST से पहले की रकम" is 150% of the English — the totals table on phone becomes a two-column definition list (`dl`), labels may wrap; the sticky total bar shows only the number and the split words.
Signature: the GST explanation line under the totals: "Same state (Punjab → Punjab): CGST ₹900 + SGST ₹900" flips live to "Different state (Punjab → Haryana): IGST ₹1,800" when the customer changes — the pack's side-by-side demo moment inside the form.
Cost: 2 h form + 0.5 h preview tab (Sat 9–2); e-invoice JSON/QR 1 h is Rev B #11's +1 h. Slot total 5 h = 5 h available. **Zero slack** — decide by Sat 9 AM whether Invoify's template is lifted or hand-written as one table.

### 4.4 Customers
Purpose: who is reliable, who owes, how to reach them.
First glance: rows "Verma Forgings · ₹2,36,000 owed · Grade C · usually pays 20 days late".
Components: `InvoiceRow`-style `Item` list grouped by customer (name, total owed `Money`, grade `Badge` A/B/C with icon + word "Reliable / Usually late / Chase early", one-line reason sentence from `reliability()`); tap → `Sheet` detail: contacts (tap-to-call/mail), credit days, % on time, avg days late, preferred language, `Switch` "Do not message (owner calls instead)", `Button variant=destructive` Anonymise (AlertDialog explains the GST-ledger carve-out), and the customer's bills = the same `InvoiceRow` list filtered.
States: empty "No customers yet — add one from a new bill"; anonymised customer renders as "Customer #A4F2" with a lock icon.
Pairs: Reliability → Payment behaviour grade | भरोसा → भुगतान व्यवहार ग्रेड · Usually pays late by → Average days past due | औसतन इतने दिन देर → औसत विलंब दिन · Paid on time → On-time ratio | समय पर दिया → समय पर भुगतान अनुपात.
Hindi: grade words ≤ 10 graphemes ("भरोसेमंद", "अक्सर देर", "जल्दी पकड़ें"); reason sentence wraps.
Signature: the grade is always accompanied by its reason sentence — never a bare letter.
Cost: 0.5 h → 0.25 h with the Sheet-reuse (Sat 2–7 PM). Separate customer *page* **EXCEEDS**; use the Sheet.

### 4.5 Today's follow-ups
Purpose: do today's chasing in five minutes from a phone.
First glance: header "3 reminders due today · 1 failed email"; cards: customer, bill numbers, amount, "7 days late", the message preview, four buttons.
Components: `Tabs` Due today | Awaiting you | Failed; `Card` per outbox row: `StatusChip` rung ("Firmer reminder · day +7"), `Money`, message body in a quiet `ScrollArea` (EN/HI by customer language), `OneTapSend` (2×2 on phone), secondary row `Button`s Snooze (→ `Popover` with 1 / 3 / 7 days) · Promise to pay (→ `Sheet`: native date ≤ +14 days, amount prefilled, sentence "This pauses reminders and moves ₹1,18,000 into week 3 of the forecast"); Failed tab rows show the Resend error text + Retry; email rows show "Send" (server) instead of mailto.
States: empty "All caught up — next reminder due Mon 27 Oct" (LLD copy); failed-send `Alert`; after Mark as sent the card collapses with a `Toast` "Logged · WhatsApp · 11:42".
Pairs: Reminder → Payment follow-up | याद दिलाना → भुगतान अनुवर्ती · Mark as sent → Log the send | भेज दिया, दर्ज करें · Snooze → Postpone | बाद में याद दिलाएँ → स्थगित · Promise to pay → Promise-to-pay (PTP) | पैसे देने का वादा → भुगतान वचन · Awaiting you → Owner approval required | आपकी मंज़ूरी बाकी.
Hindi: "बाद में याद दिलाएँ" is 183% of "Snooze" → the 2×2 grid; `min-height` buttons wrap to two lines; message bodies in Hindi run ~1.4× taller — the preview area is capped at 6 lines with "Show all".
Signature: the promise sheet states its forecast effect before you confirm (lever 2 made visible).
Cost: 1.25 h (Sat 2–7 PM).

### 4.6 Escalation ladder (Settings section + timeline rail)
Purpose: the owner sees and edits the six steps; the same visual appears inside every bill's timeline (§3 future rungs).
First glance: a vertical rail of six rows: "3 days before · Friendly heads-up · Auto-email ON", "Due date · Reminder · Auto-email ON", "7 days late · Firmer reminder · one tap", "15 days late · Final reminder + call prompt · one tap", "30 days late · Payment Demand Letter · you send", "45 days late · Next steps (call · lawyer · MSME ODR portal, formerly Samadhaan)".
Components: `Item` rows with numeric `Input` (days, `inputMode=numeric`, 48 px), `Switch` auto-send on the first two only (others show a lock icon + "always by you" — the pack's safety rule), `Alert` preview "For a bill due 7 Nov: heads-up 4 Nov · reminder 7 Nov · firmer 14 Nov · final 22 Nov · letter 7 Dec · next steps 22 Dec", Save.
States: validation "Steps must stay in order"; saved `Toast`.
Pairs: Heads-up → Pre-due reminder | पहले से याद → पूर्व-देय अनुस्मारक · Firmer reminder → Second notice | थोड़ा सख़्त याद · Next steps → Escalation guidance | आगे के कदम.
Hindi: rung names ≤ 14 graphemes; rows wrap to two lines.
Signature: the live sentence preview; and the lock icon + "always by you" on letter/ODR rows — the pack's "never sends anything legal itself", visible.
Cost: 0.3 h inside Settings (Sun 9–12).

### 4.7 Customer link `/pay/:token` (no login)
Purpose: the customer pays, says they paid, or says what is wrong — in their language, without fear.
First glance: "Arora Auto Components · Bill INV/26-27/0042 · ₹1,18,000 still owed · due 7 Oct 2026 (16 days ago)". Language toggle top-right defaults to the customer's preferred language.
Components: `Card` amount (`Money` 28 px) + due sentence; `Button` primary 48 px "Pay by UPI" (`href=upi://pay?pa&pn&am&tn&cu=INR`, URL-encoded pn/tn; below `md` the button leads, at `md`+ the QR leads with "scan from your phone" since `upi://` does nothing on a laptop); QR 200 px with the amount captioned; `Accordion` three panels: "I've already paid" (`Field`s reference, native date, amount prefilled → `Toast`/inline success "Thanks — Arora Auto will confirm within a day. Reminders are paused."), "Something's wrong with this bill" (`Radio Group`: wrong amount · wrong quantity · goods returned · already paid · other + `Textarea` → "Reminders paused until Arora Auto replies"), "I'll pay on a date" (native date ≤ 14 days → promise); `Card` **"Is this message genuine?"**: "Pay only to UPI arora@okaxis · A/c ending 4321 · Verify this bill ↗ (`/verify/<invoice hash>`) · We never ask for OTP/PIN or change bank details." (config footer, ≤ 60 chars for template reuse — library Part D); bill lines in a `Collapsible`; DPDP notice footer in the customer's language: "Arora Auto Components holds your name, phone, email and this bill's history to communicate dues. To correct or delete, contact <dispute contact>." (first open logs `notice_shown`).
States: 404 "We can't find this bill link — check the message you received"; 410 "This link has expired — contact Arora Auto Components at <dispute contact>" (LLD copy); draft refused = 404 copy; paid = "This bill is settled — thank you" with the receipt-style summary; after a claim/dispute the action panels lock and show the submitted summary.
Pairs (customer-facing, no jargon at all): Still owed → — | अभी बाकी · Pay by UPI | UPI से भुगतान करें · I've already paid | मैंने पैसे दे दिए हैं · Something's wrong with this bill | इस बिल में कुछ गलत है · Verify this bill → Tamper check | यह बिल जांचें → सत्यापन.
Hindi: all three action titles are 12–16 graphemes, fine at full width; "UPI से भुगतान करें" (130%) still fits a full-width button on one line.
Signature: the "Is this message genuine?" card with "Pay only to" — the buyer-protection lever (Rev E) in the customer's first screen; the whole page has zero third-party scripts.
Cost: 1 h (Sat 2–7 PM).

### 4.8 Inbox
Purpose: settle disputes and "already paid" claims; each decision resumes or stops the ladder.
First glance: cards with the customer's words quoted: "Verma Forgings says: 'already paid' · ref UTR 5283… · 14 Oct · ₹1,18,000" and three buttons.
Components: `Tabs` Disputes | Claims; `Card` with quote (`blockquote`), bill summary (`InvoiceRow`), `Button Group`: Accept (→ `Sheet`: "Mark paid" or "Issue credit note" with amount + reason → credit note number shown), Reject with reply (`Textarea`, sent to the customer's contact by the owner's own app via `OneTapSend`), Edit bill (link to the invoice edit — no inline editor).
States: empty "Nothing to resolve — customers' replies land here"; resolved cards move to a `Collapsible` "Resolved (3)".
Pairs: Credit note → (GST term kept) | क्रेडिट नोट · Claim → "Already paid" report | दावा · Resolve → Close the dispute | निपटाएँ.
Hindi: button words ≤ 10 graphemes ("मान लें", "जवाब दें", "बिल बदलें").
Signature: accepting shows "Credit note CN/26-27/0003 issued · interest clock stopped from 14 Oct" immediately in the card and in the timeline.
Cost: 0.75 h (Sat 2–7 PM). Inline invoice editor **EXCEEDS** — link to edit.

### 4.9 Payments
Purpose: import the bank CSV, see what matched and why, confirm; nothing is paid until you say so.
First glance: dropzone "Import bank statement (CSV, HDFC-like)" + "Add a payment by hand"; after import a summary strip "9 credits read · 1 line skipped (opening balance) · 6 need your confirmation" and a table.
Components: `Card` dropzone (`Input type=file`, papaparse client-side) + `Button` manual (`Sheet` with date, amount, reference, customer `Combobox`); results `Table` → `.cardify` on phone: date · narration (truncated, expand) · amount · classification `StatusChip` (Exact match · Part payment · Covers 2 bills · Possibly TDS deducted · Overpayment · Unknown deposit) · confidence as a word ("Sure / Likely / Check", §1.4) · reason sentence ("Invoice number INV/26-27/0007 found in narration; amount equals outstanding") · allocation editor (`Input Group` ₹ per matched bill, prefilled) · 48 px Confirm; `Alert` warning on TDS rows: "Short by exactly 2% of the taxable value — possibly TDS (IT Act 2025 s.393(1) Sl. 6(i), was 194C). Ask the customer for the TDS certificate." ; skipped lines `Collapsible` with reasons; re-import notice "Already imported 9 of 9 — nothing changed".
States: parsing `Spinner` on the dropzone; empty "No payments yet — import your bank statement or add one"; malformed file `ErrorState` with the line number.
Pairs: Matched → Reconciled | मिलान हुआ → मिलान (समाधान) · Possibly TDS deducted → Tax deducted at source | शायद TDS कटा है → स्रोत पर कर कटौती · Unknown deposit → Unapplied receipt | पता नहीं किसका → अनाबंटित प्राप्ति · Covers 2 bills → Multi-invoice receipt | 2 बिलों के लिए · Confirm → Post the payment | पक्का करें.
Hindi: classification chips ≤ 12 graphemes; reason sentences wrap (2–3 lines at 1.8).
Signature: a lock icon + "Not marked paid until you confirm" on every unconfirmed row; confidence as words, not a bare percentage.
Cost: 1.25 h (Sat 2–7 PM). Drag-to-allocate **EXCEEDS**; typed amounts only.

### 4.10 Cash forecast
Purpose: see the dip before it hits; see which bills would cover it; try three what-ifs.
First glance: a 13-bar chart with a buffer line; the breach week highlighted; beneath it a card "Week 6 (7–13 Dec): closing ₹−42,000, ₹1,92,000 short of the buffer. Collecting these would cover it:" + rows.
Components: shadcn `Chart` (recharts wrapper — plan already embeds recharts): weekly bars of closing cash, `ReferenceLine` at the buffer with label "Safety buffer ₹1,50,000", breach bar in error colour **and** a ⚠ word badge under the axis (no colour-only); `Switch` row of three what-ifs with their words ("Verma pays 30 days later", "Big order ₹3,00,000 in week 4", "Supplier payment delayed 2 weeks"); `Table`/`.cardify` week list (opening · in · out · closing) in a `Collapsible` "Week by week"; gap-cover `InvoiceRow` list with `OneTapSend`; promise-shifted inflows show a Handshake icon + "promised 14 Nov".
States: loading = chart skeleton; no expenses = `Alert` "Add salaries, rent and supplier bills in Settings to make this real"; error state keeps the switches.
Pairs: Cash forecast → 13-week cash-flow forecast | आगे का कैश अनुमान → नकदी प्रवाह पूर्वानुमान · Safety buffer → Minimum cash reserve | सुरक्षित न्यूनतम कैश → न्यूनतम नकद आरक्षित · Money coming in → Expected collections | आने वाला पैसा → अपेक्षित वसूली · Money going out → Payables and expenses | जाने वाला पैसा → देय और खर्च · Closing cash → Closing balance | हफ़्ते के अंत में कैश → अंतिम शेष.
Hindi: x-axis uses week numbers and `7 दिस` short dates? No — use "ह 6" plus full date in the tooltip; axis labels stay numeric to avoid Devanagari overlap at 360 px; chart tooltip content via `ChartTooltipContent` in the UI language.
Signature: the breach card lists the covering bills with one-tap remind buttons — forecast and chasing on one screen (pack G2 #1, demo beat).
Cost: 1.25 h (Sat 7–11 PM).

### 4.11 Chase these first
Purpose: the ranked list behind the dashboard's top 5.
First glance: numbered cards "① Verma Forgings · ₹1,18,000 · 38 days late · usually 20 days late · covers week 6".
Components: the dashboard's `InvoiceRow` list unfiltered with rank `Badge`, reason sentence, `OneTapSend`; `Native Select` "Sort: score · amount · days late". Nothing else.
States: empty "Nothing overdue — well done" ; same loading/error kit.
Pairs: Score → Collection priority score | प्राथमिकता अंक · Covers the gap → Closes the forecast shortfall | कमी पूरी करता है.
Hindi: reason sentence 2–3 lines; rank badge numeric.
Signature: the reason sentence is the UI; the score number sits in a `Term` popover ("how this is worked out: amount × days late × reliability × gap impact").
Cost: 0.25 h (Sun 9–12). A bespoke page **EXCEEDS**; it is this filtered view.

### 4.12 Documents
Purpose: everything for one bill in one place; print the evidence pack.
First glance: bill picker (search) → the `Timeline` + a "Documents" strip: Tax Invoice · Demand Letter (7 Nov) · Evidence pack, each a 48 px button opening its print page.
Components: `Combobox` bill search, `Timeline`, `Button Group` print links, ODR readiness `Card`: the §12.1.4 (a)–(h) checklist as `Checkbox` rows auto-ticked from data (a. seller + Udyam ✓, b. buyer ✓, c. undertaking ☐ signed on paper, d. facts/invoices ✓, e. payments ✓, f. amount + interest ✓, g. signature ☐, h. ID proof ☐) and the four eligibility gates as icon + word lines.
States: no documents yet "Send the bill to start its record"; print page unavailable (draft) disabled with reason.
Pairs: Evidence pack → Document bundle for the MSME ODR portal | सबूतों का पैकेट → दस्तावेज़ बंडल · Undertaking → Declaration that facts are true | वचनपत्र.
Hindi: checklist lines wrap; keep (a)–(h) letters Latin.
Signature: the readiness checklist with ticks before you print — the owner knows what to add by hand (signature, ID proof) before filing.
Cost: 0.25 h (Sun 9–12) because it is `Timeline` + buttons + a checklist card.

### 4.13 Settings
Purpose: business profile, ladder, buffer, language, text size, demo date, reset, privacy.
First glance: `Accordion` of six sections with one-line summaries ("Business profile · Arora Auto Components · GST regular · Udyam small", "Reminder steps · 6 steps · auto-send 2", "Safety buffer · ₹1,50,000", "Language & text size · English · Normal", "Demo date · Fri 23 Oct 2026", "Privacy · 14 customers · 1 opted out").
Components: `Field` forms (name, address, state `Native Select` from STATE_CODES, GSTIN with validation, registration `Radio Group` regular/composition/unregistered with the document-type consequence as help text, turnover ₹ with live note "above ₹5 crore: e-invoice applies, HSN 6 digits", Udyam `Switch` + number, bank fields, UPI ID, logo URL with initials fallback `Avatar`); ladder §4.6; buffer ₹; language `Toggle Group` "English | हिंदी" (each in its own script); text size `Toggle Group` Aa / Aa / Aa (16/18/20); Demo date: native date + `DemoClockBar`'s buttons + consequence preview "+7 days → 2 reminders become due, 1 letter drafts"; Reset demo (`AlertDialog`, destructive); Privacy `Card` (Rev E): data map (3 lines), retention "GST records kept 72 months from 31 Dec after the FY — FY 2026-27 until 31 Dec 2033", DPDP dates line with "designed to DPDP principles — duties not yet in force", opt-outs count, anonymise link to Customers, notice log count.
States: saved `Toast`; validation inline; reset progress `Spinner` with "Restoring sample data…".
Pairs: Registration type → GST registration status | पंजीकरण प्रकार · Udyam registered → MSME registration | उद्यम पंजीकृत · Safety buffer (as above) · Demo date → Simulated today | डेमो तारीख.
Hindi: section summaries ≤ 2 lines; "हिंदी" shown in Devanagari even in the English UI (pack add-on rule).
Signature: the demo-date consequence preview — the judge sees cause before effect.
Cost: 1 h + privacy card 0.5 h (Sun 9–12). Privacy card beyond text + three live numbers **EXCEEDS** — keep it static.

### 4.14 `/verify/:hash` (public)
Purpose: anyone with the letter or invoice checks the record and whom to pay.
First glance: one big result block: ✓ "Record unaltered" (success) / ⚠ "No record found" / ✗ "Record altered or chain broken" + "Checked just now".
Components: `Card` result with icon + word (§1.4); `dl` details: what (plain event name), bill number, recorded at (IST), record hash (two monospace lines, Copy button); **"Pay only to" `Card`**: UPI ID · bank account ending 4321 · "If the invoice you received shows different details, do not pay — call Arora Auto Components" (LLD copy); `Collapsible` "How this works" (hash chain, not blockchain; shows no personal data); language toggle.
States: loading skeleton; API down → amber "Couldn't check right now — try again" (never red); invalid hash format → amber "That's not a FullPay record code".
Pairs: Record → Audit entry | रिकॉर्ड → ऑडिट प्रविष्टि · Unaltered → Hash chain verified | बदला नहीं गया → सत्यापित.
Hindi: result words ≤ 16 graphemes ("रिकॉर्ड में कोई बदलाव नहीं"), one line at 328 px; the hash never wraps mid-pair (two fixed 32-char lines).
Signature: "Pay only to" as recorded at issue — the buyer's protection, one glance.
Cost: 0.5 h page (Sat 7–11 PM; API by Dev A).

### 4.15 `/print/invoice`
Purpose: Rule 46-complete Tax Invoice / Bill of Supply / plain invoice that saves as PDF from the browser.
Layout (A4 portrait, `@page { size: A4; margin: 12mm }` — [MDN @page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page)): header: business name 16 pt + address + GSTIN + Udyam no. left, logo/initials right; title centred 14 pt "TAX INVOICE" with optional Hindi under it ("कर बीजक", CBIC flier term — [CBIC Hindi e-flier](https://cbic-gst.gov.in/hindi/pdf/e-version-gst-fliers/tax-invoice-efliers-hindi.pdf)) when Settings enables the second-language headings; meta grid (Invoice no, Date, Due date, Place of supply name + code, Reverse charge Yes/No); Bill to | Ship to (two columns, print is fixed width); items table 9.5 pt (# · Description · HSN/SAC · Qty · Unit · Rate · Disc · Taxable · CGST % amt · SGST % amt | or IGST · Total) with `thead { display: table-header-group }` and `tr { break-inside: avoid }`; the Discount column is dropped when every line is zero (keeps the table legible); totals block right (Taxable · CGST · SGST / IGST · Round off · Grand total · "Rupees One Lakh Eighteen Thousand Only"); footer: bank details + **UPI QR ≥ 30 mm** captioned "Scan to pay ₹1,18,000" + **verify QR 20 mm** captioned "Scan to check this bill is genuine" + signature block "For Arora Auto Components / Authorised signatory"; e-invoice banner when turnover > ₹5 cr. QR: print as large as the area allows ([Denso Wave](https://www.qrcode.com/en/howto/cell.html)); SVG from `qrcode` so it stays crisp.
On-screen (no-print toolbar): "Print / Save as PDF" 48 px, "Back", language note "Invoice prints in English; Hindi headings: on/off".
States: draft → watermark "DRAFT — not numbered"; paid → "PAID" stamp word; 404 for unknown id.
Hindi: headings only (pack add-on rule); body stays English; `lang="hi"` on those spans.
Signature: two QRs with plain captions — pay and verify side by side.
Cost: 1.5 h incl. `PrintFrame` (Sat 9–2 PM).

### 4.16 `/print/letter`
Purpose: the pack's letter, firm and polite, with the per-period interest table and a verifiable stamp.
Layout: `PrintFrame`; title 16 pt **"Payment Demand Letter"**; directly beneath, a bordered box with the mandated line ("This letter is from Arora Auto Components about money owed for the invoices listed below. It is not a notice from the GST department and not a legal notice from a lawyer."); date, reference "Record # 3f9a…c21e", addressee block; two short paragraphs (what is owed, by when); schedule `Table` (Invoice no · Invoice date · Acceptance date · Amount · Received · Balance) with totals; **"Please pay by 14 Nov 2026"** bold; How to pay: bank details + UPI QR 30 mm; "If you believe this is wrong, contact <name, phone, email> before the date"; Udyam-gated MSMED paragraph: Udyam number, one factual sentence on §15/§16, interest table (From · To · Days · RBI Bank Rate · Rate (3×) · Principal · Interest) with the 7 Oct 2026 rate change visible as two rows, total interest; sentence switches on `letter_include_interest`: "The amount requested above includes this interest" / "This interest is shown for information and is not added to the amount requested"; "Please confirm receipt of this letter."; signature; footer: conventions footnote 8.5 pt (actual/365, monthly rests from the due date, rate switches on the RBI date, 0% within accepted disputes, part payments interest-first — Gurpreet Singh; V.K. Patel) + verify QR 20 mm + "Verify this letter: <URL>" + page numbers via `@page` margin boxes (`counter(page)` / `counter(pages)`, Chrome 131+ — [Chrome blog](https://developer.chrome.com/blog/print-margins)).
On-screen: toolbar + `Checkbox` "Add the interest to the amount requested" (persists `letter_include_interest`) + "Send by email" (server) — never auto.
States: not yet at rung +30 → the page explains "Letter becomes available 30 days after the due date (7 Nov)"; Udyam off → MSMED block absent, note on screen only.
Hindi: letter stays English by default; optional Hindi heading "भुगतान मांग पत्र" (RBI glossary "demand letter" मांग पत्र — [RBI glossary](https://uco.bank.in/documents/d/guest/rbi-english-hindi-glossary-2023)).
Signature: the interest table with RBI dates in it — free calculators cannot show this.
Cost: 1 h (Sat 7–11 PM).

### 4.17 `/print/bundle` (evidence pack / ODR bundle)
Layout: cover (title "Evidence pack — delayed payment", parties, Udyam no., bills, prepared on, "For filing on the MSME ODR portal (formerly MSME Samadhaan). This pack is not a legal notice."); contents; **§12.1.4 (a)–(h) checklist** with ✓/☐ and "see section n"; eligibility gates (icon + word: Udyam before supply · micro/small · not a trader NIC 45–47 · within limitation); parties; invoice schedule; days-overdue computation; interest table; `Timeline` print variant with hash stamps; payments and allocations; customer replies verbatim; each letter verbatim (new page each, `break-before: page`); reminder bodies with channel + time; final page: chain head hash, QR, "Verify at <URL>". Page numbers as above.
States: rung < +45 → "Available 45 days after the due date"; missing paper items (signature, ID proof) printed as ☐ with "add by hand".
Hindi: English by default; Hindi heading option as the letter.
Signature: a–h checklist with page references — a clerk could file from it.
Cost: 1 h (Sat 7–11 PM) by reusing the letter's schedule/interest sections and `Timeline print`. A bespoke designed bundle **EXCEEDS**; the cut list's "pre-rendered sample" fallback stands.

### 4.18 `/login`
One `Field` password, 48 px button, error "Wrong password — 5 tries a minute", language toggle. 10 min (Dev A).

## 5. Master label + tooltip pairs (i18n keys ship as `label`/`hint`; screens use everyday Hindi, print uses RBI/CBIC terms — library B4 rule)

| key | EN label → EN term (hint) | HI label → HI term (hint) | graphemes EN/HI |
|---|---|---|---|
| to_collect | Money to collect → Receivables | वसूलना बाकी → प्राप्य राशि | 16/7 |
| overdue | Overdue → Past due | देर हो चुकी → अतिदेय | 7/7 |
| expected_week | Expected this week → Projected collections | इस हफ़्ते आने की उम्मीद → अनुमानित वसूली | 18/14 |
| bills_30 | Bills to pay, 30 days → Payables | 30 दिन में देने हैं → देय राशि | 23/12 |
| cash_bank | Cash in bank → Opening balance | बैंक में पैसा → आरंभिक शेष | 12/7 |
| low_point | Lowest cash point → Forecast minimum | सबसे कम कैश → न्यूनतम अनुमानित शेष | 17/9 |
| chase_first | Chase these first → Collection priority | पहले इनसे वसूलें → वसूली प्राथमिकता | 17/11 |
| not_due | Not yet due → Current | अभी समय है → चालू | 11/8 |
| due_soon | Due soon → Due within 3 days | तारीख पास है → शीघ्र देय | 8/8 |
| part_paid | Part paid → Partial payment | कुछ मिला → आंशिक भुगतान | 9/5 |
| paid | Paid → Settled | पूरा मिला → चुकता | 4/5 |
| disputed | Disputed → Under dispute | सवाल उठा → विवादित | 8/6 |
| days_late | Days late → Days past due | कितने दिन देर → अतिदेय दिन | 9/9 |
| credit_days | Credit days → Credit period | उधार के दिन → उधार अवधि | 11/8 |
| promise | Promise to pay → Promise-to-pay (PTP) | पैसे देने का वादा → भुगतान वचन | 14/10 |
| mark_sent | Mark as sent → Log the send | भेज दिया, दर्ज करें | 12/12 |
| snooze | Snooze → Postpone | बाद में याद दिलाएँ → स्थगित | 6/11 (183%) |
| letter | Payment Demand Letter | भुगतान मांग पत्र → मांग पत्र | 21/10 |
| pay_by | Pay by → Payment deadline | इस तारीख तक दें → भुगतान की अंतिम तिथि | 6/11 (183%) |
| interest | Interest the law allows → Statutory interest, MSMED Act s.16 | कानून के हिसाब से ब्याज → वैधानिक ब्याज (धारा 16) | 23/14 |
| taxable | Before GST → Taxable value | GST से पहले की रकम → कर योग्य मूल्य | 10/15 (150%) |
| round_off | Round off → Rounding to the rupee | राउंड ऑफ → पूर्णांकन | 9/6 |
| reliability | Reliability → Payment behaviour grade | भरोसा → भुगतान व्यवहार ग्रेड | 11/3 |
| avg_late | Usually pays late by → Average days past due | औसतन इतने दिन देर → औसत विलंब दिन | 20/14 |
| matched | Matched → Reconciled | मिलान हुआ → मिलान | 7/6 |
| tds | Possibly TDS deducted → Tax deducted at source (s.393(1)) | शायद TDS कटा है → स्रोत पर कर कटौती | 21/12 |
| confirm | Confirm → Post the payment | पक्का करें | 7/5 |
| buffer | Safety buffer → Minimum cash reserve | सुरक्षित न्यूनतम कैश → न्यूनतम नकद आरक्षित | 13/12 |
| evidence | Evidence pack → Document bundle (MSME ODR) | सबूतों का पैकेट → दस्तावेज़ बंडल | 13/9 |
| verify | Verify → Tamper check (hash chain) | जांचें → सत्यापन | 6/2 |
| invoice | Bill → Tax invoice | बिल → कर बीजक | 4/2 |
| due_date | Due date → — | भुगतान की तारीख → नियत तारीख | 8/13 |
| place_supply | Place of supply (print, CBIC) | आपूर्ति का स्थान | 15/8 |
| bill_of_supply | Bill of Supply (print) | आपूर्ति का बिल | 14/8 |
Measured with `Intl.Segmenter('hi', {granularity:'grapheme'})` on Node 22.22.1; rendered Devanagari clusters are roughly 1.3–1.6× wider than Latin letters, so "65% of the graphemes" is approximately equal width — the real Hindi cost is **height** (1.8 line-height) and the five outliers above. A `node:test` should assert every `en` key exists in `hi` and that chip keys stay ≤ 12 graphemes (15 min, Technical Execution).

## 6. Dev B hour budget vs plan §5 (one strong developer pairing with Claude)

| Slot (IST) | Available | Spec'd | Items | Verdict |
|---|---|---|---|---|
| Fri 9:30 PM–12 | 2.5 h | 2.5 h | shadcn + tokens + fonts 0.5 · shell nav + help button 0.75 · i18n `t()` + `Term` + `StatusChip` + `Money` 0.5 · seed v1 0.75 | fits only if Claude drafts the seed generator while B does the shell |
| Sat 12–3 AM | 3 h | 3 h | Dashboard 1.25 · Invoices list 1 · detail shell + rail 0.5 · states kit 0.25 | fits |
| Sat 9 AM–2 PM | 5 h | 5 h | New invoice 2 · preview tab 0.5 · `/print/invoice` + `PrintFrame` 1.5 · e-invoice JSON/QR 1 (Rev B) | fits, zero slack |
| Sat 2–7 PM | 5 h | 5.75 h → 5.0 h | `Timeline` v1 1 · Follow-ups + `OneTapSend` 1.25 · `/pay` 1 · Payments 1.25 · Inbox 0.75 · Customers 0.5→0.25 (Sheet) | **EXCEEDS by 45 min** before remedies: Customers as Sheet (−15), Inbox edit = link (−15), Payments typed allocations (−15) |
| Sat 7–11 PM | 4 h | 4.75 h → 4.0 h | Forecast 1.25 · letter 1 · bundle 1 · `/verify` page 0.5 · Hindi pass 1→0.5 | **EXCEEDS by 45 min** before remedies: Hindi pass on demo screens first (cut-list item 3), bundle reuses letter sections + `Timeline print` (−15) |
| Sun 9 AM–12 | 3 h | 3.5 h → 3.0 h | Settings 1 · privacy card 0.5→0.25 · Chase-first 0.25 · Documents 0.25 · states + 360/text-size pass 0.75 · timeline polish 0.5 · axe pass 0.25 | **EXCEEDS by 30 min** before remedy: privacy card static (−15), Claude generates Settings fields from a list (−15) |
| Total | 22.5 h | 24.5 h → 22.5 h | | fits after remedies; no slack — any new UI idea must displace one of these |

Things that **EXCEED** under any arrangement and are not in this spec: dark mode (~1 h + retokening); shadcn `Data Table` with sorting/column visibility (~1 h; plain `Table` + `.cardify`); a designed customer page; an inline invoice editor in Inbox; drag-to-allocate payments; a bespoke bundle design; per-customer language on every screen (roadmap per Rev B); animated chart transitions; a Devanagari-localised date picker (native input instead).

## 7. UX acceptance additions (append to the P7 suite; each ≤ 5 min to check on the deployed URL)
- U1 Every `Term` ⓘ opens on tap on an Android phone (not hover) and on Enter from the keyboard.
- U2 At `html { font-size: 20px }` and 360 px: no horizontal scroll on any of the 18 routes; hero tiles stack; buttons wrap, none clipped (`min-height`, not `height`).
- U3 Hindi: "बाद में याद दिलाएँ", "इस तारीख तक दें", "GST से पहले की रकम" render fully in their buttons/labels at 360 px.
- U4 Every status chip shows an icon and a word in both languages; grayscale screenshot of the dashboard still reads (UX4G grayscale test).
- U5 Focus ring visible (4 px) on every control by Tab on the dashboard, new invoice and follow-ups.
- U6 Help button present and at the same position on all 13 owner screens; its glossary lists ≥ 30 pairs in both languages.
- U7 Timeline: tapping a hash stamp opens the sheet; "Open verify page" lands on green; after the tamper test (A15) the strip turns red and names the record.
- U8 Print: invoice, letter, bundle each save as PDF from Chrome with ₹, Devanagari headings, both QRs scannable from the printed PDF at 100%; letter page 2 shows "2 / 2".
- U9 axe: 0 serious issues on dashboard, invoice detail, follow-ups, `/pay`, `/verify`; Lighthouse accessibility ≥ 90 (checklist P7.8).
- U10 `/pay` on a laptop shows the QR first; on a phone the "Pay by UPI" button opens a UPI app chooser (P0.13 device).

## 8. Sources
Pack and plan: `problemstatement/chase` (design rules, screens, BEFORE-YOU-FINISH), `10_build_plan.md` (§5 hours, Rev B #11, Rev E, Rev F #17/#22, Rev F.1 #3/#9), `13_reference_library.md` (Part D `ui`, B4 Hindi terms, UX4G rows), `lld.html` §10 screens, `14_build_checklist.md` P7.
Standards and vendor docs: [UX4G Typography](https://ux4g.gov.in/foundations/typography) · [UX4G Accessibility](https://ux4g.gov.in/foundations/accessibility) · [UX4G Color](https://ux4g.gov.in/foundations/color) · [WCAG 1.4.3 Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) · [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) · [1.4.4 Resize Text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html) · [1.4.10 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html) · [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) · [3.1.1 Language of Page](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html) · [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html) · [WCAG 2.2 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [Android: 48dp targets](https://developer.android.com/guide/topics/ui/accessibility/apps) · [W3C text size in translation](https://www.w3.org/International/articles/article-text-size) · [W3C Indic Layout Requirements](https://www.w3.org/TR/ilreq/) · [WAI-ARIA APG Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) · [Radix Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip), issues [#1573](https://github.com/radix-ui/primitives/issues/1573), [#2589](https://github.com/radix-ui/primitives/issues/2589), discussion [#2866](https://github.com/radix-ui/primitives/discussions/2866) · [shadcn/ui components](https://ui.shadcn.com/docs/components) · [Tailwind responsive design (rem breakpoints)](https://tailwindcss.com/docs/responsive-design) · [Next.js fonts](https://nextjs.org/docs/app/api-reference/components/font) · [Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari) · [MDN Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) · [MDN @page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page) · [Chrome print margin boxes](https://developer.chrome.com/blog/print-margins) · [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934) · [RFC 6068 mailto](https://www.rfc-editor.org/rfc/rfc6068) · [RFC 5724 sms](https://www.rfc-editor.org/rfc/rfc5724) · [Denso Wave QR module size](https://www.qrcode.com/en/howto/cell.html) · [Constitution Part XVII, Art. 343 (MEA)](https://www.mea.gov.in/Images/pdf1/Part17.pdf) · [RBI English–Hindi glossary 2023](https://uco.bank.in/documents/d/guest/rbi-english-hindi-glossary-2023) · [CBIC Hindi tax-invoice flier](https://cbic-gst.gov.in/hindi/pdf/e-version-gst-fliers/tax-invoice-efliers-hindi.pdf) · [Medhi, Sagar, Toyama 2007](https://www.microsoft.com/en-us/research/?p=160568) · [lucide icons](https://lucide.dev/icons/) · iOS input zoom (community): [456 Berea Street](https://456bereastreet.com/archive/201212/ios_webkit_browsers_and_auto-zooming_form_controls).
Local checks (Node v22.22.1, ICU): `Intl.NumberFormat` en-IN/hi-IN outputs, `Intl.DateTimeFormat` hi-IN medium vs long, `Intl.Segmenter` grapheme counts, WCAG relative-luminance contrast ratios for the UX4G tokens.

## Candidate additions

- **`Term` component: plain label + ⓘ → Popover (not hover Tooltip)** (Design & UX, ~30 min, demo-visible: True) — One component `Term` renders the plain-word label and a 48px-hit ⓘ button that opens a shadcn Popover with the accounting term and a one-line meaning in the current language (EN/HI). Used for every label/hint i18n pair on all screens. Replace every planned Tooltip usage. _Why:_ The pack's 'accounting term in a tooltip' rule is judged on phones; Radix/shadcn Tooltip opens only on focus or hover, so a judge tapping on Android sees nothing. A Popover works on tap, click and keyboard, so the Design & UX judge sees the rule honoured on the first tap.
- **Fixed help button whose glossary is generated from the i18n label/hint pairs** (Design & UX, ~30 min, demo-visible: True) — A `?` Button fixed bottom-right (above the bottom nav on phones) on every owner screen; opens a Sheet with: one i18n paragraph for the current route, 'Words we use' built by iterating every key that has both `label` and `hint` in en.json/hi.json, the demo-clock explanation and the owner contact. _Why:_ UX4G/Medhi-style 'one help control that never moves' for low-digital-literacy owners, and it gives the Design & UX judge a full bilingual glossary with zero content effort because it reuses the Term pairs.
- **Hash-stamp sheet + 'Record unaltered · n records' strip on the escalation timeline** (Design & UX, ~45 min, demo-visible: True) — Each timeline event shows a monospace `# 3f9a…c21e` stamp (48px hit). Tap opens a bottom Sheet with the full hash in two 32-char lines, a Copy button, 'links to # …1a2b (the entry above)', a QR of /verify/<hash> and a 48px 'Open verify page' button. Above the thread a strip calls /api/verify on the newest hash: green 'Record unaltered · 14 records', amber 'Couldn't check right now' on network error, red 'Record altered — chain breaks at record 9' only when the API says so. _Why:_ Turns the trust layer into a visible status word on the hero screen (Design & UX signature named in the plan) and lets a judge scan the QR from the laptop screen with a phone — the A15 tamper test becomes a visible red strip in the video.
- **Future rungs as hollow milestones inside the timeline (the pack's ladder visual, no extra screen)** (Design & UX, ~20 min, demo-visible: True) — The Timeline renders rungs not yet reached as hollow dots with 'Next: Final reminder · in 4 days (3 Nov)' using the ladder offsets from config; paused spans render as a hatched band with the self-resume sentence. The same component, with past events hidden, is the live preview in Settings → Reminder steps. _Why:_ Covers pack screen 6 (escalation ladder) and the 'where is this bill headed' question in one component; editing offsets in Settings visibly moves the hollow dots — a cause-and-effect moment for Design & UX and Innovation judges.
- **Lakh sublabel under hero amounts via Intl compact notation** (Design & UX, ~10 min, demo-visible: True) — Under 'Money to collect ₹11,80,000' show '≈ 11.8 lakh' (en-IN compact gives '11.8L'; render 'lakh' word) and in Hindi '≈ 11.8 लाख' (hi-IN compact output, verified). Only on the two dashboard hero tiles and the forecast breach card. _Why:_ Owners think in lakhs; judges reading the video at a glance get the magnitude without counting commas. Zero library cost.
- **rem-only layout + three text sizes (16/18/20) so the 'largest text size' pass is automatic** (Design & UX, ~20 min, demo-visible: True) — All widths, gaps, min-heights and grid minmax values in rem; Tailwind v4 breakpoints are already rem-based. Text size setting sets `html { font-size: 16px | 18px | 20px }` (LLD has two steps; widen to three). Hero tiles use `grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))` so they stack by themselves at 20px. _Why:_ The pack's debug prompt demands 360px AND largest text size with nothing clipped; rem layout makes that true by construction instead of a Sunday retrofit, and WCAG 1.4.4 (200% resize) follows.
- **Devanagari CSS rules on `[lang=hi]` and `min-height` buttons (measured Hindi growth)** (Design & UX, ~25 min, demo-visible: True) — One rule block: `[lang=hi] { line-height: 1.8; text-transform: none; letter-spacing: normal; hyphens: manual }`; every Button/chip uses `min-height: 3rem` never `height`, labels may wrap to two lines; OneTapSend and Inbox action rows become 2×2 grids below `sm`. Chip words capped at 12 graphemes by a node:test over hi.json. _Why:_ Measured: Hindi labels are a median 65% of English grapheme count but five short words grow 125–183% ('Snooze' → 'बाद में याद दिलाएँ'); Devanagari needs 1.8 line-height (UX4G). This prevents the clipped-button screenshots that will sink other teams' Hindi toggles.
- **Light theme only; `color-scheme: light`; no dark mode** (Design & UX, ~0 min, demo-visible: False) — Do not build dark mode. Set `color-scheme: light` on :root and ignore `prefers-color-scheme`. Keep the UX4G status tokens (#00522c/#8a1a16/#ad4e00/#006d75) with the tints #e3f1e8/#fbe9e7/#fff1e0/#e0f4f5. _Why:_ The UX4G tokens pass AA on white and their tints (4.89:1–9.38:1, computed) but fail on dark (success on #0f172a = 1.91:1). Dark mode would cost ~1h plus a second token set for no judge-visible gain; print is light anyway. Saves an hour for the hero timeline polish.
- **Native `<input type="date">` and Native Select on phones instead of shadcn Date Picker/Select** (Design & UX, ~0 min, demo-visible: True) — All date fields (promise date, demo date, manual payment date, due-date override, claim date) use the native date input; pickers with ≤7 options use shadcn Native Select below `md` and Select above. _Why:_ OS pickers are touch-sized, localised to Hindi by the phone, and free; saves ~30 min and avoids a Devanagari calendar at 360px. Technical judges see fewer dependencies, UX judges see a familiar control.
- **Chase-these-first, Documents and Customers-detail as filtered views of `InvoiceRow` + `Timeline`** (Technical Execution, ~40 min, demo-visible: True) — Build one `InvoiceRow` Item (customer · number · Money · StatusChip · days late · reason line · optional OneTapSend) and reuse it for the Invoices list, dashboard top-5, Chase-first (ranked, unfiltered), Customers detail Sheet, Documents (picker + Timeline + print buttons), Forecast gap-cover and Payments allocation. No bespoke pages for Chase-first, Documents or Customers. _Why:_ Recovers the ~1.5h by which Dev B's Sat 2–7 PM and Sun 9–12 slots overrun, while giving judges a consistent row everywhere (consistency is scored under Design & UX). The pack's 13 screens remain 13 routes.
- **Status chip icon map (lucide) with i18n words — one `StatusChip`** (Design & UX, ~20 min, demo-visible: True) — Fixed mapping: draft FilePen, sent Send, due soon BellRing, not due Clock, overdue AlertTriangle, part paid CircleDot, paid CheckCircle2, disputed MessageSquareWarning, promise Handshake, snoozed AlarmClockOff, failed MailX, chain intact ShieldCheck, chain broken ShieldAlert, no record ShieldQuestion; match confidence as words Sure/Likely/Check. Badge never wraps; Hindi chip words ≤12 graphemes. _Why:_ The pack's 'never rely on colour alone: every status has a word' and UX4G's 'icon + text' rule, satisfied once for 9 screens and print; a grayscale screenshot of the dashboard still reads.
- **GST explanation line that flips live in New invoice** (Presentation, ~15 min, demo-visible: True) — Under the totals: 'Same state (Punjab → Punjab): CGST ₹900 + SGST ₹900' becomes 'Different state (Punjab → Haryana): IGST ₹1,800' the moment the customer Combobox changes; state names come from the GSTIN's first two digits. _Why:_ The pack's demo script asks for same-state vs other-state side by side; this makes it one visible flip inside the form, scoring 'accuracy of financial calculations' and 'ease of use' in the same five seconds of video.
- **Promise sheet states its forecast effect before confirming** (Innovation, ~20 min, demo-visible: True) — In Follow-ups and invoice detail, the 'Promise to pay' Sheet shows a sentence computed from forecast.js: 'This pauses reminders and moves ₹1,18,000 from week 1 into week 3. If the date passes unpaid, reminders resume on their own.' _Why:_ Makes novelty lever 2 (promise → forecast reflow → auto-resume) legible to a judge in one sentence, inside the normal flow rather than a separate demo toggle.
- **Print: `@page` margin-box page numbers and a 'Record #hash · verify URL' footer on every print page** (Technical Execution, ~15 min, demo-visible: True) — `PrintFrame` adds `@page { size: A4; margin: 12mm; @bottom-right { content: counter(page) ' / ' counter(pages) } }` and a footer line with the chain hash and /verify URL plus a 20mm verify QR; UPI QR ≥30mm on invoice and letter; Discount column auto-hidden when all zero. _Why:_ Judges open the PDF; '2 / 2' and a verify footer on each page read as evidence-grade documents (Impact + Technical Execution) and the letter's pack-mandated disclaimer sits visibly under the title.
- **i18n completeness + chip-length `node:test`** (Technical Execution, ~15 min, demo-visible: False) — One test: every key in en.json exists in hi.json and vice versa; every key under `status.*` has ≤12 grapheme clusters in Hindi (Intl.Segmenter); every `*.label` has a `*.hint`. Runs in the existing GitHub Actions `node --test`. _Why:_ Guarantees the pack's 'every piece of text switches' acceptance item (A8) mechanically and prevents a clipped chip from appearing in the video; a technical judge reading tests/ sees UX rules enforced in CI.
- **Hindi dates with long month names; Latin digits everywhere** (Design & UX, ~5 min, demo-visible: True) — Date formatter: EN `day numeric, month short` ('7 Oct 2026'); HI `month long` ('7 अक्टूबर 2026') because `dateStyle: medium` in hi-IN yields '7 अक्टू॰ 2026'. Numbers always Latin digits (hi-IN default), Indian grouping via en-IN. _Why:_ Reads naturally to Hindi-speaking judges and owners; the Constitution's Art. 343(1) 'international form of Indian numerals' is the citation if asked why digits are not Devanagari.

## Risks

- **Hover tooltips never open for a judge on a phone (pack's 'accounting term in a tooltip' silently fails)** (L: High if shadcn Tooltip is used as planned, I: Design & UX judge taps ⓘ on Android, nothing happens; the pack rule looks unmet in the video) — Use the `Term` component (label + ⓘ → Popover) everywhere; no Tooltip in the owner app or /pay
- **Hindi strings clip in fixed-height buttons and chips** (L: Medium — five pairs grow 125–183% (Snooze, Pay by, Before GST, Pay by UPI, Sent/Paid) and Devanagari needs 1.8 line-height, I: Clipped or overflowing text at 360px in the Hindi toggle moment of the video; fails pack 'long Hindi words wrap') — `min-height: 3rem` not `height`; 2×2 button grids below `sm`; chip words ≤12 graphemes enforced by test; `[lang=hi]` line-height 1.8
- **Dev B slots Sat 2–7 PM, Sat 7–11 PM and Sun 9–12 overrun by 30–45 min each** (L: High without the §6 remedies, I: Hindi pass or print polish gets cut on Saturday night; Sunday polish slot vanishes) — Customers as a Sheet, Inbox edit as a link, typed allocations, bundle reusing letter sections + Timeline print, Hindi pass on demo screens first, static privacy card; Claude drafts seed generator and Settings fields from lists
- **Eleven-column invoice table does not fit A4 portrait legibly** (L: Medium, I: Judges open the PDF and see wrapped headers or 8pt text; 'document generation' scored down) — 9.5pt table font, Discount column hidden when all zero, CGST/SGST shown as 'rate / amount' stacked in one cell, `thead` repeats, `break-inside: avoid`
- **Print page numbers / margin boxes only in Chrome 131+** (L: Certain in Firefox/Safari, I: Letter page 2 lacks '2 / 2' if a judge prints from another browser; cosmetic) — Record the video from Chrome; README says 'print from Chrome or Edge'; content never depends on margin boxes
- **`upi://` link does nothing on a laptop; `sms:` body syntax differs between Android and iOS** (L: Certain for upi on desktop; medium for sms, I: A judge clicks 'Pay by UPI' on a laptop and sees no response; SMS one-tap may open with an empty body on one OS) — /pay leads with the QR at `md`+ and the button below `md`; sms uses `?body=` (RFC 5724) and the README notes the iOS variant; video shows the phone for both
- **UX4G status colours fail contrast if a dark theme is attempted** (L: Certain (success on #0f172a = 1.91:1, computed), I: AA failure visible to an accessibility-minded judge; wasted hour) — Light theme only, `color-scheme: light`
- **Hindi accounting terms read oddly to a native speaker** (L: Medium — pairs were composed from the RBI/CBIC glossaries by a non-native writer, I: A Hindi-speaking judge marks the toggle as machine-translated) — Screens use everyday बिल/बकाया/वसूली; print uses RBI/CBIC terms; the Term hint carries the formal word so both appear
- **`dateStyle: medium` in hi-IN prints abbreviated months with the ॰ sign** (L: Certain (verified: '7 अक्टू॰ 2026'), I: Looks like a rendering glitch to owners and judges) — Hindi formatter uses `month: 'long'`; allow date cells to wrap
- **Largest text size (20px) breaks 360px layouts that used px widths** (L: Medium if any px width slips in, I: Fails the pack's 'at the largest text size' debug check; horizontal scroll in the video) — rem-only rule; `auto-fit minmax(10rem, 1fr)` grids; QR sizes are the only allowed px; U2 acceptance check on all 18 routes
- **iOS Safari zooms into inputs under 16px and stays zoomed** (L: Low (pack already mandates 16px) — only if a 14px helper input is added, I: Pay page jumps when a customer types a UTR on an iPhone) — All inputs 16px incl. the /pay claim form; test on one iPhone if available
- **The 'Record unaltered' strip shows red on a transient API error** (L: Low if coded as specified, I: A judge sees 'Record altered' on a healthy demo — the worst possible false signal) — Network/5xx → amber 'Couldn't check right now'; red only when /api/verify returns `intact:false`