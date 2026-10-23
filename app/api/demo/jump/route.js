import { route, v } from "@/lib/http";
import { run } from "@/lib/services/context";
import { advanceDemo, daysUntil, demoMode, reseed, JUMPS } from "@/lib/services/tick";
import { appError, conflict } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

// POST /api/demo/jump {to: 'letter'|'odr'|'next'|'today'} (K3)
// letter / odr / next: advance the demo clock day by day until the next demand letter, ODR step or any rung falls due.
// today: back to the start of the demo (a fresh reseed at the demo date).
export const POST = route(
  async ({ body }) => {
    if (!demoMode()) throw appError(403, "demo_off", "The demo clock is only available on the demo site");
    const to = v.oneOf(body, "to", ["letter", "odr", "next", "today"]);
    if (to === "today") return { ok: true, to, ...(await reseed()) };
    const days = await run((c, ctx) => daysUntil(c, ctx, JUMPS[to]));
    if (days == null || days > 60) throw conflict("nothing_ahead", "Nothing of that kind falls due in the next 60 days");
    return { to, ...(await advanceDemo(days)) };
  },
  { txn: false },
);
