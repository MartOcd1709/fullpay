import en from './i18n/en.json' with { type: 'json' };
import hi from './i18n/hi.json' with { type: 'json' };

export const LANGS = ['en', 'hi'];

const DICT = { en, hi };

export const keys = Object.keys(en);

const entry = (key, lang) => DICT[lang]?.[key] ?? en[key];

const interpolate = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));

export function t(key, lang = 'en', vars = {}) {
  const e = entry(key, lang);
  const text = e == null ? key : typeof e === 'string' ? e : e.label;
  return interpolate(text, vars);
}

export function tHint(key, lang = 'en') {
  const e = entry(key, lang);
  const hint = e && typeof e === 'object' ? e.hint : undefined;
  return hint ?? (typeof en[key] === 'object' ? en[key].hint ?? '' : '');
}
