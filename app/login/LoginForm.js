"use client";

import { useState } from "react";

const BTN = "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 py-2 font-semibold";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && /^\/(?![\/\\])/.test(next) ? next : "/dashboard";
}

export default function LoginForm({ s, demo }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const body = email ? { email, password: form.get("password") } : { password: form.get("password") };
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        window.location.assign(nextPath());
        return;
      }
      const code = (await res.json().catch(() => null))?.error?.code;
      setError(code === "wrong_password" ? s["auth.wrong"] : code === "rate_limited" ? s["auth.too_many"] : s["error.generic"]);
    } catch {
      setError(s["error.network"]);
    }
    setBusy(false);
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={onSubmit} className="rounded-xl border border-line bg-surface p-6 shadow-sm" aria-describedby={error ? "login-error" : undefined}>
        <h1 className="text-2xl font-bold leading-tight">{s["auth.title"]}</h1>
        <p className="mt-1 text-ink-muted">{s["public.login.intro"]}</p>
        <label htmlFor="email" className="label mt-5">{s["public.login.email"]}</label>
        <input id="email" name="email" type="email" autoComplete="username" className="field" aria-describedby="email-hint" />
        <p id="email-hint" className="mt-1 text-sm text-ink-muted">{s["public.login.email_hint"]}</p>
        <label htmlFor="password" className="label mt-4">{s["auth.password"]}</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" autoFocus className="field" aria-invalid={error ? "true" : undefined} />
        {error && <p id="login-error" role="alert" className="mt-3 rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{error}</p>}
        <button type="submit" disabled={busy} className={`${BTN} mt-5 bg-accent text-on-accent hover:bg-accent-strong disabled:opacity-60`}>
          {busy ? s["public.login.busy"] : s["btn.login"]}
        </button>
      </form>
      {demo && (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-surface p-4 text-center">
          <p className="text-ink-muted">{s["public.login.or"]}</p>
          <form method="post" action="/api/auth/demo" className="mt-2 grid gap-2">
            <button type="submit" name="as" value="owner" className={`${BTN} border border-line bg-surface text-accent hover:bg-accent-soft`}>{s["public.landing.open_demo"]}</button>
            <p className="mt-1 text-sm font-semibold text-ink-muted">{s["public.login.as"]}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" name="as" value="accountant" title={s["public.login.as_accountant"]} className={`${BTN} border border-line bg-surface hover:bg-surface-2`}>{s["pages.role.accountant"]}</button>
              <button type="submit" name="as" value="viewer" title={s["public.login.as_viewer"]} className={`${BTN} border border-line bg-surface hover:bg-surface-2`}>{s["pages.role.viewer"]}</button>
            </div>
          </form>
          <p className="mt-2 text-sm text-ink-muted">{s["public.login.demo_hint"]}</p>
        </div>
      )}
    </div>
  );
}
