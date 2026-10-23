import { after } from "next/server";
import { route } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { reseed, machineOk, demoMode } from "@/lib/services/tick";
import { appError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

// POST /api/reseed — nightly demo reset from cron-job.org (30 s timeout), so it answers 202 at once and reseeds afterwards.
// Auth: x-reseed-secret, or the owner session when DEMO_MODE=1. The seed asserts the pinned letter hash or rolls back.
export const POST = route(
  async ({ request }) => {
    const machine = machineOk(request, "x-reseed-secret", "RESEED_SECRET");
    if (!machine) {
      if (requireOwner(request)) throw appError(401, "unauthorized", "Login required, or a valid x-reseed-secret header");
      if (!demoMode()) throw appError(403, "demo_off", "Reset is only available on the demo site");
    }
    after(async () => {
      try {
        const facts = await reseed();
        console.info(`[reseed] ok, letter hash ${facts.letter_hash}`);
      } catch (err) {
        console.error("[reseed] failed:", err?.message);
      }
    });
    return Response.json({ accepted: true }, { status: 202, headers: { "cache-control": "no-store" } });
  },
  { owner: false, txn: false },
);
