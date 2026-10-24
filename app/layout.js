import { cookies } from "next/headers";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-noto-sans",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-noto-devanagari",
  fallback: ["Nirmala UI", "Mangal", "Kohinoor Devanagari", "sans-serif"],
});

export const metadata = {
  title: { default: "FullPay", template: "%s · FullPay" },
  description: "Get paid in full: track invoices, follow up politely, issue GST invoices and Payment Demand Letters, and see a cash shortage weeks ahead.",
  applicationName: "FullPay",
};

const LANGS = new Set(["en", "hi"]);
const TEXT_SIZES = new Set(["md", "lg", "xl"]);
const THEMES = new Set(["light", "dark"]);
const pick = (value, allowed, fallback) => (allowed.has(value) ? value : fallback);

export default async function RootLayout({ children }) {
  const store = await cookies();
  const lang = pick(store.get("lang")?.value, LANGS, "en");
  const textSize = pick(store.get("text_size")?.value, TEXT_SIZES, "md");
  // No explicit cookie means "follow the system": omit data-theme and let the prefers-color-scheme rules in globals.css decide.
  const theme = pick(store.get("theme")?.value, THEMES, undefined);
  return (
    <html lang={lang} data-text-size={textSize} data-theme={theme} className={`${notoSans.variable} ${notoDevanagari.variable} font-sans`}>
      <body>
        {/* SlideIn (components/ui/SlideIn.js) needs JS to reveal its content; without it, show everything plainly. */}
        <noscript>
          <style>{".slide-in{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
