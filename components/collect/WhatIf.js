"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { btn, toPaise, tr } from "./client";

// Three what-if switches. State lives in the URL (?late=&order=&order_week=&supplier=) so the server redraws the forecast
// and the link can be shared.
export default function WhatIf({ lang, customers, weeksN, current, defaultWeek }) {
  const T = tr(lang);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [s, setS] = useState({
    late: current.late != null,
    lateId: String(current.late ?? customers[0]?.id ?? ""),
    order: current.order != null,
    amount: String(current.order ?? 300000),
    week: String(current.order_week ?? defaultWeek),
    supplier: current.supplier != null,
    days: String(current.supplier ?? 14),
  });

  function apply(next) {
    setS(next);
    const q = new URLSearchParams();
    if (next.late && next.lateId) q.set("late", next.lateId);
    const rupees = toPaise(next.amount);
    if (next.order && rupees) {
      q.set("order", String(Math.floor(rupees / 100)));
      q.set("order_week", next.week);
    }
    if (next.supplier) q.set("supplier", next.days);
    start(() => router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false }));
  }
  const on = (k) => (e) => apply({ ...s, [k]: e.target.checked });
  const pick = (k) => (e) => apply({ ...s, [k]: e.target.value });
  const any = s.late || s.order || s.supplier;
  const word = (b) => <span className={`ml-auto shrink-0 text-sm font-semibold ${b ? "text-success" : "text-ink-muted"}`}>{T(b ? "collect.fc.on" : "collect.fc.off")}</span>;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="wi-h" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="wi-h" className="text-lg font-semibold">
          {T("forecast.whatif")}
        </h2>
        <span role="status" className="text-sm text-ink-muted">
          {pending ? T("collect.fc.updating") : any ? T("collect.fc.whatif_on") : T("collect.fc.whatif_off")}
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className={`rounded-lg border p-3 ${s.late ? "border-accent bg-accent-soft" : "border-line"}`}>
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input type="checkbox" checked={s.late} onChange={on("late")} />
            {T("forecast.whatif_late")}
            {word(s.late)}
          </label>
          <label className="label mt-2 text-sm" htmlFor="wi-cust">
            {T("field.customer")}
          </label>
          <select id="wi-cust" className="field" value={s.lateId} onChange={pick("lateId")} disabled={!customers.length}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className={`rounded-lg border p-3 ${s.order ? "border-accent bg-accent-soft" : "border-line"}`}>
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input type="checkbox" checked={s.order} onChange={on("order")} />
            {T("forecast.whatif_order")}
            {word(s.order)}
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="label text-sm" htmlFor="wi-amt">
                {T("collect.fc.order_amount")}
              </label>
              <input
                id="wi-amt"
                className="field tnum"
                inputMode="numeric"
                value={s.amount}
                onChange={(e) => setS({ ...s, amount: e.target.value })}
                onBlur={() => s.order && apply(s)}
                onKeyDown={(e) => e.key === "Enter" && apply({ ...s, order: true })}
              />
            </div>
            <div>
              <label className="label text-sm" htmlFor="wi-week">
                {T("collect.fc.order_week")}
              </label>
              <select id="wi-week" className="field" value={s.week} onChange={pick("week")}>
                {Array.from({ length: weeksN }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {T("collect.promise.week_n", { n: i + 1 })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${s.supplier ? "border-accent bg-accent-soft" : "border-line"}`}>
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input type="checkbox" checked={s.supplier} onChange={on("supplier")} />
            {T("forecast.whatif_supplier")}
            {word(s.supplier)}
          </label>
          <label className="label mt-2 text-sm" htmlFor="wi-days">
            {T("collect.fc.delay_by")}
          </label>
          <select id="wi-days" className="field" value={s.days} onChange={pick("days")}>
            {[7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {T("common.days", { n: d })}
              </option>
            ))}
          </select>
        </div>
      </div>
      {any && (
        <button type="button" className={btn("ghost", "mt-3")} onClick={() => apply({ ...s, late: false, order: false, supplier: false })}>
          {T("collect.fc.reset")}
        </button>
      )}
    </section>
  );
}
