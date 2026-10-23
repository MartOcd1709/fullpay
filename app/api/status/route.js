import { route } from "@/lib/http";
import { status } from "@/lib/services/tick";

export const dynamic = "force-dynamic";

// GET /api/status — public proof the daily run happened: last runs, next run, chain check, today's send counts. No personal data.
export const GET = route(async ({ client, ctx }) => status(client, ctx), { owner: false });
