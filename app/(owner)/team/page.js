import { cookies } from "next/headers";
import PageHeader from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { getT } from "@/components/ui/server/lang";
import { getSessionFromCookies } from "@/lib/auth";
import { run } from "@/lib/services/context";
import * as users from "@/lib/services/users";
import { AddMember, MemberControls } from "@/components/pages/Team";

export async function generateMetadata() {
  const T = await getT();
  return { title: T("pages.team.title") };
}

export default async function TeamPage() {
  const T = await getT();
  const session = getSessionFromCookies(await cookies());
  let team;
  try {
    team = await run((c) => users.list(c));
  } catch (err) {
    console.error("[team]", err);
    return (
      <>
        <PageHeader title={T("pages.team.title")} />
        <ErrorState title={T("core.err.title")} message={T("core.err.load")} retryHref="/team" retryLabel={T("btn.retry")} />
      </>
    );
  }
  const isOwner = session?.role === "owner";
  return (
    <>
      <PageHeader title={T("pages.team.title")} subtitle={T("pages.team.intro")} actions={isOwner ? <AddMember lang={T.lang} /> : null} />
      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label={T("pages.team.roles_h")}>
        {["owner", "accountant", "viewer"].map((r) => (
          <div key={r} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-bold">{T(`pages.role.${r}`)}</p>
            <p className="mt-1 text-ink-muted">{T(`pages.team.can.${r}`)}</p>
          </div>
        ))}
      </section>
      <ul className="grid gap-3" aria-label={T("pages.team.title")}>
        {team.map((m) => (
          <li key={m.id} className={`flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 ${m.active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{m.name}{m.id === session?.uid ? ` · ${T("pages.team.you")}` : ""}</p>
              <p className="break-all text-ink-muted">{m.email}{m.active ? "" : ` · ${T("pages.team.inactive")}`}</p>
            </div>
            {isOwner ? (
              <MemberControls lang={T.lang} member={m} isMe={m.id === session?.uid} />
            ) : (
              <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold">{T(`pages.role.${m.role}`)}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
