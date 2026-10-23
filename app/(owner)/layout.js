import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getSessionFromCookies } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard", mobile: true },
  { href: "/invoices", icon: "invoices", label: "Invoices", mobile: true },
  { href: "/invoices/new", icon: "newInvoice", label: "New invoice" },
  { href: "/customers", icon: "customers", label: "Customers" },
  { href: "/followups", icon: "followups", label: "Today's follow-ups", mobile: true },
  { href: "/inbox", icon: "inbox", label: "Inbox" },
  { href: "/payments", icon: "payments", label: "Payments", mobile: true },
  { href: "/forecast", icon: "forecast", label: "Cash forecast" },
  { href: "/chase-first", icon: "chaseFirst", label: "Chase these first" },
  { href: "/documents", icon: "documents", label: "Documents" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default async function OwnerLayout({ children }) {
  if (!getSessionFromCookies(await cookies())) redirect("/login");
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3">
        Skip to content
      </a>
      <Nav items={NAV_ITEMS} brand="FullPay" labels={{ nav: "Main", more: "More", logout: "Log out" }} />
      <main id="main" className="pb-24 lg:pb-0 lg:pl-64">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
      </main>
    </>
  );
}
