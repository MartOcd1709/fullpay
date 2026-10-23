import { loadChain, verifyChain } from "@/lib/chain";
import { interestEligible, interestFor, interestInputs, INVOICE_SELECT } from "@/lib/services/common";

// Chain check for one invoice: the whole chain from genesis up to this invoice's newest entry must verify.
export async function chainFor(client, timeline) {
  const last = timeline?.at(-1);
  if (!last) return null;
  const rows = await loadChain((t, p) => client.query(t, p));
  const upto = rows.findIndex((r) => r.entry_hash === last.entry_hash) + 1;
  return verifyChain(rows.slice(0, upto));
}

// MSMED s.16 interest across every open, overdue invoice (K8). Null when the business is not Udyam micro/small.
export async function interestTotal(client, ctx) {
  if (!interestEligible(ctx.cfg)) return null;
  const { rows } = await client.query(
    `${INVOICE_SELECT} WHERE i.status IN ('sent','part_paid','disputed') AND b.outstanding_paise > 0 AND i.due_date < $1 ORDER BY i.id`,
    [ctx.asOf],
  );
  let total = 0;
  let count = 0;
  for (const inv of rows) {
    const r = interestFor(ctx.cfg, inv, await interestInputs(client, inv.id), ctx.asOf);
    if (r?.total_interest_paise > 0) {
      total += r.total_interest_paise;
      count += 1;
    }
  }
  return { total_paise: total, count };
}
