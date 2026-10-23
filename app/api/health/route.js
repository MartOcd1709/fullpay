import { BUILD_SHA, dbUp } from "@/lib/services/tick";
import { nowISOTimestamp } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/health — public, for Render's health check and the keep-alive ping. No personal data, no secrets.
export async function GET() {
  const db = (await dbUp()) ? "up" : "down";
  return Response.json(
    { ok: true, sha: BUILD_SHA ? BUILD_SHA.slice(0, 7) : null, db, node: process.version, time: nowISOTimestamp() },
    { headers: { "cache-control": "no-store" } },
  );
}
