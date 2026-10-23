import { route } from "@/lib/http";
import * as fu from "@/lib/services/followups";

export const GET = route(({ client, ctx }) => fu.listToday(client, ctx));
