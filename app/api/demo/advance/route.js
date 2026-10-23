import { route, v } from "@/lib/http";
import { advanceDemo, demoMode } from "@/lib/services/tick";
import { appError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

// POST /api/demo/advance {days} — moves the demo clock forward and runs one daily run per simulated day.
export const POST = route(
  async ({ body }) => {
    if (!demoMode()) throw appError(403, "demo_off", "The demo clock is only available on the demo site");
    return advanceDemo(v.int(body, "days", { min: 1, max: 60, optional: true }) ?? 1);
  },
  { txn: false },
);
