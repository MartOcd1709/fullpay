import { readFile } from "node:fs/promises";
import path from "node:path";

// A Tally "Bills Receivable" style export to try the importer with (public: it is sample data only).
export async function GET() {
  const csv = await readFile(path.join(process.cwd(), "db", "tally-bills-receivable.csv"), "utf8");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="tally-bills-receivable-sample.csv"' } });
}
