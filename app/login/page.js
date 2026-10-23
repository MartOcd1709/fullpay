"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && /^\/(?!\/)/.test(next) ? next : "/dashboard";
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const password = new FormData(event.currentTarget).get("password");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign(nextPath());
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Could not log in. Try again.");
    } catch {
      setError("Network problem. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm" aria-describedby={error ? "login-error" : undefined}>
        <p className="text-2xl font-bold text-accent">FullPay</p>
        <h1 className="mt-1 text-lg font-semibold">Owner login</h1>
        <p className="mt-1 text-ink-muted">Only the business owner can see customers, invoices and payments.</p>
        <label htmlFor="password" className="label mt-5">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" autoFocus className="field" aria-invalid={error ? "true" : undefined} />
        {error && (
          <p id="login-error" role="alert" className="mt-3 rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{error}</p>
        )}
        <Button type="submit" full className="mt-5" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
      </form>
    </main>
  );
}
