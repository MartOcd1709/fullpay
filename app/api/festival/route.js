import { route } from "@/lib/http";
import * as festival from "@/lib/services/festival";

// GET: the coming festival's settlement drive (who would get it). POST { customer_ids }: queue it (the page then calls
// /api/outbox/flush, which sends the emails once this transaction has committed).
export const GET = route(({ client, ctx }) => festival.driveView(client, ctx));
export const POST = route(({ client, ctx, body }) => festival.sendDrive(client, ctx, { customer_ids: body?.customer_ids }));
