import { route } from "@/lib/http";

export const GET = route(async ({ client }) => ({
  activity: (await client.query(
    `SELECT a.id, a.role, a.action, a.target, a.status, a.at, u.name AS user_name
     FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300`,
  )).rows,
}), { roles: ["owner", "viewer", "accountant"] });
