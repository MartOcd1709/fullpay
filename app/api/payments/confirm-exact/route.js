import { route, v } from "@/lib/http";
import * as approvals from "@/lib/services/approvals";

// GET: how many exact matches are waiting. POST { min_confidence? }: confirm them (owner) or send them for approval (accountant).
export const GET = route(({ client }) => approvals.exactMatches(client, {}));
export const POST = route(({ client, ctx, body }) =>
  approvals.confirmExact(client, ctx, { min_confidence: v.int(body ?? {}, "min_confidence", { min: 80, max: 100, optional: true }) ?? 95 }));
