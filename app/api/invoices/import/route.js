import { route } from "@/lib/http";
import * as imports from "@/lib/services/imports";

// Body: { csv: "<file text>" }. Creates the importable rows; rows with problems and numbers already in FullPay are skipped.
export const POST = route(({ client, ctx, body }) => imports.commit(client, ctx, typeof body?.csv === "string" ? body.csv : body?.text));
