import { route, v } from "@/lib/http";
import * as users from "@/lib/services/users";

export const PATCH = route(
  ({ client, ctx, params, body }) =>
    users.update(client, ctx, v.id(params), {
      role: v.oneOf(body, "role", ["owner", "accountant", "viewer"], { optional: true }),
      active: typeof body?.active === "boolean" ? body.active : null,
    }),
  { roles: ["owner"] },
);
