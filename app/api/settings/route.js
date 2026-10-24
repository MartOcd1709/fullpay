import { route } from "@/lib/http";
import * as settings from "@/lib/services/settings";
import { guard } from "@/lib/services/approvals";

export const GET = route(({ client, ctx }) => settings.get(client, ctx));
export const PATCH = route(({ client, ctx, body }) => {
  settings.check(body); // the same rule as the save itself, so an accountant's change is checked before it waits for approval
  return guard(client, ctx, { kind: "settings_save", target_id: null, payload: body, summary: `Change settings: ${Object.keys(body).join(", ")}` });
});
