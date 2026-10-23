"use client";

import { useMemo, useState } from "react";
import { Field, Input, Select } from "./Field";
import Term from "./Term";
import { api } from "./api";
import { makeT } from "./i18n";
import { stateList, stateName, validateGSTIN } from "@/lib/gst";

const GSTIN_REASON = { length: "core.cust.gstin_length", pattern: "core.cust.gstin_pattern", check_digit: "core.cust.gstin_check", state_code: "core.cust.gstin_state" };

// Add or edit a customer. GSTIN is checked as you type (pattern + check digit) and the state comes from its first two digits.
export default function CustomerForm({ lang, initial, onSaved, onCancel, submitLabel }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const [v, setV] = useState({
    name: initial?.name ?? "",
    gstin: initial?.gstin ?? "",
    state_code: initial?.state_code ?? "",
    address: initial?.address ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    credit_days: initial?.credit_days ?? "",
    preferred_lang: initial?.preferred_lang ?? "en",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const g = v.gstin.trim() ? validateGSTIN(v.gstin) : null;
  const gstinMsg = g && !g.valid && v.gstin.trim().length >= 15 ? T(GSTIN_REASON[g.reason] ?? "core.cust.gstin_check") : "";
  const derivedState = g?.valid ? g.state_code : null;

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!v.name.trim()) errs.name = T("core.cust.name_required");
    if (v.gstin.trim() && !g?.valid) errs.gstin = T(GSTIN_REASON[g?.reason] ?? "core.cust.gstin_check");
    if (!v.gstin.trim() && !v.state_code) errs.state_code = T("core.cust.state_required");
    const cd = String(v.credit_days).trim();
    if (cd && !(/^\d{1,3}$/.test(cd) && Number(cd) <= 45)) errs.credit_days = T("core.cust.credit_invalid");
    if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errs.email = T("core.cust.email_invalid");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError("");
    const body = {
      name: v.name.trim(),
      gstin: v.gstin.trim() || null,
      state_code: derivedState ?? (v.state_code || null),
      address: v.address.trim() || null,
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
      credit_days: cd ? Number(cd) : null,
      preferred_lang: v.preferred_lang,
    };
    try {
      const saved = await api(initial?.id ? `/api/customers/${initial.id}` : "/api/customers", { method: initial?.id ? "PATCH" : "POST", body });
      onSaved?.(saved);
    } catch (err) {
      setFormError(err.code === "network" ? T("error.network") : err.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="c-name" label={T("core.cust.name")} error={errors.name}>
        <Input id="c-name" value={v.name} onChange={set("name")} error={errors.name} autoComplete="organization" required />
      </Field>
      <Field
        id="c-gstin"
        label={T("field.gstin")}
        hint={g?.valid ? T("new_invoice.gstin_valid", { state: `${stateName(g.state_code, T.lang)} (${g.state_code})` }) : T("core.cust.gstin_hint")}
        error={errors.gstin || gstinMsg}
      >
        <Input id="c-gstin" value={v.gstin} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} maxLength={15} autoCapitalize="characters" spellCheck={false} className="mono uppercase" error={errors.gstin || gstinMsg} hint="1" />
      </Field>
      <Field id="c-state" label={T("field.state")} hint={derivedState ? T("core.cust.state_from_gstin") : T("core.cust.state_hint")} error={errors.state_code}>
        <Select id="c-state" value={derivedState ?? v.state_code} onChange={set("state_code")} disabled={!!derivedState} error={errors.state_code} hint="1">
          <option value="">{T("core.cust.pick_state")}</option>
          {stateList(T.lang).map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </Select>
      </Field>
      <Field id="c-address" label={T("field.address")}>
        <Input id="c-address" value={v.address} onChange={set("address")} autoComplete="street-address" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-email" label={T("field.email")} error={errors.email}>
          <Input id="c-email" type="email" value={v.email} onChange={set("email")} error={errors.email} autoComplete="email" />
        </Field>
        <Field id="c-phone" label={T("field.phone")}>
          <Input id="c-phone" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" />
        </Field>
      </div>
      <Field id="c-credit" label={T("core.cust.credit_days")} labelExtra={<Term {...T.term("core.cust.credit_days")} iconOnly />} hint={T("core.cust.credit_hint")} error={errors.credit_days}>
        <Input id="c-credit" inputMode="numeric" value={v.credit_days} onChange={set("credit_days")} error={errors.credit_days} hint="1" placeholder="15" />
      </Field>
      <Field id="c-lang" label={T("field.lang")} hint={T("core.cust.lang_hint")}>
        <Select id="c-lang" value={v.preferred_lang} onChange={set("preferred_lang")} hint="1">
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
        </Select>
      </Field>
      {formError && <p role="alert" className="rounded-xl bg-error-soft px-3 py-2 font-medium text-error">{formError}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60">
          {busy ? T("core.saving") : submitLabel ?? T("btn.save")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-line px-5 font-semibold">
            {T("btn.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
