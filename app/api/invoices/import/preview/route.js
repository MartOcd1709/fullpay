import { route } from "@/lib/http";
import * as imports from "@/lib/services/imports";

// Body: { csv }. Read-only: what would be imported, which rows have problems, which customers are new.
export const POST = route(({ client, ctx, body }) => imports.preview(client, ctx, typeof body?.csv === "string" ? body.csv : body?.text));
