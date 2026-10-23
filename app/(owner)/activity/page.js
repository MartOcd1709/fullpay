import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { run } from "@/lib/services/context";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("pages.act.title") };
}

// "/api/payments/12/confirm" → "payments · confirm #12".
const label = (path) => {
  const id = path.match(/\/(\d+)(\/|$)/)?.[1];
  const words = path.replace(/^\/api\//, "").replace(/\/\d+/g, "").split("/").filter(Boolean).join(" · ");
  return id ? `${words} #${id}` : words;
};

export default async function ActivityPage() {
  const T = await getT();
  let rows;
  try {
    rows = await run(async (c) => (await c.query(
      `SELECT a.id, a.role, a.action, a.target, a.status, a.at, u.name AS user_name
       FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300`,
    )).rows);
  } catch (err) {
    console.error("[activity]", err);
    return (
      <>
        <PageHeader title={T("pages.act.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/activity" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const fmt = (ts) => new Date(ts).toLocaleString(T.lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader title={T("pages.act.title")} subtitle={T("pages.act.intro")} />
      {rows.length === 0 ? (
        <EmptyState title={T("pages.act.empty")} />
      ) : (
        <ol className="grid gap-2" aria-label={T("pages.act.title")}>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-line bg-surface p-3">
              <span className="mono text-ink-muted">{fmt(r.at)}</span>
              <span className="font-semibold">{r.user_name ?? T("pages.act.system")}</span>
              {r.role && <span className="rounded-full bg-surface-2 px-2 text-sm">{T(`pages.role.${r.role}`)}</span>}
              <span className="min-w-0 flex-1 break-words"><span className="mono text-sm text-ink-muted">{r.action}</span> {label(r.target ?? "")}</span>
              <span className={`mono text-sm ${r.status === 202 ? "text-warning" : "text-ink-muted"}`}>{r.status === 202 ? T("pages.act.queued") : r.status}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
