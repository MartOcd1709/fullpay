# Competitor & Existing-Solution Research

Condensed from three parallel research passes (2026-10-22, web-verified). [V]=verified from cited source, [I]=interpretation. Full URL list in `sources.md`.

## Statement 1 — mParivahan / DL journey

- **mParivahan (NIC):** official app. The govt's own UX4G case study documents sign-in friction, crashes/slow loads, upload difficulty, poor fit for low-digital-literacy users [V]. Third-party tracker ranks "NextGen mParivahan" the most-complained-about app in India at ~2.2★ [V-unofficial; re-verify on Play Store].
- **Sarathi portal:** has state-wise LL question banks + mock test [V]. Documented failures: Kerala ~90% LL fail after software update (verbose questions, mid-test CAPTCHA, unscored answers) [V-news]; test passwords not delivered [V-complaints]; platform downtimes [V-policy-lab].
- **Prep apps:** RTO Exam (~12.6M installs, unverified), Learners Test, DriveMate — multilingual quiz-only [V listings]. None do guided journeys, voice, or accessibility [I from listings].
- **OSS/hackathon prior art:** none surfaced [V-absence, weak].
- **Usable in 48h:** Sarathi question banks (sample, label simulated); AI4Bharat IndicTrans2 (MIT, 22 languages) [V]; Sarvam AI APIs (translate/STT/TTS, free tier) [V]; Bhashini ULCA key (quotas unverified — risk) [V].
- **Gaps:** official flow actively fails applicants; no voice-first multilingual assistance; quiz apps ≠ journey guidance.
- **48h risks:** TTS latency (pre-cache), "just another quiz app" perception, question-bank copyright.

## Statement 2 — Hospital queue/navigation (excluded)

- ABDM Scan&Share: 1 Cr+ OPD tokens in year one, registration only, needs ABHA app [V]. eHospital/ORS: Delhi HC filing shows 20/38 hospitals use only 5–10 modules [V]. Indoor nav only at flagships: AIIMS Disha (BLE, offline, wheelchair routes), PGI MargDarshan [V]. CAG: 34% wait >15 min to register (J&K); 62% >30 min for consult; ~790 patients/day/counter (UP) [V]. Hackathon prior art: several token-queue projects (MediCure, SmartOPD, QueueLens) — none combine queue+nav+emergency+accessibility [V/I]. ABDM sandbox not obtainable in 48h [V dev-forum].

## Statement 3 — Standardized digital banking

- **Regulatory:** RBI circular (Oct 11, 2024) directs payment-system participants to adopt the Finance Ministry's Feb 2024 accessibility standards [V]. No reference implementation exists [I].
- **Voice/elderly:** UPI123Pay (feature phones) [V]; **Hello! UPI launched Sept 2023 Hindi+English only; regional languages still "planned"** [V]. Senior modes fragmented per bank: bob World Gold, IDFC senior section, GenWise+Axis [V]. Khyaal (~3M 50+ users, not a bank) [V].
- **Exclusion/fraud evidence:** NCAER ~75% of rural population can't transact digitally [V]; UPI fraud ₹1,087 Cr FY24 (+85% YoY), ₹485 Cr H1 FY25 [V]. No age-split fraud stats exist — don't invent them.
- **OSS/prior art:** no canonical accessible-banking-UX project found [V-absence, weak].
- **Usable in 48h:** Web Speech API (no key), Bhashini/ULCA, AI4Bharat models, Razorpay test mode (UPI intent needs live mode → simulate) [V].
- **Gaps:** regional-language voice banking unshipped; no in-flow contextual scam warnings; no cross-bank standard UX.
- **48h risks:** UI-mockup ceiling; ASR in noisy rooms (script the demo); don't imitate real bank branding.

## Statement 4 — Invoice chase

- **Indian incumbents:** Vyapar & myBillBook both already do GST invoices AND payment reminders (₹399/yr-class pricing; 4.3–4.4★ Capterra) [V]. Khatabook/OkCredit: free ledger + SMS/WhatsApp reminders; complaints: expiring payment links, poor exports [V reviews]. Zoho Books free <₹25L revenue; **cash-flow forecasting locked to Premium ₹2,999/mo** [V]. **QuickBooks exited India Apr–Jul 2023** [V-Intuit blog].
- **Collections specialists:** Chaser (UK) — email/SMS chasing, AI prioritization, ~£135–360/mo [V]; Upflow mid-market [V]. **Nothing found that automates MSMED Act demand letters or Samadhaan escalation** [V-absence after targeted search]; closest is a Product Hunt concierge MVP ("Nudge") [V].
- **OSS:** Invoice Ninja (active, ~9.8k★, free self-hosted) [V]; Crater unmaintained/discontinued [V]. Neither does India GST e-invoice schema or escalation [I]. No Devfolio/Devpost match for "WhatsApp invoice chaser for MSMEs" [V-absence, weak].
- **Impact data:** delayed MSME payments ₹7.34 lakh crore as of Mar 2024 (GAME/FISME/C2FO; earlier D&B/GAME 2022 estimate ₹10.7 L-cr) [V — cite figure+year+methodology]; Samadhaan 2.5 lakh+ applications, ₹28,817 Cr pending [V].
- **Usable in 48h:** official GST INV-1 e-invoice JSON schema (einvoice.gst.gov.in; third-party copies fine for demo) [V]; Razorpay test mode; UPI deep link `upi://pay?...` (verify before demo); Meta WhatsApp Cloud API test number, or mock the thread (statement allows).
- **Gaps:** reminders→legal-escalation chasm; affordable forecasting; Chaser-class workflow at Indian prices.
- **48h risks:** "not Vyapar" answer must be instant; don't claim real IRN generation (needs GSTN sandbox credentials) — generate schema-valid JSON + QR; demand letters need "not legal advice" disclaimer; verify MSMED §16 interest formula (3× bank rate, monthly compounding) against the Act text before any slide.

## Statement 5 — Menstrual health (excluded)

- Flo: FTC settlement 2021 (shared health data with Facebook/Google SDKs); jury found Meta illegally harvested Flo data; Anonymous Mode is lossy [V]. Clue: irregularity analysis paywalled (~£25/yr) [V]. Maya (India): Privacy International caught it sending sexual-health data to Facebook pre-consent [V]. Mozilla: 18/25 apps privacy-flagged; only Euki clean [V]. OSS: drip (GPL-3, local-only) [V]. Gap trifecta: private+free+full-featured exists nowhere; no Indic-language PCOS education found [V-absence].

## Statement 6 — Government accountability

- **CPGRAMS:** 111th Parliamentary Standing Committee report — ministries close grievances without reasons; complainants redirected and cases disposed with "no redressal"; ~20% miss time limits; limit cut 60→45→30(21) days over time [V]. DARPG claims ~90% disposal — the committee's issue is closure *quality* [V]. No public CPGRAMS API [V-absence]; monthly PDF stats exist for demo seeding [V].
- **RTI portals:** Maharashtra 49 failed e-filings with fees deducted; Karnataka portal "a mockery"; J&K glitches block statutory timelines [V-news].
- **ipaidabribe (Janaagraha):** anonymous bribe crowd-reporting, UN-linked award 2017; no evidence chain, no escalation, no outcomes [V/I].
- **Legal aid:** NALSA e-portal + 15100 helpline; Tele-Law via 2.5 lakh CSCs, 60 lakh+ beneficiaries, app in 6 languages [V]. Siloed from grievance systems [I].
- **OSS:** FixMyStreet (mySociety) routes reports to authorities with public tracking [V]; Ushahidi crowdmapping [V]. Neither: tamper-evident records, hierarchy auto-escalation, accountability profiles [I].
- **Validation:** DARPG ran its own 2024 hackathon on grievance redressal with anonymized datasets [V].
- **48h risks:** defamation/misuse (use fictional officials, private-by-default, accused-response window, process-accountability framing); hash chain not blockchain; compress timers openly; LLM summaries must show source quotes.
