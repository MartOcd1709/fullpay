import { cookies } from "next/headers";
import { makeT } from "../i18n";

export const LANGS = ["en", "hi"];
// Cookie values match app/layout.js (data-text-size md|lg|xl = 16/18/20 px). Config stores sm|md|lg for the same three steps.
export const TEXT_SIZES = ["md", "lg", "xl"];
export const SIZE_TO_CONFIG = { md: "sm", lg: "md", xl: "lg" };

export async function getLang() {
  const store = await cookies();
  const lang = store.get("lang")?.value;
  return LANGS.includes(lang) ? lang : "en";
}

export async function getTextSize() {
  const v = (await cookies()).get("text_size")?.value;
  return TEXT_SIZES.includes(v) ? v : "md";
}

export async function getT() {
  return makeT(await getLang());
}
