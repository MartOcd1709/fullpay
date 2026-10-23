"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Field, Input, Select } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { api } from "@/components/ui/api";
import { makeT } from "@/components/ui/i18n";

const ROLES = ["owner", "accountant", "viewer"];

export function AddMember({ lang }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (!f.password) delete f.password;
    setBusy(true); setErr(null);
    try {
      await api("/api/team", { body: f });
      setOpen(false);
      toast(T("pages.team.added"));
      router.refresh();
    } catch (x) {
      setErr(x.code === "email_taken" ? T("pages.team.email_taken") : x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>{T("pages.team.add")}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={T("pages.team.add")} closeLabel={T("pages.cust.cancel")}>
        <form onSubmit={submit} className="grid gap-4">
          <Field id="tm-name" label={T("pages.team.name")}><Input id="tm-name" name="name" required maxLength={120} /></Field>
          <Field id="tm-email" label={T("pages.team.email")}><Input id="tm-email" name="email" type="email" required maxLength={200} /></Field>
          <Field id="tm-role" label={T("pages.team.role")} hint={T("pages.team.role_hint")}>
            <Select id="tm-role" name="role" defaultValue="accountant">
              {ROLES.map((r) => <option key={r} value={r}>{T(`pages.role.${r}`)}</option>)}
            </Select>
          </Field>
          <Field id="tm-pw" label={T("pages.team.password")} hint={T("pages.team.password_hint")} error={err}>
            <Input id="tm-pw" name="password" type="password" minLength={8} maxLength={200} autoComplete="new-password" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{T("pages.team.add")}</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>{T("pages.cust.cancel")}</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function MemberControls({ lang, member, isMe }) {
  const T = useMemo(() => makeT(lang), [lang]);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function patch(body) {
    setBusy(true);
    try {
      await api(`/api/team/${member.id}`, { method: "PATCH", body });
      toast(T("pages.team.saved"));
      router.refresh();
    } catch (x) {
      toast(x.code === "last_owner" ? T("pages.team.last_owner") : x.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${member.id}`}>{T("pages.team.role")}</label>
      <select id={`role-${member.id}`} className="field w-auto" value={member.role} disabled={busy}
        onChange={(e) => patch({ role: e.target.value })}>
        {ROLES.map((r) => <option key={r} value={r}>{T(`pages.role.${r}`)}</option>)}
      </select>
      {!isMe && (
        <Button variant="secondary" disabled={busy} onClick={() => patch({ active: !member.active })}>
          {member.active ? T("pages.team.deactivate") : T("pages.team.activate")}
        </Button>
      )}
    </div>
  );
}
