import QRCode from 'qrcode';

const enc = (s) => encodeURIComponent(String(s));

function rupees(paise) {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw Object.assign(new Error('am_paise must be a non-negative integer number of paise'), { code: 'UPI_AMOUNT_INVALID' });
  }
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
}

const cleanNote = (tn) =>
  String(tn ?? '')
    .replace(/[^A-Za-z0-9 /-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
    .trim();

export function upiString({ pa, pn, am_paise, tn, cu = 'INR' }) {
  if (!pa || !pn) throw Object.assign(new Error('pa and pn are required'), { code: 'UPI_PARAMS_INVALID' });
  // '@' stays literal in pa: UPI apps read the raw VPA (NPCI linking spec examples never encode it).
  const parts = [`pa=${enc(pa).replace(/%40/g, '@')}`, `pn=${enc(pn)}`, `am=${rupees(am_paise)}`, `cu=${enc(cu)}`];
  const note = cleanNote(tn);
  if (note) parts.push(`tn=${enc(note)}`);
  return `upi://pay?${parts.join('&')}`;
}

export async function qrDataUrl(text, { size = 180 } = {}) {
  return QRCode.toDataURL(text, { width: size, margin: 1 });
}

export async function qrSvg(text) {
  return QRCode.toString(text, { type: 'svg', margin: 1 });
}
