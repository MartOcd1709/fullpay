import { route, v } from "@/lib/http";
import { badRequest } from "@/lib/services/errors";
import { setLetterInterest } from "@/lib/services/letters";

// Owner tick on the letter toolbar: add the s.16 interest to the amount requested (letter_include_interest).
export const POST = route(async ({ params, body, client, ctx }) => {
  if (typeof body?.include_interest !== "boolean") throw badRequest("validation", "include_interest must be true or false");
  return setLetterInterest(client, ctx, v.id(params), body.include_interest);
});
