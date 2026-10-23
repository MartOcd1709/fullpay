import { route } from "@/lib/http";
import * as invoices from "@/lib/services/invoices";

const FILTERS = ["customer_id", "status", "due_from", "due_to", "min_days_overdue", "max_days_overdue", "q"];

// GET /api/invoices?status=overdue&q=... (the seven pack statuses; due_soon and overdue are derived)
export const GET = route(({ request, client, ctx }) => {
  const sp = new URL(request.url).searchParams;
  return invoices.list(client, ctx, Object.fromEntries(FILTERS.filter((k) => sp.get(k)).map((k) => [k, sp.get(k)])));
});

// POST creates a draft; send it with POST /api/invoices/:id/send.
export const POST = route(({ client, ctx, body }) => invoices.createDraft(client, ctx, body ?? {}));
