import { route } from "@/lib/http";
import * as fu from "@/lib/services/followups";

// GET /api/forecast?late=<customer id>&late_days=30&order=<rupees>&order_week=<1..13>&supplier=<days>
export const GET = route(({ client, ctx, request }) =>
  fu.forecastView(client, ctx, fu.parseWhatIf(new URL(request.url).searchParams, ctx.cfg.forecast?.weeks ?? 13)),
);
