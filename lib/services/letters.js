// View models for the public and print pages: pay page extras, verify, invoice / letter / bundle print.
// Every function is (client, ctx, ...args) like the rest of the service layer.
import { randomBytes } from "node:crypto";
import { verifyEntry } from "../chain.js";
import { computeInterest, conventionFootnote } from "../interest.js";
import { STATE_CODES, isInterstate, einvoiceRequired, einvoiceJson } from "../gst.js";
import { addDays, daysBetween } from "../time.js";
import { amountInWords } from "../money.js";
import * as views from "./views.js";
import * as pub from "./public.js";
import * as payments from "./payments.js";
import { interestEligible, interestInputs, event, loadInvoice } from "./common.js";
import { appError, conflict, notFound } from "./errors.js";

const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
export const istDate = (ts) => IST_DATE.format(new Date(String(ts).replace(" ", "T")));
export const stateLabel = (code) => (code ? `${STATE_CODES[String(code).padStart(2, "0")] ?? "—"} (${String(code).padStart(2, "0")})` : "—");
const sum = (rows, key = "amount_paise") => rows.reduce((s, r) => s + r[key], 0);

// GST on s.16 interest (K10): interest is split over the invoice's GST-rate buckets by taxable value, taxed at each
// bucket's rate (Circular 178/10/2022 para 9), CGST+SGST or IGST by the original place of supply. Integer paise per bucket.
export function gstOnInterest(interest_paise, items, { interstate, registration }) {
  if (registration !== "regular" || !(interest_paise > 0)) return null;
  const taxable = sum(items, "taxable_paise");
  if (taxable <= 0) return null;
  const byRate = new Map();
  for (const it of items) byRate.set(it.gst_bps, (byRate.get(it.gst_bps) ?? 0) + it.taxable_paise);
  const buckets = [...byRate]
    .filter(([bps]) => bps > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([bps, base]) => {
      const share = Math.round((interest_paise * base) / taxable);
      const half = Math.round((share * bps) / 20000);
      const igst = interstate ? Math.round((share * bps) / 10000) : 0;
      return { bps, base_paise: share, cgst_paise: interstate ? 0 : half, sgst_paise: interstate ? 0 : half, igst_paise: igst, gst_paise: interstate ? igst : 2 * half };
    });
  return buckets.length ? { interstate, buckets, total_paise: sum(buckets, "gst_paise") } : null;
}

// RBI press-release ids per Bank Rate change: config lists them in series order in rbi_bank_rate.source.
function rateSources(cfg) {
  const series = cfg.rbi_bank_rate?.series ?? [];
  const prids = (/prid ([\d, ]+)/.exec(cfg.rbi_bank_rate?.source ?? "")?.[1] ?? "").split(/[ ,]+/).filter(Boolean);
  return series.map((s, i) => ({ from: s.from, bps: s.bps, prid: s.prid ?? (prids.length === series.length ? prids[i] : null) }));
}

function decorateSegments(interest, cfg) {
  if (!interest) return null;
  const sources = rateSources(cfg);
  return {
    ...interest,
    segments: interest.segments.map((s) => {
      const src = sources.findLast((x) => x.from <= s.from);
      return { ...s, rbi_from: src?.from ?? null, prid: src?.prid ?? null };
    }),
  };
}

const payeeOf = (inv) => inv.timeline.find((e) => e.type === "invoice_created")?.payload?.payee ?? null;
const hashOf = (inv, type) => [...inv.timeline].reverse().find((e) => e.type === type)?.entry_hash ?? null;

async function base(client, ctx, id) {
  const docs = await views.documents(client, ctx, id);
  const { business, invoice: inv, customer } = docs;
  const interstate = isInterstate(business.state_code, inv.place_of_supply);
  return {
    ...docs,
    interstate,
    eligible: interestEligible(ctx.cfg),
    labels: { business_state: stateLabel(business.state_code), customer_state: stateLabel(customer.state_code), pos: stateLabel(inv.place_of_supply) },
    acceptance_date: inv.acceptance_date ?? inv.delivery_date ?? inv.issue_date,
  };
}

// /print/invoice/[id]
export async function invoicePrint(client, ctx, id) {
  const v = await base(client, ctx, id);
  const inv = v.invoice;
  return {
    ...v,
    words: amountInWords(inv.total_paise, "en"),
    einvoice: einvoiceRequired(v.business.turnover_paise ?? 0) && inv.doc_type === "tax_invoice",
    show_discount: inv.items.some((it) => it.discount_paise > 0),
    record_hash: hashOf(inv, "invoice_created"),
  };
}

// /api/print/einvoice/[id] (K28): NIC INV-01 shaped JSON; export only.
export async function einvoice(client, ctx, id) {
  const v = await base(client, ctx, id);
  const inv = v.invoice;
  if (inv.status === "draft") throw conflict("draft", "Send the invoice first: drafts have no number");
  if (inv.doc_type !== "tax_invoice") throw conflict("not_tax_invoice", "E-invoices are only for Tax Invoices");
  return {
    number: inv.number,
    json: einvoiceJson({ invoice: inv, items: inv.items, business: { ...v.business, regtype: v.business.registration }, customer: v.customer }),
  };
}

// /print/letter/[id]: the letter as issued on its letter_generated date; amounts are as of that date.
export async function letterView(client, ctx, id) {
  const v = await base(client, ctx, id);
  const inv = v.invoice;
  const cfg = ctx.cfg;
  const gen = [...inv.timeline].reverse().find((e) => e.type === "letter_generated");
  const available_on = addDays(inv.due_date, cfg.ladder?.offsets?.demand_letter ?? 30);
  if (!gen && (inv.status === "draft" || ctx.asOf < available_on)) return { ...v, available: false, available_on };
  const date = gen ? istDate(gen.ts) : ctx.asOf;
  const deadline = gen?.payload?.deadline_date ?? addDays(date, cfg.letter?.deadline_days ?? 7);
  const received = inv.allocations.filter((a) => a.allocated_on <= date);
  const credits = inv.credit_notes.filter((c) => c.issue_date <= date);
  const owed = Math.max(0, inv.total_paise - sum(received) - sum(credits));
  let interest = null;
  if (v.eligible && date > inv.due_date && owed > 0) {
    const inputs = await interestInputs(client, inv.id);
    interest = decorateSegments(
      computeInterest({
        principal_paise: Math.max(0, inv.total_paise - sum(credits)),
        due_date: inv.due_date,
        as_of: date,
        series: cfg.rbi_bank_rate.series,
        multiplier: cfg.msmed.s16_multiplier,
        allocations: inputs.allocations,
        dispute_spans: inputs.dispute_spans,
        appropriation: cfg.msmed.appropriation,
        day_count: cfg.msmed.day_count,
      }),
      cfg,
    );
  }
  // ponytail: GST is charged on all interest accrued; interest already settled by an interest-first part payment is not netted out.
  const interest_paise = interest?.total_interest_paise ?? 0;
  const gst = interest ? gstOnInterest(interest_paise, inv.items, { interstate: v.interstate, registration: v.business.registration }) : null;
  const include = Boolean(inv.letter_include_interest) && interest_paise > 0;
  const latest = [...inv.timeline].reverse().find((e) => e.type === "letter_generated" || e.type === "letter_options_changed");
  return {
    ...v,
    available: true,
    date,
    deadline,
    received,
    credits,
    owed_paise: owed,
    interest,
    interest_paise,
    gst,
    include,
    requested_paise: owed + (include ? interest_paise + (gst?.total_paise ?? 0) : 0),
    footnote: interest ? conventionFootnote(interest, "en") : null,
    record_hash: latest?.entry_hash ?? hashOf(inv, "invoice_created"),
    today_owed_paise: Math.max(0, inv.outstanding_paise),
  };
}

// Toolbar checkbox on the letter: "add the interest to the amount requested". Logged on the chain.
export async function setLetterInterest(client, ctx, id, include) {
  const inv = await loadInvoice(client, id, { lock: true });
  if (inv.status === "draft") throw conflict("draft", "Drafts have no letter");
  const value = Boolean(include);
  if (inv.letter_include_interest === value) return { include_interest: value };
  await client.query("UPDATE invoices SET letter_include_interest = $2 WHERE id = $1", [inv.id, value]);
  await event(client, ctx, inv.id, "letter_options_changed", "owner", { include_interest: value });
  return { include_interest: value };
}

// /print/bundle/[id]: the evidence pack, amounts and interest as of today.
export async function bundleView(client, ctx, id) {
  const v = await base(client, ctx, id);
  const inv = v.invoice;
  const cfg = ctx.cfg;
  const b = v.business;
  const interest = decorateSegments(inv.interest, cfg);
  const interest_paise = interest?.total_interest_paise ?? 0;
  const firstSupply = inv.delivery_date ?? inv.issue_date;
  const limitation_until = addDays(inv.due_date, 365 * 3 + 1); // ponytail: 3 calendar years approximated as 1096 days
  const regOn = b.udyam_registered_on ?? null;
  return {
    ...v,
    interest,
    interest_paise,
    gst: interest ? gstOnInterest(interest_paise, inv.items, { interstate: v.interstate, registration: b.registration }) : null,
    footnote: interest ? conventionFootnote(interest, "en") : null,
    days_overdue: inv.status === "draft" ? 0 : Math.max(0, daysBetween(inv.due_date, ctx.asOf)),
    odr_from: addDays(inv.due_date, cfg.ladder?.offsets?.odr_guidance ?? 45),
    gates: {
      micro_small: v.eligible,
      before_supply: regOn ? regOn <= firstSupply : null,
      registered_on: regOn,
      trader: b.nic_code ? /^4[5-7]/.test(String(b.nic_code)) : null,
      limitation_until,
      limitation_days: daysBetween(ctx.asOf, limitation_until),
    },
    payee: payeeOf(inv),
    record_hash: v.chain.verified_through,
  };
}

// /verify/[hash] and /v/[prefix]: whatever the code, only the record's type, invoice number, time, hash and payee leave here.
export async function verifyRecord(client, ctx, code) {
  const c = String(code ?? "").toLowerCase();
  if (!/^(?:[0-9a-f]{16}|[0-9a-f]{64})$/.test(c)) return { status: "invalid" };
  let hash = c;
  if (c.length === 16) {
    const { rows } = await client.query("SELECT entry_hash FROM escalation_events WHERE entry_hash LIKE $1 LIMIT 2", [`${c}%`]);
    if (rows.length !== 1) return { status: "not_found" };
    hash = rows[0].entry_hash;
  }
  const r = await verifyEntry(client, hash);
  if (!r.found) return { status: "not_found" };
  const { rows } = await client.query("SELECT count(*)::int AS n FROM escalation_events WHERE id <= (SELECT id FROM escalation_events WHERE entry_hash = $1)", [hash]);
  return { status: r.intact ? "intact" : "altered", event: r.event, payee: r.payee, checked_through: rows[0].n };
}

// /pay/[token]: public.byToken plus language, record hash, the s.37(2)(g) note branch and demo state. 404/410 become states.
export async function payPage(client, ctx, token) {
  const b = ctx.cfg.business;
  const extra = await client.query(
    `SELECT i.id, i.due_date, i.taxable_paise, c.preferred_lang, (c.gstin IS NOT NULL) AS buyer_registered,
            (SELECT entry_hash FROM escalation_events e WHERE e.invoice_id = i.id AND e.type = 'invoice_created' ORDER BY e.id LIMIT 1) AS record_hash,
            EXISTS (SELECT 1 FROM payments p JOIN payment_proposals pp ON pp.payment_id = p.id
                    WHERE pp.invoice_id = i.id AND p.status = 'pending' AND p.reference LIKE 'SIMUPI%') AS sim_pending
     FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.pay_token = $1`,
    [typeof token === "string" ? token : ""],
  );
  const row = extra.rows[0];
  const contact = { name: b.name, phone: b.phone, email: b.email };
  try {
    const view = await pub.byToken(client, ctx, token);
    return {
      state: "ok",
      ...view,
      lang: row.preferred_lang,
      record_hash: row.record_hash,
      sim_pending: row.sim_pending,
      tds_paise: Math.round(row.taxable_paise * 0.02),
      as_of: ctx.asOf,
      promise_max: addDays(ctx.asOf, 14),
      s37: interestEligible(ctx.cfg) && row.buyer_registered ? (ctx.asOf <= row.due_date ? "before" : "after") : null,
      udyam_class: b.udyam_class,
      contact,
      demo: process.env.DEMO_MODE === "1",
    };
  } catch (e) {
    if (e?.status === 410) return { state: "expired", lang: row?.preferred_lang ?? "en", contact };
    if (e?.status === 404) return { state: "missing", lang: row?.preferred_lang ?? "en", contact: null };
    throw e;
  }
}

// K6: "Pay by UPI (simulated)" posts a synthetic UPI credit through the real matcher. It stays pending until the owner confirms.
export async function simulateUpi(client, ctx, token, { tds = false } = {}) {
  if (process.env.DEMO_MODE !== "1") throw appError(403, "demo_only", "Simulated payments are only available in the demo");
  const view = await payPage(client, ctx, token);
  if (view.state === "expired") throw appError(410, "link_expired", "This link has expired");
  if (view.state !== "ok") throw notFound("link");
  const p = view;
  if (!["sent", "part_paid", "due_soon", "overdue"].includes(view.invoice.display_status)) throw conflict("not_open", "This invoice is not open for payment");
  if (p.sim_pending) throw conflict("already_simulated", "A simulated payment is already waiting for the seller to confirm");
  const amount_paise = tds ? view.invoice.outstanding_paise - p.tds_paise : view.offer?.pay_amount_paise ?? view.invoice.outstanding_paise;
  if (!(amount_paise > 0)) throw conflict("nothing_owed", "Nothing is owed on this invoice");
  const ref = `SIMUPI${randomBytes(4).toString("hex").toUpperCase()}`;
  const pay = await payments.addManual(client, ctx, {
    paid_on: ctx.asOf,
    amount_paise,
    reference: ref,
    narration: `UPI/${ref}/${view.invoice.number}/${view.invoice.buyer_name}`,
  });
  return { amount_paise, reference: ref, matched: (pay?.proposals ?? []).some((x) => x.number === view.invoice.number), confidence: pay?.match_confidence ?? null };
}

// Landing: the demo invoice's customer link and the demand letter's short verify code (DEMO_MODE only).
export async function demoLinks(client) {
  const { rows } = await client.query(
    `SELECT i.number, i.pay_token,
            (SELECT entry_hash FROM escalation_events e WHERE e.invoice_id = i.id AND e.type = 'letter_generated' ORDER BY e.id DESC LIMIT 1) AS letter_hash
     FROM invoices i WHERE i.number = 'INV/26-27/0042'`,
  );
  const r = rows[0];
  return r ? { number: r.number, pay_token: r.pay_token, verify_prefix: r.letter_hash?.slice(0, 16) ?? null } : null;
}
