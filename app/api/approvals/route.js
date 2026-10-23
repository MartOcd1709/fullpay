import { route, v } from "@/lib/http";
import * as approvals from "@/lib/services/approvals";

export const GET = route(async ({ client, request }) => {
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  return { approvals: await approvals.list(client, { status: status === "all" ? null : v.oneOf({ status }, "status", ["pending", "approved", "rejected", "failed"]) }), counts: await approvals.counts(client) };
});
