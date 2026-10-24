import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE_NAMES, RUNG_TEMPLATE, render, renderWhatsAppText } from '../lib/templates.js';
import { DEFAULT_CONFIG } from '../lib/config.js';
import { t, tHint, LANGS, keys } from '../lib/i18n.js';
import en from '../lib/i18n/en.json' with { type: 'json' };
import hi from '../lib/i18n/hi.json' with { type: 'json' };

const vars = {
  customer_name: 'Mehta & Sons Pvt Ltd',
  business_name: 'Arora Auto Components',
  invoice_numbers: 'INV/26-27/0042',
  amount: '₹1,18,000',
  due_date: '15 Oct 2026',
  days_overdue: 7,
  pay_link: 'https://fullpay.onrender.com/pay/abcdefghijklmnopqrstuv',
  verify_link: 'https://fullpay.onrender.com/verify/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  contact: 'Harpreet Arora, +91 98XXXXXXXX, owner@example.in',
  // the receipt's own values
  amount_received: '₹1,18,000',
  paid_on: '22 Oct 2026',
  ref_part: ' (reference NEFT W18)',
  balance_line: 'Your invoice is now fully paid.',
  receipt_no: 'RCPT-000042',
};

const DEVANAGARI = /[ऀ-ॿ]/;
const THREATS = /legal|lawyer|court|notice|police|कानूनी|वकील|अदालत|नोटिस|पुलिस/i;
const { messaging } = DEFAULT_CONFIG;

describe('templates', () => {
  test('seven template names (five ladder steps, the festival settlement request, the payment receipt) and the rung map', () => {
    assert.equal(TEMPLATE_NAMES.length, 7);
    assert.deepEqual(Object.keys(RUNG_TEMPLATE), ['heads_up', 'due_date', 'overdue_gentle', 'overdue_firm', 'festival', 'payment_received']);
    for (const name of Object.values(RUNG_TEMPLATE)) assert.ok(TEMPLATE_NAMES.includes(name));
  });

  test('footers are 60 characters or fewer', () => {
    assert.ok(messaging.footer_en.length <= 60, messaging.footer_en);
    assert.ok(messaging.footer_hi.length <= 60, messaging.footer_hi);
    assert.ok(messaging.stop_line_en.length <= 60);
    assert.ok(messaging.stop_line_hi.length <= 60);
  });

  for (const lang of LANGS) {
    for (const name of TEMPLATE_NAMES) {
      test(`${name} renders in ${lang}`, () => {
        const { subject, body, sms } = render(name, lang, vars);
        for (const s of [subject, body, sms]) {
          assert.equal(typeof s, 'string');
          assert.ok(s.length > 0);
          assert.ok(!s.includes('{{'), `leftover placeholder in ${s}`);
          assert.ok(!s.includes('}}'));
          assert.doesNotMatch(s, THREATS, `threatening word in ${s}`);
        }
        // A receipt asks for nothing, so it has no "reply STOP" line; every message keeps the safety footer.
        const ending = name === 'payment_received' ? messaging[`footer_${lang}`] : `${messaging[`stop_line_${lang}`]}\n${messaging[`footer_${lang}`]}`;
        assert.ok(body.endsWith(ending), body);
        if (name === 'payment_received') assert.ok(!body.includes(messaging[`stop_line_${lang}`]));
        assert.ok(body.length <= 1024, `WhatsApp body too long: ${body.length}`);
        assert.ok(sms.length < 160, `sms ${sms.length} chars: ${sms}`);
        assert.ok(body.includes(vars.pay_link));
        assert.ok(body.includes(vars.verify_link));
        assert.ok(body.includes(vars.contact));
        assert.ok(body.includes(vars.customer_name));
        if (lang === 'hi') {
          assert.match(body, DEVANAGARI);
          assert.match(subject, DEVANAGARI);
          assert.match(sms, DEVANAGARI);
        }
      });

      test(`${name} ${lang} body neither starts nor ends with a variable`, () => {
        const marked = Object.fromEntries(Object.keys(vars).map((k) => [k, `«${k}»`]));
        const { body } = render(name, lang, marked);
        assert.ok(!body.startsWith('«'), body.slice(0, 40));
        assert.ok(!body.endsWith('»'), body.slice(-40));
      });
    }
  }

  test('the payment receipt states amount, date, reference, balance and receipt number, and asks for no payment', () => {
    for (const lang of LANGS) {
      const { subject, body, sms } = render('payment_received', lang, vars);
      for (const v of [vars.amount_received, vars.paid_on, vars.receipt_no, 'NEFT W18', vars.balance_line]) assert.ok(body.includes(v), `${lang} body lacks ${v}`);
      assert.ok(subject.includes(vars.receipt_no) && sms.includes(vars.receipt_no));
    }
    assert.doesNotMatch(render('payment_received', 'en', vars).body, /please pay|overdue|reminder/i);
  });

  test('overdue templates use days_overdue and the tone steps up without threats', () => {
    const gentle = render('payment_overdue', 'en', vars);
    const firm = render('payment_overdue_final', 'en', vars);
    assert.ok(gentle.body.includes('7 days late'));
    assert.ok(firm.body.includes('7 days overdue'));
    assert.match(firm.subject, /^Final reminder/);
    assert.ok(!gentle.subject.toLowerCase().includes('final'));
  });

  test('renderWhatsAppText is the body only', () => {
    assert.equal(renderWhatsAppText('payment_due_soon', 'hi', vars), render('payment_due_soon', 'hi', vars).body);
  });

  test('messaging overrides replace the stop line and footer', () => {
    const custom = { ...messaging, footer_en: 'Custom footer.', stop_line_en: 'Reply STOP.' };
    const { body } = render('payment_due_today', 'en', vars, custom);
    assert.ok(body.endsWith('Reply STOP.\nCustom footer.'));
  });

  test('unknown language falls back to English; unknown template throws', () => {
    assert.equal(render('invoice_sent', 'mr', vars).body, render('invoice_sent', 'en', vars).body);
    assert.throws(() => render('legal_notice', 'en', vars), { code: 'TEMPLATE_UNKNOWN' });
  });
});

describe('i18n', () => {
  test('every en key exists in hi, and vice versa, with the same shape', () => {
    const enKeys = Object.keys(en);
    const hiKeys = Object.keys(hi);
    assert.deepEqual(hiKeys.filter((k) => !(k in en)), []);
    assert.deepEqual(enKeys.filter((k) => !(k in hi)), []);
    for (const k of enKeys) {
      assert.equal(typeof en[k], typeof hi[k], k);
      if (typeof en[k] === 'object') {
        assert.ok(en[k].label && en[k].hint, k);
        assert.ok(hi[k].label && hi[k].hint, k);
      } else {
        assert.ok(en[k].length > 0 && hi[k].length > 0, k);
      }
    }
    assert.deepEqual(keys, enKeys);
    assert.ok(keys.length >= 150, `only ${keys.length} keys`);
  });

  test('placeholders match between languages', () => {
    const ph = (v) => [...(typeof v === 'string' ? v : v.label).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of keys) assert.deepEqual(ph(hi[k]), ph(en[k]), k);
  });

  test('Hindi strings are in Devanagari', () => {
    const labels = keys.map((k) => (typeof hi[k] === 'string' ? hi[k] : hi[k].label));
    const devanagari = labels.filter((s) => DEVANAGARI.test(s)).length;
    assert.ok(devanagari / labels.length > 0.9, `${devanagari}/${labels.length}`);
    assert.equal(t('dashboard.receivables', 'hi'), 'बकाया रकम');
    assert.equal(tHint('dashboard.receivables', 'hi'), 'प्राप्य');
    assert.equal(t('print.tax_invoice', 'hi'), 'कर बीजक');
    assert.equal(t('print.bill_of_supply', 'hi'), 'आपूर्ति का बिल');
    assert.equal(t('print.due_date', 'hi'), 'भुगतान की तारीख');
    assert.equal(t('print.amount_due', 'hi'), 'देय रकम');
    assert.equal(t('print.outstanding', 'hi'), 'बकाया');
    assert.equal(t('print.overdue', 'hi'), 'अतिदेय');
    assert.equal(t('print.interest', 'hi'), 'ब्याज');
    assert.equal(t('print.demand_letter', 'hi'), 'मांग पत्र');
  });

  test('label/hint pairs: plain words with the accounting term as the hint', () => {
    assert.equal(t('dashboard.receivables'), 'Money to collect');
    assert.equal(tHint('dashboard.receivables'), 'Receivables');
    assert.equal(tHint('status.paid'), '');
  });

  test('interpolation', () => {
    assert.equal(t('pay.title', 'en', { business: 'Sharma Packaging' }), 'Invoice from Sharma Packaging');
    assert.equal(t('pay.title', 'hi', { business: 'Sharma Packaging' }), 'Sharma Packaging का बिल');
    assert.equal(t('common.days', 'en', { n: 0 }), '0 days');
    assert.equal(t('common.days', 'en'), '{n} days');
  });

  test('fallback: unknown language uses English, unknown key returns the key', () => {
    assert.equal(t('nav.invoices', 'mr'), 'Invoices');
    assert.equal(tHint('dashboard.receivables', 'mr'), 'Receivables');
    assert.equal(t('does.not.exist', 'hi'), 'does.not.exist');
    assert.equal(tHint('does.not.exist'), '');
  });

  test('the pack-mandated fixed lines', () => {
    assert.equal(t('letter.title'), 'Payment Demand Letter');
    assert.equal(
      t('letter.disclaimer', 'en', { business: 'Sharma Packaging' }),
      'This letter is from Sharma Packaging about money owed for the invoices listed below. It is not a notice from the GST department and not a legal notice from a lawyer.',
    );
    assert.equal(t('letter.confirm_receipt'), 'Please confirm receipt.');
    assert.equal(t('odr.portal'), 'MSME ODR portal (formerly Samadhaan)');
    assert.equal(t('print.composition_note'), 'Composition taxable person, not eligible to collect tax on supplies');
    for (const l of 'abcdefgh') assert.ok(t(`bundle.item_${l}`).length > 0);
    assert.deepEqual(LANGS, ['en', 'hi']);
  });
});
