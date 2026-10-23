import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { run } from "@/lib/services/context";
import { getLang, baseUrl } from "@/components/public/lang";
import { t as translate } from "@/lib/i18n";

// Owner-only (proxy.js also guards /print). Loads a view model; unknown or malformed ids become the 404 page.
export async function loadPrint(params, fn) {
  if (!getSessionFromCookies(await cookies())) redirect("/login");
  const { id } = await params;
  if (!/^\d{1,12}$/.test(String(id))) notFound();
  let view;
  try {
    view = await run((c, ctx) => fn(c, ctx, Number(id)));
  } catch (e) {
    if (e?.status === 404) notFound();
    throw e;
  }
  const lang = await getLang();
  const origin = await baseUrl();
  const verifyUrl = (hash) => (hash ? `${origin}/v/${hash.slice(0, 16)}` : null);
  return { view, lang, id: Number(id), verifyUrl };
}

export const toolbarStrings = (lang) => ({
  back: translate("btn.back", lang),
  print: translate("btn.print", lang),
  hint: translate("public.print.toolbar_hint", lang),
});
