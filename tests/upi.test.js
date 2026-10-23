import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { upiString, qrDataUrl, qrSvg } from '../lib/upi.js';

const base = { pa: 'aroraauto@okhdfcbank', pn: 'Arora Auto Components', am_paise: 1180000, tn: 'INV/26-27/0042' };

describe('upiString', () => {
  test('exact string for a known input', () => {
    assert.equal(
      upiString(base),
      'upi://pay?pa=aroraauto@okhdfcbank&pn=Arora%20Auto%20Components&am=11800.00&cu=INR&tn=INV%2F26-27%2F0042',
    );
  });

  test('encodes spaces as %20 (never +) and an ampersand as %26', () => {
    const s = upiString({ ...base, pn: 'Mehta & Sons' });
    assert.ok(s.includes('pn=Mehta%20%26%20Sons'));
    assert.ok(!s.includes('+'));
  });

  test('am is rupees with two decimals from integer paise', () => {
    assert.ok(upiString({ ...base, am_paise: 1180000 }).includes('am=11800.00'));
    assert.ok(upiString({ ...base, am_paise: 123450 }).includes('am=1234.50'));
    assert.ok(upiString({ ...base, am_paise: 5 }).includes('am=0.05'));
    assert.ok(upiString({ ...base, am_paise: 0 }).includes('am=0.00'));
    assert.ok(upiString({ ...base, am_paise: 9007199254740991 }).includes('am=90071992547409.91'));
  });

  test('rejects floats, negatives and non-numbers for am_paise', () => {
    for (const am_paise of [11800.5, -1, '1180000', null, undefined, NaN]) {
      assert.throws(() => upiString({ ...base, am_paise }), { code: 'UPI_AMOUNT_INVALID' });
    }
  });

  test('tn keeps only [A-Za-z0-9 /-], collapses spaces and is cut at 50 chars', () => {
    const s = upiString({ ...base, tn: 'INV/26-27/0042, INV/26-27/0043 & INV/26-27/0044 (part) #1 ₹' });
    const tn = decodeURIComponent(new URL(s).searchParams.get('tn'));
    assert.match(tn, /^[A-Za-z0-9 /-]+$/);
    assert.ok(tn.length <= 50);
    assert.equal(tn, 'INV/26-27/0042 INV/26-27/0043 INV/26-27/0044 part');
  });

  test('tn is omitted when empty and cu defaults to INR', () => {
    const s = upiString({ pa: 'x@upi', pn: 'X', am_paise: 100 });
    assert.equal(s, 'upi://pay?pa=x@upi&pn=X&am=1.00&cu=INR');
    assert.ok(!s.includes('tn='));
  });

  test('requires pa and pn', () => {
    assert.throws(() => upiString({ pn: 'X', am_paise: 100 }), { code: 'UPI_PARAMS_INVALID' });
    assert.throws(() => upiString({ pa: 'x@upi', am_paise: 100 }), { code: 'UPI_PARAMS_INVALID' });
  });
});

describe('QR renderers', () => {
  test('qrSvg returns an <svg string', async () => {
    const svg = await qrSvg(upiString(base));
    assert.equal(typeof svg, 'string');
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('</svg>'));
  });

  test('qrDataUrl returns a PNG data URL', async () => {
    const url = await qrDataUrl(upiString(base), { size: 120 });
    assert.ok(url.startsWith('data:image/png;base64,'));
    const bytes = Buffer.from(url.slice('data:image/png;base64,'.length), 'base64');
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  });
});
