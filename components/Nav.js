"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  dashboard: "M3 11l9-8 9 8M5 10v10h14V10",
  invoices: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6",
  newInvoice: "M6 3h9l4 4v14H6zM15 3v4h4M12 11v6M9 14h6",
  customers: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  followups: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  payments: "M7 4h10M7 9h10M11 4a5 5 0 0 1 0 10H7l7 6",
  forecast: "M3 17l6-6 4 4 8-8M14 7h7v7",
  chaseFirst: "M4 21V4M4 4h12l-1.5 4 1.5 4H4",
  documents: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  settings: "M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

function Icon({ name, className = "h-6 w-6" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] ?? ICONS.more} />
    </svg>
  );
}

function activeHref(items, pathname) {
  let best = "";
  for (const { href } of items) {
    if ((pathname === href || pathname.startsWith(href + "/")) && href.length > best.length) best = href;
  }
  return best;
}

function NavLink({ item, active, compact = false }) {
  const base = compact
    ? "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs font-medium leading-tight no-underline"
    : "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 font-medium no-underline";
  const tone = active ? (compact ? "text-accent" : "bg-accent-soft text-accent") : "text-ink hover:bg-surface-2";
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`${base} ${tone}`}>
      <Icon name={item.icon} className={compact ? "h-6 w-6" : "h-5 w-5"} />
      <span>{item.label}</span>
    </Link>
  );
}

function LogoutForm({ label, className = "" }) {
  return (
    <form method="post" action="/api/auth/logout" className={className}>
      <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 font-medium text-ink hover:bg-surface-2">
        <Icon name="logout" className="h-5 w-5" />
        <span>{label}</span>
      </button>
    </form>
  );
}

export function Nav({ items, brand = "FullPay", labels = {} }) {
  const pathname = usePathname();
  const active = activeHref(items, pathname);
  const { nav = "Main", more = "More", logout = "Log out" } = labels;
  const primary = items.filter((i) => i.mobile).slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface lg:flex print:hidden">
        <Link href="/dashboard" className="px-5 py-5 text-xl font-bold text-accent no-underline">{brand}</Link>
        <nav aria-label={nav} className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.href}><NavLink item={item} active={item.href === active} /></li>
            ))}
          </ul>
        </nav>
        <LogoutForm label={logout} className="border-t border-line p-3" />
      </aside>

      <nav aria-label={nav} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => (
            <li key={item.href}><NavLink item={item} active={item.href === active} compact /></li>
          ))}
          <li className="relative">
            <details key={pathname} className="group">
              <summary className={`flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs font-medium leading-tight [&::-webkit-details-marker]:hidden ${rest.some((i) => i.href === active) ? "text-accent" : "text-ink"}`}>
                <Icon name="more" />
                <span>{more}</span>
              </summary>
              <div className="absolute bottom-full right-2 mb-2 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-line bg-surface p-2 shadow-lg">
                <ul className="max-h-[60dvh] space-y-1 overflow-y-auto">
                  {rest.map((item) => (
                    <li key={item.href}><NavLink item={item} active={item.href === active} /></li>
                  ))}
                </ul>
                <LogoutForm label={logout} className="mt-1 border-t border-line pt-1" />
              </div>
            </details>
          </li>
        </ul>
      </nav>
    </>
  );
}

export default Nav;
