import { route } from "@/lib/http";
import { run } from "@/lib/services/context";
import { reseed, demoMode, minutesSinceReset } from "@/lib/services/tick";
import { appError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

const GUARD_MINUTES = 10;

// POST /api/demo/reset {confirm?} — rebuilds the demo world now (about 3 s) and waits for it, so the page can reload.
// K3 shared-demo guard: within 10 minutes of the last reset someone else is probably mid-tour, so it needs {confirm:true}.
export const POST = route(
  async ({ body }) => {
    if (!demoMode()) throw appError(403, "demo_off", "Reset is only available on the demo site");
    const minutes = await run((c) => minutesSinceReset(c));
    if (minutes != null && minutes < GUARD_MINUTES && body?.confirm !== true) {
      throw appError(409, "recently_reset", `The demo was reset ${minutes} min ago, maybe by another visitor. Send confirm to reset anyway.`);
    }
    return { ok: true, ...(await reseed()) };
  },
  { txn: false },
);
