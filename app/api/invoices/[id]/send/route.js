import { route, v } from "@/lib/http";
import { run } from "@/lib/services/context";
import * as invoices from "@/lib/services/invoices";
import { queueInvoiceEmail, flush } from "@/lib/services/outbox";

// Draft -> sent: allocates the next number, mints the pay link, and queues the invoice email (SERVICE_API deviation 3).
// The email goes out after the transaction commits; a mail failure never undoes the send (it shows as failed in Follow-ups).
export const POST = route(
  async ({ params }) => {
    const id = v.id(params);
    const { invoice, outbox } = await run(async (client, ctx) => {
      await invoices.send(client, ctx, id);
      const outbox = await queueInvoiceEmail(client, ctx, id);
      const { pay_token, ...invoice } = await invoices.get(client, ctx, id);
      return { invoice, outbox };
    });
    let mail = null;
    if (outbox?.status === "queued") {
      mail = await flush({ ids: [outbox.id] }).catch(() => null);
    }
    return { invoice, outbox: outbox ? { id: outbox.id, status: outbox.status, channel: outbox.channel } : null, mail: mail ? { sent: mail.sent, failed: mail.failed } : null };
  },
  { txn: false },
);
