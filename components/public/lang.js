// Server-side helpers shared by the public and print pages: language, translator, money and date formatting, base URL.
import { cookies, headers } from "next/headers";
import { t as translate, LANGS } from "@/lib/i18n";
import { fmtINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

const pick = (v) => (LANGS.includes(v) ? v : null);

// The visitor's chosen language (cookie), else the fallback (e.g. the customer's preferred language), else English.
export async function getLang(fallback) {
  const store = await cookies();
  return pick(store.get("lang")?.value) ?? pick(fallback) ?? "en";
}

export const tr = (lang) => (key, vars) => translate(key, lang, vars);

export const inr = (paise, withPaise = true) => (Number.isSafeInteger(paise) ? fmtINR(paise, { paise: withPaise }) : "—");

// Lakh / crore sub-label for hero numbers: "11.72 lakh".
export function lakh(paise, lang) {
  const rupees = Math.abs(paise) / 100;
  if (rupees < 100000) return null;
  const crore = rupees >= 10000000;
  const n = (rupees / (crore ? 10000000 : 100000)).toFixed(2).replace(/\.?0+$/, "");
  return translate(crore ? "public.crore" : "public.lakh", lang, { n });
}

export const day = (iso, lang = "en") => (iso ? formatDate(iso, lang) : "—");

const STAMP = {
  en: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
  hi: new Intl.DateTimeFormat("hi-IN-u-nu-latn", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
};
export const stamp = (ts, lang = "en") => (ts ? `${STAMP[lang === "hi" ? "hi" : "en"].format(new Date(String(ts).replace(" ", "T")))} IST` : "—");

// Absolute origin for QR codes and printed URLs: the request's own host, else APP_URL.
export async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

export const short = (hash) => (hash ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : "");
