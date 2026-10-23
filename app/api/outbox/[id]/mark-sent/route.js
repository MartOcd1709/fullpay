import { route, v } from "@/lib/http";
import { markSent } from "@/lib/services/outbox";

export const dynamic = "force-dynamic";

// POST /api/outbox/:id/mark-sent {channel?: 'whatsapp'|'sms'|'email'} — the owner sent it from their own phone.
export const POST = route(async ({ params, body, client, ctx }) => {
  const channel = v.oneOf(body, "channel", ["whatsapp", "sms", "email"], { optional: true });
  const row = await markSent(client, ctx, v.id(params), { channel });
  return { id: row.id, status: row.status, channel: row.channel, sent_at: row.sent_at };
});
