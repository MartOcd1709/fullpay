import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, RUNGS, validateConfig, mergeConfig, loadConfig, saveConfig } from '../lib/config.js';

const clone = (v) => structuredClone(v);

// GSTIN check digit: weights alternate 1,2 over the first 14 chars; sum += floor(p/36) + p%36; check = (36 - sum%36) % 36.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function gstinCheckDigit(gstin) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = ALPHABET.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36];
}

describe('DEFAULT_CONFIG', () => {
  test('validates', () => {
    assert.equal(validateConfig(DEFAULT_CONFIG), DEFAULT_CONFIG);
  });

  test('is deeply frozen', () => {
    assert.ok(Object.isFrozen(DEFAULT_CONFIG.rbi_bank_rate.series));
    assert.throws(() => {
      DEFAULT_CONFIG.demo.offset_days = 3;
    });
  });

  test('business GSTIN is a made-up Punjab GSTIN with a valid check digit', () => {
    const { gstin, state_code } = DEFAULT_CONFIG.business;
    assert.match(gstin, /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/);
    assert.equal(gstin.slice(0, 2), state_code);
    assert.equal(gstin[14], gstinCheckDigit(gstin));
    const flipped = gstin.slice(0, 5) + (gstin[5] === 'A' ? 'B' : 'A') + gstin.slice(6);
    assert.notEqual(flipped[14], gstinCheckDigit(flipped));
  });

  test('pins the Part D values', () => {
    assert.deepEqual(
      DEFAULT_CONFIG.rbi_bank_rate.series.map((s) => s.bps),
      [675, 650, 625, 575, 550, 575],
    );
    assert.equal(DEFAULT_CONFIG.rbi_bank_rate.series.at(-1).from, '2026-10-07');
    assert.deepEqual(DEFAULT_CONFIG.gst.rates_bps, [0, 25, 150, 300, 500, 1800, 4000]);
    assert.equal(DEFAULT_CONFIG.gst.einvoice_threshold_paise, 5_00_00_000 * 100);
    assert.ok(DEFAULT_CONFIG.business.turnover_paise < DEFAULT_CONFIG.gst.einvoice_threshold_paise);
    assert.deepEqual(DEFAULT_CONFIG.tds.rates_bps, [10, 100, 200, 1000]);
    assert.equal(DEFAULT_CONFIG.odr.bundle_checklist.length, 8);
    assert.deepEqual(Object.keys(DEFAULT_CONFIG.ladder.offsets), RUNGS);
    assert.ok(DEFAULT_CONFIG.messaging.footer_en.length <= 60);
    assert.ok(DEFAULT_CONFIG.messaging.footer_hi.length <= 60);
    assert.equal(DEFAULT_CONFIG.retention.fy_2026_27_until, '2033-12-31');
  });
});

describe('validateConfig', () => {
  const bad = (mutate) => {
    const cfg = clone(DEFAULT_CONFIG);
    mutate(cfg);
    return cfg;
  };

  test('rejects an unsorted RBI series', () => {
    assert.throws(() => validateConfig(bad((c) => c.rbi_bank_rate.series.reverse())), { code: 'CONFIG_INVALID' });
  });

  test('rejects a duplicate from-date, a float bps and a malformed date', () => {
    assert.throws(() => validateConfig(bad((c) => (c.rbi_bank_rate.series[1].from = '2023-02-08'))), { code: 'CONFIG_INVALID' });
    assert.throws(() => validateConfig(bad((c) => (c.rbi_bank_rate.series[0].bps = 6.75))), { code: 'CONFIG_INVALID' });
    assert.throws(() => validateConfig(bad((c) => (c.rbi_bank_rate.series[0].from = '08-02-2023'))), { code: 'CONFIG_INVALID' });
    assert.throws(() => validateConfig(bad((c) => (c.rbi_bank_rate.series = []))), { code: 'CONFIG_INVALID' });
  });

  test('rejects non-integer rate arrays', () => {
    assert.throws(() => validateConfig(bad((c) => c.gst.rates_bps.push('18'))), /gst.rates_bps/);
    assert.throws(() => validateConfig(bad((c) => (c.gst.rates_bps[1] = 2.5))), { code: 'CONFIG_INVALID' });
    assert.throws(() => validateConfig(bad((c) => (c.tds.rates_bps = '10,100'))), { code: 'CONFIG_INVALID' });
  });

  test('rejects ladder offsets that are not ascending or not integers', () => {
    assert.throws(() => validateConfig(bad((c) => (c.ladder.offsets.overdue_firm = 7))), /ascending/);
    assert.throws(() => validateConfig(bad((c) => (c.ladder.offsets.due_date = 0.5))), { code: 'CONFIG_INVALID' });
    assert.throws(() => validateConfig(bad((c) => delete c.ladder.offsets.odr_guidance)), { code: 'CONFIG_INVALID' });
    assert.throws(() => validateConfig(bad((c) => c.ladder.auto_rungs.push('letter'))), { code: 'CONFIG_INVALID' });
  });

  test('rejects non-integer money and day values', () => {
    assert.throws(() => validateConfig(bad((c) => (c.forecast.buffer_paise = 150000.5))), /forecast.buffer_paise/);
    assert.throws(() => validateConfig(bad((c) => (c.letter.deadline_days = '7'))), /letter.deadline_days/);
    assert.throws(() => validateConfig(bad((c) => (c.ui.lang = 'mr'))), /ui.lang/);
  });

  test('error carries code and message', () => {
    try {
      validateConfig({});
      assert.fail('should throw');
    } catch (e) {
      assert.equal(e.code, 'CONFIG_INVALID');
      assert.equal(typeof e.message, 'string');
      assert.ok(e.message.length > 0);
    }
  });
});

describe('mergeConfig', () => {
  test('deep-merges plain objects and leaves the defaults untouched', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { business: { name: 'Sharma Packaging' }, ladder: { offsets: { overdue_gentle: 5 } } });
    assert.equal(merged.business.name, 'Sharma Packaging');
    assert.equal(merged.business.gstin, DEFAULT_CONFIG.business.gstin);
    assert.equal(merged.ladder.offsets.overdue_gentle, 5);
    assert.equal(merged.ladder.offsets.overdue_firm, 15);
    assert.deepEqual(merged.ladder.auto_rungs, ['heads_up', 'due_date']);
    assert.equal(DEFAULT_CONFIG.business.name, 'Arora Auto Components');
    assert.equal(DEFAULT_CONFIG.ladder.offsets.overdue_gentle, 7);
    assert.equal(validateConfig(merged), merged);
  });

  test('arrays and scalars are replaced, null replaces, undefined is ignored', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      gst: { rates_bps: [0, 500, 1800] },
      business: { logo_url: 'https://example.in/logo.png', vpa: undefined, bank: null },
    });
    assert.deepEqual(merged.gst.rates_bps, [0, 500, 1800]);
    assert.equal(merged.gst.hsn_digits.upto_5cr, 4);
    assert.equal(merged.business.logo_url, 'https://example.in/logo.png');
    assert.equal(merged.business.vpa, DEFAULT_CONFIG.business.vpa);
    assert.equal(merged.business.bank, null);
  });

  test('empty or missing overrides return the defaults', () => {
    assert.deepEqual(mergeConfig(DEFAULT_CONFIG, {}), DEFAULT_CONFIG);
    assert.equal(mergeConfig(DEFAULT_CONFIG, null), DEFAULT_CONFIG);
    assert.equal(mergeConfig(DEFAULT_CONFIG, undefined), DEFAULT_CONFIG);
  });

  test('adds keys that are not in the defaults', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { experimental: { flag: true } });
    assert.equal(merged.experimental.flag, true);
  });
});

describe('loadConfig / saveConfig', () => {
  test('loadConfig returns the defaults when the row is missing', async () => {
    const query = async () => ({ rows: [] });
    assert.equal(await loadConfig(query), DEFAULT_CONFIG);
  });

  test('loadConfig merges the stored row over the defaults', async () => {
    const calls = [];
    const query = async (text) => {
      calls.push(text);
      return { rows: [{ data: { business: { name: 'Sharma Packaging' }, demo: { offset_days: 4 } } }] };
    };
    const cfg = await loadConfig(query);
    assert.match(calls[0], /SELECT data FROM config WHERE id = 1/);
    assert.equal(cfg.business.name, 'Sharma Packaging');
    assert.equal(cfg.demo.offset_days, 4);
    assert.equal(cfg.letter.deadline_days, 7);
  });

  test('saveConfig validates, then upserts id = 1 as JSON text', async () => {
    const calls = [];
    const query = async (text, params) => {
      calls.push({ text, params });
      return { rows: [] };
    };
    const data = { business: { name: 'Sharma Packaging' } };
    const merged = await saveConfig(query, data);
    assert.equal(merged.business.name, 'Sharma Packaging');
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /INSERT INTO config/);
    assert.match(calls[0].text, /ON CONFLICT \(id\) DO UPDATE/);
    assert.deepEqual(JSON.parse(calls[0].params[0]), data);
  });

  test('saveConfig refuses an invalid config before touching the database', async () => {
    let touched = false;
    const query = async () => {
      touched = true;
      return { rows: [] };
    };
    await assert.rejects(saveConfig(query, { ladder: { offsets: { heads_up: 10 } } }), { code: 'CONFIG_INVALID' });
    assert.equal(touched, false);
  });
});
