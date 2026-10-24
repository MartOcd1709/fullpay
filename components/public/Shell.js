import Link from "next/link";
import LangToggle from "./LangToggle";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Logo from "@/components/ui/Logo";
import { tr } from "./lang";

// Public page frame: brand, language switch, one centred column, honest footer. No owner navigation, no third-party scripts.
export default function Shell({ lang, children, wide = false, brandHref = "/", footer }) {
  const t = tr(lang);
  return (
    <div lang={lang} className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex w-full items-center justify-between gap-3 px-4 py-2 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
          {brandHref ? (
            <Link href={brandHref} className="inline-flex min-h-12 items-center no-underline">
              <Logo className="h-7 w-auto sm:h-8" alt={t("app.name")} />
            </Link>
          ) : (
            <Logo className="h-7 w-auto sm:h-8" alt={t("app.name")} />
          )}
          <div className="flex items-center gap-2">
            <ThemeToggle label={t("settings.theme")} />
            <LangToggle lang={lang} label={t("public.lang_label")} />
          </div>
        </div>
      </header>
      <main id="main" className={`mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>
      {footer && (
        <footer className="border-t border-line bg-surface">
          <div className={`mx-auto w-full px-4 py-4 text-ink-muted ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{footer}</div>
        </footer>
      )}
    </div>
  );
}
