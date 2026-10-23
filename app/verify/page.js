import { redirect } from "next/navigation";
import Shell from "@/components/public/Shell";
import Icon from "@/components/public/Icon";
import { VerifyHow } from "@/components/public/VerifyResult";
import { getLang, tr } from "@/components/public/lang";

export const metadata = { title: "Verify a record" };

// Type or paste the code printed under a FullPay QR (16 or 64 characters).
export default async function VerifyHome({ searchParams }) {
  const code = String((await searchParams)?.code ?? "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (code) redirect(code.length === 64 ? `/verify/${code}` : `/v/${code}`);
  const lang = await getLang();
  const t = tr(lang);
  return (
    <Shell lang={lang} footer={<VerifyHow t={t} />}>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Icon name="shieldCheck" className="h-7 w-7 text-accent" />{t("verify.title")}</h1>
        <p className="mt-2 text-ink-muted">{t("public.verify.intro")}</p>
        <form method="get" action="/verify" className="mt-4">
          <label htmlFor="code" className="label">{t("public.verify.code_label")}</label>
          <input id="code" name="code" required minLength={16} maxLength={80} autoComplete="off" spellCheck={false} className="field font-mono" aria-describedby="code-hint" />
          <p id="code-hint" className="mt-1 text-ink-muted">{t("public.verify.code_hint")}</p>
          <button type="submit" className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong sm:w-auto">{t("public.verify.check")}</button>
        </form>
      </section>
    </Shell>
  );
}
