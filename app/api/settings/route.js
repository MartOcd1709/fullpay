import { route } from "@/lib/http";
import * as settings from "@/lib/services/settings";
import { badRequest } from "@/lib/services/errors";

// Owner-editable sections only; the RBI series, GST rates and legal text stay in code-reviewed config.
const EDITABLE = ["business", "ladder", "forecast", "ui", "demo"];

export const GET = route(({ client, ctx }) => settings.get(client, ctx));
export const PATCH = route(({ client, ctx, body }) => {
  const keys = Object.keys(body ?? {});
  const bad = keys.filter((k) => !EDITABLE.includes(k));
  if (!keys.length || bad.length) throw badRequest("invalid_settings", `Editable sections: ${EDITABLE.join(", ")}`);
  return settings.save(client, ctx, body);
});
