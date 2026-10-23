import { cookies } from "next/headers";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Money from "@/components/ui/Money";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { getSessionFromCookies } from "@/lib/auth";
import { run } from "@/lib/services/context";
import * as approvals from "@/lib/services/approvals";
import { ApprovalQueue } from "@/components/pages/Approvals";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("pages.appr.title") };
}

const when = (ts, lang) =>
  new Date(ts).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function ApprovalsPage() {
  const T = await getT();
  const session = getSessionFromCookies(await cookies());
  let data;
  try {
    data = await run(async (c) => ({
      pending: await approvals.list(c, { status: "pending" }),
      decided: (await approvals.list(c, { status: null, limit: 60 })).filter((a) => a.status !== "pending"),
      counts: await approvals.counts(c),
    }));
  } catch (err) {
    console.error("[approvals]", err);
    return (
      <>
        <PageHeader title={T("pages.appr.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/approvals" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const { pending, decided, counts } = data;
  const isOwner = session?.role === "owner";
  const tone = { approved: "text-success", rejected: "text-ink-muted", failed: "text-error" };
  return (
    <>
      <PageHeader title={T("pages.appr.title")} subtitle={T(isOwner ? "pages.appr.intro_owner" : "pages.appr.intro_other")} />
      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label={T("pages.appr.summary")}>
        {["pending", "approved", "rejected"].map((k) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-semibold text-ink-muted">{T(`pages.appr.st.${k}`)}</p>
            <p className="mt-1 text-2xl font-bold">{counts[k]?.n ?? 0}</p>
            <p className="text-ink-muted"><Money paise={counts[k]?.paise ?? 0} /></p>
          </div>
        ))}
      </section>
      <h2 className="mb-3 text-lg font-bold">{T("pages.appr.waiting_h", { n: pending.length })}</h2>
      {pending.length === 0 ? (
        <EmptyState title={T("pages.appr.empty")} />
      ) : (
        <ApprovalQueue lang={T.lang} rows={pending} canDecide={isOwner} myUid={session?.uid ?? 0} />
      )}
      {decided.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{T("pages.appr.history")}</h2>
          <ul className="grid gap-2">
            {decided.map((a) => (
              <li key={a.id} className="rounded-xl border border-line bg-surface p-3">
                <p className="font-semibold">{a.summary}</p>
                <p className="text-ink-muted">
                  <strong className={tone[a.status]}>{T(`pages.appr.st.${a.status}`)}</strong>
                  {" · "}{T("pages.appr.prepared_decided", { by: a.requested_by_name ?? "—", dec: a.decided_by_name ?? "—" })}
                  {a.decided_at ? ` · ${when(a.decided_at, T.lang)}` : ""}
                  {a.error ? ` · ${a.error}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
