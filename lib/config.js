export const RUNGS = ['heads_up', 'due_date', 'overdue_gentle', 'overdue_firm', 'demand_letter', 'odr_guidance'];

const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
};

export const DEFAULT_CONFIG = deepFreeze({
  rbi_bank_rate: {
    unit: 'bps',
    verified: '2026-10-22',
    source: 'RBI MPC resolutions prid 55178, 59692, 60176, 60604, 61749, 63742 (Bank Rate, not repo rate)',
    series: [
      { from: '2023-02-08', bps: 675 },
      { from: '2025-02-07', bps: 650 },
      { from: '2025-04-09', bps: 625 },
      { from: '2025-06-06', bps: 575 },
      { from: '2025-12-05', bps: 550 },
      { from: '2026-10-07', bps: 575 },
    ],
  },
  msmed: {
    s16_multiplier: 3,
    default_credit_days: 15,
    max_credit_days: 45,
    acceptance_default: 'delivery_date',
    appropriation: 'interest_first',
    day_count: 'actual/365',
    rests: 'monthly_from_due_date',
    eligible: ['micro', 'small'],
    sources: [
      'MSMED Act 2006 s.2(b), s.2(n), s.15, s.16',
      'Gurpreet Singh v UoI (SC 2006): part payments to interest first',
      'V.K. Patel v Simplex (Cal HC 2024): rate varies at each rest',
    ],
  },
  gst: {
    rates_bps: [0, 25, 150, 300, 500, 1800, 4000],
    einvoice_threshold_paise: 5000000000,
    hsn_digits: { upto_5cr: 4, above_5cr: 6 },
    sources: [
      'Notif 9/2025-IT(R) 22-09-2025',
      'Notif 19/2025-CT(R) 01-02-2026 (28% slab withdrawn)',
      'Notif 10/2023-CT (e-invoice > 5 cr)',
      'Notif 78/2020-CT (HSN digits)',
      'CGST Rule 46, Rule 48(5)',
    ],
    note: 'check current rates on cbic-gst.gov.in',
  },
  tds: {
    rates_bps: [10, 100, 200, 1000],
    labels: {
      10: 'Income-tax Act 2025 s.393(1) Sl. 8(ii) (was 194Q): 0.1% above Rs 50L, buyer turnover > Rs 10cr',
      100: 'Income-tax Act 2025 s.393(1) Sl. 6(i) (was 194C): 1% individual/HUF contractor, > Rs 30k single or Rs 1L aggregate',
      200: 'Income-tax Act 2025 s.393(1) Sl. 6(i) (was 194C) 2% others / Sl. 6(iii) (was 194J) 2% technical services, > Rs 50k',
      1000: 'Income-tax Act 2025 s.393(1) Sl. 6(iii) (was 194J): 10% professional fees, > Rs 50k',
    },
    in_force: '2026-04-01',
  },
  retention: { months_after_31dec: 72, fy_2026_27_until: '2033-12-31', source: 'CGST s.36 + Rule 80' },
  dpdp: {
    phase1: '2025-11-13',
    consent_managers: '2026-11-13',
    fiduciary_duties: '2027-05-13',
    logs_min_years: 1,
    erasure_exception: 's.8(7) retention for compliance with law',
    wording: 'designed to DPDP principles; duties not yet in force',
  },
  odr: {
    cutover: '2025-10-15',
    portal: 'https://odr.msme.gov.in',
    gates: ['udyam_before_supply', 'micro_or_small', 'not_trader_nic_45_47', 'within_limitation'],
    bundle_checklist: [
      'a. Seller details and Udyam Registration Number',
      'b. Buyer details and contact',
      'c. Undertaking that the facts stated are true',
      'd. Facts of the case with work order / agreement / invoices',
      'e. Payments received against the invoices',
      'f. Amount due and interest claimed (s.16 calculation attached)',
      'g. Signature of the applicant',
      'h. ID proof',
    ],
    source: 'MSE Scheme on ODR for Delayed Payment, Guidelines para 12.1.4 (a)-(h)',
  },
  business: {
    name: 'Arora Auto Components',
    legal_name: 'Arora Auto Components',
    address: 'Plot 14, Focal Point, Ludhiana',
    city: 'Ludhiana',
    state_code: '03',
    pin: '141010',
    gstin: '03AAXCA1234F1ZX',
    registration: 'regular',
    turnover_paise: 4500000000,
    udyam: true,
    udyam_number: 'UDYAM-PB-06-0012345',
    udyam_class: 'small',
    owner_name: 'Harpreet Arora',
    email: 'owner@example.in',
    phone: '+91 98XXXXXXXX',
    bank: { name: 'HDFC Bank', account_last4: '4321', ifsc: 'HDFC0001234', account_name: 'Arora Auto Components' },
    vpa: 'aroraauto@okhdfcbank',
    logo_url: null,
  },
  ladder: {
    offsets: { heads_up: -3, due_date: 0, overdue_gentle: 7, overdue_firm: 15, demand_letter: 30, odr_guidance: 45 },
    auto_rungs: ['heads_up', 'due_date'],
  },
  messaging: {
    cap_per_customer_per_day: 1,
    footer_en: 'We never ask for OTP/PIN or change bank details.',
    footer_hi: 'हम कभी OTP/PIN नहीं मांगते, न बैंक विवरण बदलते हैं।',
    stop_line_en: 'Reply STOP to stop reminders.',
    stop_line_hi: 'याद दिलाना बंद करने के लिए STOP लिखकर जवाब दें।',
  },
  // Festivals: no reminders on quiet days; a settlement drive in the weeks before, when traders traditionally clear their
  // khata. Dates move with the lunar calendar: check a panchang each year (Diwali 2026: Sun 8 Nov, Dhanteras Fri 6 Nov).
  calendar: {
    festivals: [
      { key: 'diwali', date: '2026-11-08', eve: '2026-11-06', quiet_from: '2026-11-06', quiet_to: '2026-11-10', drive_days: 15 },
    ],
    quiet_days: [],
  },
  // Pay-early offers: the owner's cost of borrowing (overdraft / loan, % a year in bps) and the largest discount offered.
  finance: { borrow_rate_bps: 1400, max_discount_bps: 200, treds_rate_low_bps: 700, treds_rate_high_bps: 1000 }, // TReDS band: indicative, set by financier bids
  letter: { deadline_days: 7 },
  forecast: { buffer_paise: 15000000, opening_balance_paise: 42000000, weeks: 13 },
  reliability: { a_min_pct_on_time: 80, a_max_avg_late: 5, c_max_pct_on_time: 50, c_min_avg_late: 30 },
  ui: {
    lang: 'en',
    text_size: 'md',
    status_colors: { success: '#00522c', error: '#8a1a16', warning: '#ad4e00', info: '#006d75' },
    body_px: 16,
    line_height: { latin: 1.5, devanagari: 1.8 },
    font: 'Noto Sans',
  },
  demo: { offset_days: 0 },
});

const fail = (message) => {
  throw Object.assign(new Error(message), { code: 'CONFIG_INVALID' });
};
const isInt = Number.isSafeInteger;
const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const at = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

const INT_PATHS = [
  'finance.borrow_rate_bps',
  'finance.max_discount_bps',
  'msmed.s16_multiplier',
  'msmed.default_credit_days',
  'msmed.max_credit_days',
  'gst.einvoice_threshold_paise',
  'business.turnover_paise',
  'messaging.cap_per_customer_per_day',
  'letter.deadline_days',
  'forecast.buffer_paise',
  'forecast.opening_balance_paise',
  'forecast.weeks',
  'demo.offset_days',
];

function checkSeries(series) {
  if (!Array.isArray(series) || series.length === 0) fail('rbi_bank_rate.series must be a non-empty array');
  series.forEach((s, i) => {
    if (!isIsoDate(s?.from)) fail(`rbi_bank_rate.series[${i}].from must be YYYY-MM-DD`);
    if (!isInt(s.bps) || s.bps < 0) fail(`rbi_bank_rate.series[${i}].bps must be a non-negative integer`);
    if (i > 0 && s.from <= series[i - 1].from) fail('rbi_bank_rate.series must be sorted ascending by from');
  });
}

function checkIntArray(cfg, path) {
  const arr = at(cfg, path);
  if (!Array.isArray(arr) || !arr.every((v) => isInt(v) && v >= 0)) fail(`${path} must be an array of non-negative integers`);
}

function checkLadder(ladder) {
  const offsets = ladder?.offsets ?? {};
  RUNGS.forEach((r, i) => {
    if (!isInt(offsets[r])) fail(`ladder.offsets.${r} must be an integer`);
    if (i > 0 && offsets[r] <= offsets[RUNGS[i - 1]]) fail('ladder.offsets must be ascending in rung order');
  });
  if (!Array.isArray(ladder.auto_rungs) || !ladder.auto_rungs.every((r) => RUNGS.includes(r))) fail('ladder.auto_rungs must list rung names');
}

export function validateConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') fail('config must be an object');
  checkSeries(cfg.rbi_bank_rate?.series);
  checkIntArray(cfg, 'gst.rates_bps');
  checkIntArray(cfg, 'tds.rates_bps');
  checkLadder(cfg.ladder);
  for (const p of INT_PATHS) if (!isInt(at(cfg, p))) fail(`${p} must be an integer`);
  if (!['en', 'hi'].includes(cfg.ui?.lang)) fail('ui.lang must be en or hi');
  return cfg;
}

const isPlain = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

export function mergeConfig(defaults, overrides) {
  if (overrides == null) return defaults;
  if (!isPlain(defaults) || !isPlain(overrides)) return overrides;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) continue;
    out[k] = isPlain(v) && isPlain(defaults[k]) ? mergeConfig(defaults[k], v) : v;
  }
  return out;
}

export async function loadConfig(query) {
  const { rows } = await query('SELECT data FROM config WHERE id = 1');
  return rows.length ? mergeConfig(DEFAULT_CONFIG, rows[0].data) : DEFAULT_CONFIG;
}

export async function saveConfig(query, data) {
  const merged = validateConfig(mergeConfig(DEFAULT_CONFIG, data));
  await query(
    `INSERT INTO config (id, data, updated_at) VALUES (1, $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [JSON.stringify(data)],
  );
  return merged;
}
