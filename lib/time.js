const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const FY_RE = /^(\d{2})-(\d{2})$/;

const clock = { demoOffsetDays: 0, fixedToday: null };

const istParts = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const display = {
  en: new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }),
  hi: new Intl.DateTimeFormat("hi-IN-u-nu-latn", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }),
};

const pad2 = (n) => String(n).padStart(2, "0");

function utcMs(y, m, d) {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t.getTime();
}

function daysInMonth(y, m) {
  return new Date(utcMs(y, m + 1, 0)).getUTCDate();
}

function msOf(iso) {
  const { y, m, d } = parseISO(iso);
  return utcMs(y, m, d);
}

function fromMs(ms) {
  const t = new Date(ms);
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function istDateOf(date) {
  const p = Object.fromEntries(istParts.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function assertInt(n, name) {
  if (!Number.isInteger(n)) throw new RangeError(`${name} must be an integer, got ${n}`);
}

export function initTime({ demoOffsetDays = 0, fixedToday = null } = {}) {
  assertInt(demoOffsetDays, "demoOffsetDays");
  if (fixedToday != null && !isISODate(fixedToday)) throw new RangeError(`fixedToday must be 'YYYY-MM-DD', got ${fixedToday}`);
  clock.demoOffsetDays = demoOffsetDays;
  clock.fixedToday = fixedToday ?? null;
}

export function today() {
  if (clock.fixedToday) return clock.fixedToday;
  return addDays(istDateOf(new Date()), clock.demoOffsetDays);
}

export function isISODate(s) {
  if (typeof s !== "string" || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parseISO(s) {
  if (!isISODate(s)) throw new RangeError(`Invalid ISO date: ${s}`);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function toISO(y, m, d) {
  const iso = `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
  if (!isISODate(iso)) throw new RangeError(`Invalid calendar date: ${y}-${m}-${d}`);
  return iso;
}

export function addDays(iso, n) {
  assertInt(n, "days");
  return fromMs(msOf(iso) + n * DAY_MS);
}

export function addMonths(iso, n) {
  assertInt(n, "months");
  const { y, m, d } = parseISO(iso);
  const idx = y * 12 + (m - 1) + n;
  const y2 = Math.floor(idx / 12);
  const m2 = idx - y2 * 12 + 1;
  return toISO(y2, m2, Math.min(d, daysInMonth(y2, m2)));
}

export function dayAfter(iso) {
  return addDays(iso, 1);
}

export function daysBetween(a, b) {
  return Math.round((msOf(b) - msOf(a)) / DAY_MS);
}

export function compareISO(a, b) {
  parseISO(a);
  parseISO(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxISO(...isos) {
  return isos.filter((x) => x != null).sort(compareISO).at(-1);
}

export function minISO(...isos) {
  return isos.filter((x) => x != null).sort(compareISO)[0];
}

export function fyOf(iso) {
  const { y, m } = parseISO(iso);
  const start = m >= 4 ? y : y - 1;
  return `${pad2(start % 100)}-${pad2((start + 1) % 100)}`;
}

export function fyRange(fy) {
  const match = FY_RE.exec(fy ?? "");
  if (!match || (Number(match[1]) + 1) % 100 !== Number(match[2])) throw new RangeError(`Invalid financial year: ${fy}`);
  const start = 2000 + Number(match[1]);
  return { start: `${start}-04-01`, end: `${start + 1}-03-31` };
}

export function monthlyRests(fromIso, uptoIso) {
  const rests = [];
  for (let n = 1; ; n++) {
    const rest = addMonths(fromIso, n);
    if (compareISO(rest, uptoIso) > 0) return rests;
    rests.push(rest);
  }
}

export function formatDate(iso, lang = "en") {
  return (display[lang] ?? display.en).format(new Date(msOf(iso)));
}

export function formatDDMMYYYY(iso) {
  const { y, m, d } = parseISO(iso);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

export function nowISOTimestamp() {
  return new Date().toISOString();
}
