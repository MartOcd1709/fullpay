import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { run } from "@/lib/services/context";
import { keys } from "@/lib/i18n";

const KNOWN = new Set(keys);

export async function generateMetadata() {
  const T = await getT();
  return { title: T("pages.act.title") };
}

// "/api/payments/12/confirm" → slug "payments.confirm", id 12 → "Confirmed payment #12" (falls back to the path words).
const parse = (path) => {
  const id = path.match(/\/(\d+)(\/|$)/)?.[1] ?? null;
  const slug = path.replace(/^\/api\//, "").replace(/\/\d+/g, "").split("/").filter(Boolean).join(".");
  return { id, slug };
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
              {(() => {
                const { id, slug } = parse(r.target ?? "");
                const key = `pages.act.a.${r.action === "PATCH" && slug === "settings" ? "settings" : slug}`;
                const text = KNOWN.has(key) ? T(key) : slug.replaceAll(".", " · ");
                return <span className="min-w-0 flex-1 break-words">{text}{id ? ` #${id}` : ""}</span>;
              })()}
              <span className={`text-sm font-semibold ${r.status === 202 ? "text-warning" : r.status < 300 ? "text-success" : "text-error"}`}>
                {r.status === 202 ? T("pages.act.queued") : r.status < 300 ? T("pages.act.ok") : r.status}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
