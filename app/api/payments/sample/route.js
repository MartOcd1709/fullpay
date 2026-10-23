import { readFile } from "node:fs/promises";
import path from "node:path";
import { route } from "@/lib/http";
import * as payments from "@/lib/services/payments";

// "Load sample statement": imports the seeded db/bank-statement.csv through the same path as an upload.
export const POST = route(async ({ client, ctx }) => {
  const csv = await readFile(path.join(process.cwd(), "db", "bank-statement.csv"), "utf8");
  return payments.importCsv(client, ctx, csv);
});
