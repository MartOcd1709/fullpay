import { route } from "@/lib/http";
import * as payments from "@/lib/services/payments";

// Body: { csv: "<file text>" } as JSON, or the raw CSV as text/csv.
export const POST = route(({ client, ctx, body }) => payments.importCsv(client, ctx, typeof body?.csv === "string" ? body.csv : body?.text));
