import { DEFAULT_CONFIG } from './config.js';

export const TEMPLATE_NAMES = ['invoice_sent', 'payment_due_soon', 'payment_due_today', 'payment_overdue', 'payment_overdue_final', 'festival_settlement', 'payment_received'];

export const RUNG_TEMPLATE = {
  heads_up: 'payment_due_soon',
  due_date: 'payment_due_today',
  overdue_gentle: 'payment_overdue',
  overdue_firm: 'payment_overdue_final',
  festival: 'festival_settlement', // the owner's settlement drive before a festival; never a ladder step
  payment_received: 'payment_received', // the thank-you receipt when a payment is confirmed; never a reminder
};

const GREETING = { en: 'Dear {{customer_name}},', hi: 'नमस्ते {{customer_name}} जी,' };

const LINKS = {
  en: ['Pay or view the invoice: {{pay_link}}', 'Check this message is genuine: {{verify_link}}', 'Questions? Contact {{contact}}'],
  hi: ['भुगतान करें या बिल देखें: {{pay_link}}', 'यह संदेश असली है, यहाँ जाँचें: {{verify_link}}', 'कोई सवाल हो तो संपर्क करें: {{contact}}'],
};

const TEMPLATES = {
  festival_settlement: {
    en: {
      subject: 'Settling accounts before {{festival}}: {{amount}} with {{business_name}}',
      lines: [
        'With {{festival}} coming up, we are settling our accounts before {{festival_eve}}, as is the tradition.',
        'Your open balance with {{business_name}} is {{amount}} on invoice {{invoice_numbers}}. If you can, please clear it by {{settle_by}} using the link below, so we can both begin the new year with a clean khata.',
        'If anything looks wrong, tell us through the same link and we will sort it out before the festival.',
        'Wishing you and your family a very happy {{festival}}!',
      ],
      sms: '{{business_name}}: happy {{festival}}! Open balance {{amount}} ({{invoice_numbers}}). Please clear by {{settle_by}}: {{pay_link}}',
    },
    hi: {
      subject: '{{festival}} से पहले हिसाब: {{business_name}} के साथ {{amount}}',
      lines: [
        '{{festival}} आने वाली है, और परंपरा के अनुसार हम {{festival_eve}} से पहले अपना हिसाब साफ़ कर रहे हैं।',
        '{{business_name}} के साथ आपका खुला बकाया {{amount}} है (बिल {{invoice_numbers}})। हो सके तो {{settle_by}} तक नीचे दिए लिंक से चुका दें, ताकि नए साल की शुरुआत साफ़ खाते से हो।',
        'अगर कुछ ठीक न लगे, तो उसी लिंक से बताएँ, हम त्योहार से पहले ठीक कर देंगे।',
        'आपको और आपके परिवार को {{festival}} की हार्दिक शुभकामनाएँ!',
      ],
      sms: '{{business_name}}: {{festival}} की शुभकामनाएँ! बकाया {{amount}} ({{invoice_numbers}}), {{settle_by}} तक: {{pay_link}}',
    },
  },
  invoice_sent: {
    en: {
      subject: 'Invoice {{invoice_numbers}} from {{business_name}}: {{amount}}, due {{due_date}}',
      lines: [
        'Thank you for your business. Here is invoice {{invoice_numbers}} from {{business_name}}: {{amount}}, due on {{due_date}}.',
        'You can pay by UPI or bank transfer using the link below.',
      ],
      sms: '{{business_name}}: invoice {{invoice_numbers}} for {{amount}}, due {{due_date}}. View/pay: {{pay_link}}',
    },
    hi: {
      subject: '{{business_name}} का बीजक {{invoice_numbers}}: {{amount}}, भुगतान की तारीख {{due_date}}',
      lines: [
        'आपके कारोबार के लिए धन्यवाद। {{business_name}} का बिल {{invoice_numbers}} यह रहा: रकम {{amount}}, भुगतान की तारीख {{due_date}}।',
        'नीचे दिए लिंक से UPI या बैंक ट्रांसफर से भुगतान कर सकते हैं।',
      ],
      sms: '{{business_name}}: बिल {{invoice_numbers}}, रकम {{amount}}, तारीख {{due_date}}। देखें/भुगतान: {{pay_link}}',
    },
  },
  payment_due_soon: {
    en: {
      subject: 'Heads-up: invoice {{invoice_numbers}} is due on {{due_date}}',
      lines: [
        'A quick heads-up from {{business_name}}: invoice {{invoice_numbers}} for {{amount}} is due on {{due_date}}.',
        'If payment is already on its way, thank you. Please ignore this note.',
      ],
      sms: '{{business_name}}: invoice {{invoice_numbers}} for {{amount}} is due {{due_date}}. Pay: {{pay_link}}',
    },
    hi: {
      subject: 'याद दिलाना: बिल {{invoice_numbers}} की भुगतान तारीख {{due_date}} है',
      lines: [
        '{{business_name}} की ओर से एक छोटी याद: बिल {{invoice_numbers}}, रकम {{amount}}, की भुगतान तारीख {{due_date}} है।',
        'अगर भुगतान पहले ही हो चुका है या रास्ते में है, तो धन्यवाद। इस संदेश को अनदेखा करें।',
      ],
      sms: '{{business_name}}: बिल {{invoice_numbers}}, {{amount}}, तारीख {{due_date}}। भुगतान: {{pay_link}}',
    },
  },
  payment_due_today: {
    en: {
      subject: 'Invoice {{invoice_numbers}} is due today',
      lines: [
        'A reminder from {{business_name}}: invoice {{invoice_numbers}} for {{amount}} is due today, {{due_date}}.',
        'Paying by UPI takes a minute with the link below. If you have already paid, you can tell us there too.',
      ],
      sms: '{{business_name}}: invoice {{invoice_numbers}} for {{amount}} is due today. Pay: {{pay_link}}',
    },
    hi: {
      subject: 'बिल {{invoice_numbers}} का भुगतान आज देना है',
      lines: [
        '{{business_name}} की ओर से याद: बिल {{invoice_numbers}}, रकम {{amount}}, का भुगतान आज, {{due_date}} को देना है।',
        'नीचे दिए लिंक से UPI से भुगतान एक मिनट में हो जाता है। अगर भुगतान हो चुका है, तो वहीं बता दें।',
      ],
      sms: '{{business_name}}: बिल {{invoice_numbers}}, {{amount}}, भुगतान आज। भुगतान: {{pay_link}}',
    },
  },
  payment_overdue: {
    en: {
      subject: 'Payment pending: invoice {{invoice_numbers}} is {{days_overdue}} days past due',
      lines: [
        'Our records at {{business_name}} show invoice {{invoice_numbers}} for {{amount}} was due on {{due_date}} and is now {{days_overdue}} days late.',
        'Please arrange payment this week, or let us know when we can expect it.',
        'If something about the invoice is wrong, tell us through the link below and we will sort it out.',
      ],
      sms: '{{business_name}}: {{amount}} on invoice {{invoice_numbers}} is {{days_overdue}} days overdue. Pay or reply: {{pay_link}}',
    },
    hi: {
      subject: 'बकाया: बिल {{invoice_numbers}} की तारीख {{days_overdue}} दिन पहले बीत गई',
      lines: [
        '{{business_name}} के रिकॉर्ड में बिल {{invoice_numbers}}, रकम {{amount}}, की भुगतान तारीख {{due_date}} थी, जो अब {{days_overdue}} दिन पहले बीत चुकी है।',
        'कृपया इस हफ्ते भुगतान कर दें, या बताएँ कि भुगतान कब तक आ जाएगा।',
        'बिल में कुछ गलत लगे तो नीचे दिए लिंक से बताएँ, हम उसे ठीक कर देंगे।',
      ],
      sms: '{{business_name}}: बिल {{invoice_numbers}} पर {{amount}} बकाया, {{days_overdue}} दिन देर। भुगतान/जवाब: {{pay_link}}',
    },
  },
  payment_overdue_final: {
    en: {
      subject: 'Final reminder: {{amount}} due on invoice {{invoice_numbers}}',
      lines: [
        'This is a final reminder from {{business_name}}. Invoice {{invoice_numbers}} for {{amount}} was due on {{due_date}} and is now {{days_overdue}} days overdue.',
        'Please pay now, or reply with the date by which you will pay.',
        'If you have already paid, please share the payment reference so we can update our records. You are welcome to call us to discuss this.',
      ],
      sms: '{{business_name}}: FINAL reminder. {{amount}} on {{invoice_numbers}} is {{days_overdue}} days overdue. Pay: {{pay_link}}',
    },
    hi: {
      subject: 'आखिरी याद: बिल {{invoice_numbers}} पर {{amount}} बकाया',
      lines: [
        'यह {{business_name}} की ओर से आखिरी याद है। बिल {{invoice_numbers}}, रकम {{amount}}, की भुगतान तारीख {{due_date}} थी; अब {{days_overdue}} दिन बीत चुके हैं।',
        'कृपया अभी भुगतान करें, या वह तारीख बताएँ जब तक भुगतान हो जाएगा।',
        'अगर भुगतान हो चुका है, तो कृपया रेफ़रेंस नंबर भेजें ताकि हम रिकॉर्ड ठीक कर सकें। बात करने के लिए आप हमें कॉल कर सकते हैं।',
      ],
      sms: '{{business_name}}: आखिरी याद। बिल {{invoice_numbers}} पर {{amount}} बकाया, {{days_overdue}} दिन देर। भुगतान: {{pay_link}}',
    },
  },
  // A receipt, not a reminder: its own links and no "reply STOP" line. The receipt number is what both sides write in their books.
  payment_received: {
    links: {
      en: ['View the invoice and payment: {{pay_link}}', 'Check this receipt is genuine: {{verify_link}}', 'Questions? Contact {{contact}}'],
      hi: ['बिल और भुगतान देखें: {{pay_link}}', 'यह रसीद असली है, यहाँ जाँचें: {{verify_link}}', 'कोई सवाल हो तो संपर्क करें: {{contact}}'],
    },
    stop: false,
    en: {
      subject: 'Payment received: {{amount_received}} for invoice {{invoice_numbers}}, receipt {{receipt_no}}',
      lines: [
        'Thank you. {{business_name}} has received your payment of {{amount_received}} on {{paid_on}}{{ref_part}} for invoice {{invoice_numbers}}.',
        '{{balance_line}}',
        'Receipt number: {{receipt_no}}. Please keep it with your records.',
      ],
      sms: '{{business_name}}: received {{amount_received}} on {{paid_on}} for {{invoice_numbers}}. {{balance_line}} Receipt {{receipt_no}}.',
    },
    hi: {
      subject: 'भुगतान मिल गया: बिल {{invoice_numbers}} के {{amount_received}}, रसीद {{receipt_no}}',
      lines: [
        'धन्यवाद। {{business_name}} को आपका {{amount_received}} का भुगतान {{paid_on}} को मिल गया है{{ref_part}}, बिल {{invoice_numbers}} के लिए।',
        '{{balance_line}}',
        'रसीद नंबर: {{receipt_no}}। कृपया इसे अपने रिकॉर्ड में रखें।',
      ],
      sms: '{{business_name}}: {{paid_on}} को {{amount_received}} मिले, बिल {{invoice_numbers}}। {{balance_line}} रसीद {{receipt_no}}।',
    },
  },
};

const fill = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));

const line = (messaging, name, lang) => messaging?.[`${name}_${lang}`] ?? DEFAULT_CONFIG.messaging[`${name}_${lang}`];

export function render(templateName, lang = 'en', vars = {}, messaging = DEFAULT_CONFIG.messaging) {
  const tpl = TEMPLATES[templateName];
  if (!tpl) throw Object.assign(new Error(`unknown template: ${templateName}`), { code: 'TEMPLATE_UNKNOWN' });
  const l = tpl[lang] ? lang : 'en';
  const { subject, lines, sms } = tpl[l];
  const closing = tpl.stop === false ? line(messaging, 'footer', l) : `${line(messaging, 'stop_line', l)}\n${line(messaging, 'footer', l)}`;
  const body = [GREETING[l], lines.join('\n'), (tpl.links?.[l] ?? LINKS[l]).join('\n'), closing].join('\n\n');
  return { subject: fill(subject, vars), body: fill(body, vars), sms: fill(sms, vars) };
}

export function renderWhatsAppText(templateName, lang, vars, messaging) {
  return render(templateName, lang, vars, messaging).body;
}
