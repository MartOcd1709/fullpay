import { route, v } from "@/lib/http";
import * as users from "@/lib/services/users";

export const GET = route(({ client }) => users.list(client));
export const POST = route(
  ({ client, ctx, body }) =>
    users.create(client, ctx, {
      name: v.str(body, "name", { max: 120 }),
      email: v.str(body, "email", { max: 200 }),
      role: v.oneOf(body, "role", ["owner", "accountant", "viewer"]),
      password: v.str(body, "password", { max: 200, optional: true }),
    }),
  { roles: ["owner"] },
);
