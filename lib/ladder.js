export const RUNGS = ["heads_up", "due_date", "overdue_gentle", "overdue_firm", "demand_letter", "odr_guidance"];

export const DEFAULT_OFFSETS = { heads_up: -3, due_date: 0, overdue_gentle: 7, overdue_firm: 15, demand_letter: 30, odr_guidance: 45 };

export const DEFAULT_AUTO_RUNGS = ["heads_up", "due_date"];

export const PROMISE_MAX_DAYS = 14;

const META = {
  heads_up: { policy: "auto", tone: "friendly" },
  due_date: { policy: "auto", tone: "polite" },
  overdue_gentle: { policy: "owner_tap", tone: "firmer" },
  overdue_firm: { policy: "owner_tap", tone: "final", call_prompt: true },
  demand_letter: { policy: "owner_action", tone: "formal" },
  odr_guidance: { policy: "owner_action", tone: "advisory" },
};

const ACTIVE_STATUSES = new Set(["sent", "part_paid"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function rungMeta(rung, offsets = DEFAULT_OFFSETS) {
  const meta = META[rung];
  return meta ? { offset: withDefaults(offsets)[rung], ...meta } : null;
}

export function rungIndex(rung) {
  return RUNGS.indexOf(rung);
}

export function daysOverdue(invoice, today) {
  return daysBetween(invoice.due_date, today);
}

export function dueRungs(invoice, today, offsets = DEFAULT_OFFSETS) {
  const days = daysOverdue(invoice, today);
  const merged = withDefaults(offsets);
  return RUNGS.filter((rung) => days >= merged[rung]);
}

export function evaluate(invoice, ctx) {
  const { today, offsets = DEFAULT_OFFSETS, auto_rungs = DEFAULT_AUTO_RUNGS, customer = {}, open_promise = null } = ctx;
  if (!isDate(today)) throw new TypeError("ctx.today must be a YYYY-MM-DD string");
  const broken = ctx.broken_promise === true || (open_promise != null && open_promise.promised_date < today);
  const current = rungIndex(invoice.rung);
  const target = targetIndex(invoice, today, offsets, current, broken);
  const result = {
    eligible: false,
    reason: null,
    target_rung: target >= 0 ? RUNGS[target] : null,
    skipped: target > current + 1 ? RUNGS.slice(current + 1, target) : [],
    action: "none",
    channel_policy: null,
  };
  const pausedBy = invoice.paused_by ?? (open_promise ? "promise" : null);
  const liftPromise = pausedBy === "promise" && broken;
  if (!ACTIVE_STATUSES.has(invoice.status)) return { ...result, reason: "status" };
  if (pausedBy && !liftPromise) return { ...result, reason: "paused" };
  if (invoice.snoozed_until && invoice.snoozed_until >= today) return { ...result, reason: "snoozed" };
  if (target <= current) return { ...result, reason: "nothing_due" };
  const channel_policy = channelPolicy(result.target_rung, auto_rungs, customer.opt_out === true);
  if (!channel_policy) return { ...result, reason: "opt_out" };
  return {
    ...result,
    eligible: true,
    reason: broken ? "promise_broken" : "due",
    action: liftPromise ? "unpause_and_advance" : "advance",
    channel_policy,
  };
}

export function onPromise(invoice, promised_date, today, maxDays = PROMISE_MAX_DAYS) {
  if (!ACTIVE_STATUSES.has(invoice.status)) return fail("status", "Only a sent or part-paid invoice can take a promise to pay");
  if (invoice.paused_by === "promise" || invoice.open_promise) return fail("promise_open", "A promise to pay is already open for this invoice");
  if (!isDate(promised_date)) return fail("invalid_date", "promised_date must be a YYYY-MM-DD date");
  const days = daysBetween(today, promised_date);
  if (days < 1) return fail("date_past", "The promised date must be after today");
  if (days > maxDays) return fail("date_too_far", `The promised date can be at most ${maxDays} days from today`);
  return { ok: true, error: null };
}

export function onDispute() {
  return "dispute";
}

export function onClaim() {
  return "claim";
}

export function nextSteps(invoice, business = {}) {
  if (invoice.rung !== "odr_guidance") return [];
  const steps = ["ladder.next_steps.call_customer", "ladder.next_steps.consult_lawyer"];
  if (udyamMicroOrSmall(business)) steps.push("ladder.next_steps.file_msme_odr");
  return steps;
}

export function validateOffsets(offsets) {
  if (!offsets || typeof offsets !== "object") return fail("offsets", "ladder_offsets must be an object");
  let prev = -Infinity;
  for (const rung of RUNGS) {
    const days = offsets[rung];
    if (!Number.isInteger(days)) return fail("offsets", `${rung} must be a whole number of days`);
    if (days <= prev) return fail("offsets", `${rung} must come after the rung before it`);
    prev = days;
  }
  return { ok: true, error: null };
}

function targetIndex(invoice, today, offsets, current, broken) {
  const due = dueRungs(invoice, today, offsets);
  const highestDue = due.length ? rungIndex(due[due.length - 1]) : -1;
  if (!broken) return highestDue;
  return Math.max(Math.min(current + 1, RUNGS.length - 1), highestDue);
}

function channelPolicy(rung, autoRungs, optOut) {
  if (META[rung].policy === "owner_action") return optOut ? "owner_action_only" : "owner_action";
  if (optOut) return null;
  return autoRungs.includes(rung) ? "auto" : "owner_tap";
}

function udyamMicroOrSmall(business) {
  // MSMED Act 2006 s.2(n): only Udyam-registered micro or small enterprises can file on the MSME ODR portal (formerly Samadhaan)
  const cls = business.msme_class;
  return business.udyam === true && (cls == null || cls === "micro" || cls === "small");
}

function withDefaults(offsets) {
  return { ...DEFAULT_OFFSETS, ...offsets };
}

function fail(code, message) {
  return { ok: false, error: { code, message } };
}

function utcMidnight(date) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(from, to) {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / 86400000);
}

function isDate(value) {
  return typeof value === "string" && DATE_RE.test(value) && new Date(utcMidnight(value)).toISOString().slice(0, 10) === value;
}
