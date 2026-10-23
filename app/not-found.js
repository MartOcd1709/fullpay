import Link from "next/link";
import Shell from "@/components/public/Shell";
import { getLang, tr } from "@/components/public/lang";

export const metadata = { title: "Not found", robots: { index: false } };

export default async function NotFound() {
  const lang = await getLang();
  const T = tr(lang);
  const btn = "inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold no-underline";
  return (
    <Shell lang={lang}>
      <section className="py-10">
        <p className="font-semibold text-accent">404</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">{T("public.nf.title")}</h1>
        <p className="mt-3 max-w-xl text-ink-muted">{T("public.nf.body")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className={`${btn} bg-accent text-on-accent hover:bg-accent-strong`}>{T("public.nf.home")}</Link>
          <Link href="/dashboard" className={`${btn} border border-line bg-surface text-ink hover:bg-surface-2`}>{T("public.nf.app")}</Link>
        </div>
      </section>
    </Shell>
  );
}
