import { route } from "@/lib/http";
import { flush } from "@/lib/services/outbox";

export const dynamic = "force-dynamic";

// POST /api/outbox/flush — send every queued email now (serially). Errors land on the rows, never thrown.
export const POST = route(async () => flush(), { txn: false });
