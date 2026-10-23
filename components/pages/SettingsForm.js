"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Term from "@/components/ui/Term";
import { Field, Input, Select, Check } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";
import { rupeesToPaise } from "@/lib/money";

const RUNGS = ["heads_up", "due_date", "overdue_gentle", "overdue_firm", "demand_letter", "odr_guidance"];
const AUTO_OK = new Set(["heads_up", "due_date"]);
const rupees = (p) => (Number.isSafeInteger(p) ? String(p / 100) : "");

export default function SettingsForm({ lang, cfg, states }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const b0 = cfg.business ?? {};
  const [b, setB] = useState({
    name: b0.name ?? "", address: b0.address ?? "", city: b0.city ?? "", pin: b0.pin ?? "", state_code: b0.state_code ?? "",
    gstin: b0.gstin ?? "", registration: b0.registration ?? "regular", turnover: rupees(b0.turnover_paise),
    udyam: !!b0.udyam, udyam_number: b0.udyam_number ?? "", udyam_class: b0.udyam_class ?? "small",
    owner_name: b0.owner_name ?? "", email: b0.email ?? "", vpa: b0.vpa ?? "", logo_url: b0.logo_url ?? "",
    bank_name: b0.bank?.name ?? "", account_name: b0.bank?.account_name ?? "", account_last4: b0.bank?.account_last4 ?? "", ifsc: b0.bank?.ifsc ?? "",
  });
  const [offsets, setOffsets] = useState({ ...cfg.ladder?.offsets });
  const [auto, setAuto] = useState(new Set(cfg.ladder?.auto_rungs ?? []));
  const [buffer, setBuffer] = useState(rupees(cfg.forecast?.buffer_paise));
  const [opening, setOpening] = useState(rupees(cfg.forecast?.opening_balance_paise));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setB({ ...b, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setError("");
    let patch;
    try {
      patch = {
        business: {
          name: b.name.trim(), address: b.address.trim(), city: b.city.trim(), pin: b.pin.trim(), state_code: b.state_code,
          gstin: b.gstin.trim() || null, registration: b.registration, turnover_paise: rupeesToPaise(b.turnover || "0"),
          udyam: b.udyam, udyam_number: b.udyam_number.trim() || null, udyam_class: b.udyam_class,
          owner_name: b.owner_name.trim(), email: b.email.trim(), vpa: b.vpa.trim(), logo_url: b.logo_url.trim() || null,
          bank: { name: b.bank_name.trim(), account_name: b.account_name.trim(), account_last4: b.account_last4.trim(), ifsc: b.ifsc.trim() },
        },
        ladder: { offsets: Object.fromEntries(RUNGS.map((r) => [r, Number(offsets[r])])), auto_rungs: RUNGS.filter((r) => auto.has(r)) },
        forecast: { buffer_paise: rupeesToPaise(buffer || "0"), opening_balance_paise: rupeesToPaise(opening || "0") },
      };
    } catch {
      setError(T("core.act.amount_invalid"));
      return;
    }
    setBusy(true);
    try {
      await api("/api/settings", { method: "PATCH", body: patch });
      toast(T("settings.saved"));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4" noValidate>
      <Card title={T("settings.profile")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-name" label={T("pages.set.name")}><Input id="s-name" value={b.name} onChange={set("name")} required /></Field>
          <Field id="s-owner" label={T("pages.set.owner")}><Input id="s-owner" value={b.owner_name} onChange={set("owner_name")} /></Field>
          <Field id="s-addr" label={T("pages.set.address")} className="sm:col-span-2"><Input id="s-addr" value={b.address} onChange={set("address")} /></Field>
          <Field id="s-city" label={T("pages.set.city")}><Input id="s-city" value={b.city} onChange={set("city")} /></Field>
          <Field id="s-pin" label="PIN"><Input id="s-pin" inputMode="numeric" value={b.pin} onChange={set("pin")} /></Field>
          <Field id="s-state" label={T("pages.cust.state")}>
            <Select id="s-state" value={b.state_code} onChange={set("state_code")}>
              {states.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
            </Select>
          </Field>
          <Field id="s-gstin" label={T("pages.set.gstin")}><Input id="s-gstin" className="mono" value={b.gstin} onChange={set("gstin")} /></Field>
          <Field id="s-reg" label={T("settings.registration")}>
            <Select id="s-reg" value={b.registration} onChange={set("registration")}>
              <option value="regular">{T("settings.reg_regular")}</option>
              <option value="composition">{T("settings.reg_composition")}</option>
              <option value="unregistered">{T("settings.reg_unregistered")}</option>
            </Select>
          </Field>
          <Field id="s-turn" label={T.term("settings.turnover").label} labelExtra={<Term {...T.term("settings.turnover")} iconOnly />} hint={T("pages.set.einv_note")}>
            <Input id="s-turn" inputMode="decimal" value={b.turnover} onChange={set("turnover")} />
          </Field>
          <Field id="s-email" label={T("pages.set.email")}><Input id="s-email" type="email" value={b.email} onChange={set("email")} /></Field>
          <Field id="s-logo" label={T("settings.logo")}><Input id="s-logo" type="url" value={b.logo_url} onChange={set("logo_url")} /></Field>
          <div className="sm:col-span-2"><Check id="s-udyam" label={T("settings.udyam")} checked={b.udyam} onChange={set("udyam")} /></div>
          {b.udyam && (
            <>
              <Field id="s-udyam-no" label={T("settings.udyam_number")}><Input id="s-udyam-no" className="mono" value={b.udyam_number} onChange={set("udyam_number")} /></Field>
              <Field id="s-class" label={T("pages.set.udyam_class")}>
                <Select id="s-class" value={b.udyam_class} onChange={set("udyam_class")}>
                  <option value="micro">{T("pages.set.micro")}</option>
                  <option value="small">{T("pages.set.small")}</option>
                  <option value="medium">{T("pages.set.medium")}</option>
                </Select>
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card title={T("settings.bank")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-bank" label={T("pages.set.bank_name")}><Input id="s-bank" value={b.bank_name} onChange={set("bank_name")} /></Field>
          <Field id="s-accname" label={T("pages.set.account_name")}><Input id="s-accname" value={b.account_name} onChange={set("account_name")} /></Field>
          <Field id="s-last4" label={T("pages.set.acc_last4")}><Input id="s-last4" inputMode="numeric" maxLength={4} value={b.account_last4} onChange={set("account_last4")} /></Field>
          <Field id="s-ifsc" label={T("pages.set.ifsc")}><Input id="s-ifsc" className="mono" value={b.ifsc} onChange={set("ifsc")} /></Field>
          <Field id="s-vpa" label={T("settings.vpa")} className="sm:col-span-2"><Input id="s-vpa" className="mono" value={b.vpa} onChange={set("vpa")} /></Field>
        </div>
      </Card>

      <Card title={T("settings.ladder")}>
        <p className="mb-3 text-ink-muted">{T("settings.ladder_hint")}</p>
        <ul className="grid gap-3">
          {RUNGS.map((r) => (
            <li key={r} className="grid items-center gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_8rem_auto]">
              <span className="font-semibold">{T(`rung.${r}`)}</span>
              <span className="flex items-center gap-2">
                <Input id={`s-off-${r}`} aria-label={`${T(`rung.${r}`)} (${T("pages.set.days")})`} inputMode="numeric" value={offsets[r] ?? ""} onChange={(e) => setOffsets({ ...offsets, [r]: e.target.value })} className="w-24" />
                <span className="text-ink-muted">{T("pages.set.days")}</span>
              </span>
              {AUTO_OK.has(r) ? (
                <Check id={`s-auto-${r}`} label={T("settings.auto_send")} checked={auto.has(r)} onChange={(e) => { const n = new Set(auto); e.target.checked ? n.add(r) : n.delete(r); setAuto(n); }} />
              ) : (
                <span className="text-sm text-ink-muted">{T("core.chip.manual")}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={T("nav.forecast")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-buffer" label={T.term("settings.buffer").label} labelExtra={<Term {...T.term("settings.buffer")} iconOnly />}>
            <Input id="s-buffer" inputMode="decimal" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
          </Field>
          <Field id="s-open" label={T("settings.opening_balance")}><Input id="s-open" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
        </div>
      </Card>

      {error && <p role="alert" className="rounded-xl border border-error bg-error-soft px-4 py-3 text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? T("pages.set.saving") : T("pages.set.save")}</Button>
      </div>
    </form>
  );
}

export function DemoControls({ lang, enabled, date }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  async function go(kind, path, body) {
    setBusy(kind);
    try {
      await api(path, { body });
      toast(T("pages.cust.done"));
      router.refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy("");
    }
  }
  if (!enabled) return <p className="text-ink-muted">{T("pages.set.demo_off")}</p>;
  return (
    <div className="grid gap-3">
      <p className="font-semibold">{T("pages.set.demo_now", { date: T.date(date) })}</p>
      <p className="text-ink-muted">{T("settings.demo_hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!!busy} onClick={() => go("1", "/api/demo/advance", { days: 1 })}>{T("pages.set.demo_plus1")}</Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => go("7", "/api/demo/advance", { days: 7 })}>{T("pages.set.demo_plus7")}</Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => go("l", "/api/demo/jump", { to: "letter" })}>{T("pages.set.demo_letter")}</Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => go("o", "/api/demo/jump", { to: "odr" })}>{T("pages.set.demo_odr")}</Button>
        <Button variant="danger" disabled={!!busy} onClick={() => go("r", "/api/demo/reset", { confirm: true })}>{T("pages.set.demo_reset")}</Button>
      </div>
      {busy && <p aria-live="polite" className="text-ink-muted">{T("core.demo.working")}</p>}
    </div>
  );
}
