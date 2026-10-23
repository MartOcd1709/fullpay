import { route } from "@/lib/http";
import { verifyRecord } from "@/lib/services/letters";

// Public tamper check. Accepts the full 64-hex hash or its first 16 hex. Returns no personal data beyond the recorded payee.
export const GET = route(async ({ params, client, ctx }) => {
  const r = await verifyRecord(client, ctx, params.hash);
  if (r.status === "invalid") return Response.json({ error: { code: "invalid_code", message: "That is not a FullPay record code" } }, { status: 400 });
  if (r.status === "not_found") return Response.json({ error: { code: "not_found", message: "No record found for this code" } }, { status: 404 });
  return r;
}, { owner: false });
