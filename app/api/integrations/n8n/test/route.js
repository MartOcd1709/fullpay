import { route } from "@/lib/http";
import { sendTest } from "@/lib/services/webhooks";

// Owner only: one test notice to n8n (at most one a minute). Answers { status: sent | failed | too_soon | not_configured }.
export const POST = route(({ client, ctx }) => sendTest(client, ctx), { roles: ["owner"] });
