import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import * as settings from "@/lib/services/settings";
import { badRequest } from "@/lib/services/errors";
import { LANGS, TEXT_SIZES, SIZE_TO_CONFIG } from "@/components/ui/server/lang";

const YEAR = 60 * 60 * 24 * 365;

// POST { lang?: 'en'|'hi', text_size?: 'md'|'lg'|'xl' } — sets the cookies app/layout.js reads, and records the choice in config.
export const POST = route(async ({ client, ctx, body }) => {
  const lang = body?.lang;
  const size = body?.text_size;
  if (lang == null && size == null) throw badRequest("validation", "Send lang and/or text_size");
  if (lang != null && !LANGS.includes(lang)) throw badRequest("validation", `lang must be one of ${LANGS.join(", ")}`);
  if (size != null && !TEXT_SIZES.includes(size)) throw badRequest("validation", `text_size must be one of ${TEXT_SIZES.join(", ")}`);
  const ui = {};
  if (lang) ui.lang = lang;
  if (size) ui.text_size = SIZE_TO_CONFIG[size];
  await settings.save(client, ctx, { ui });
  const res = NextResponse.json({ ok: true, lang: lang ?? null, text_size: size ?? null }, { headers: { "cache-control": "no-store" } });
  const opts = { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: false };
  if (lang) res.cookies.set("lang", lang, opts);
  if (size) res.cookies.set("text_size", size, opts);
  return res;
});
