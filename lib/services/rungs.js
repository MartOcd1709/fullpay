// Ladder state + one rung step, without the outbox (the tick service queues the message on top of this).
import { evaluate } from "../ladder.js";
import { addDays } from "../time.js";
import { event, INVOICE_SELECT, interestInputs, interestFor, tokenExpiry } from "./common.js";
import { markBroken } from "./promises.js";

// Every sent/part-paid invoice with what ladder.evaluate needs, and its evaluation as of ctx.asOf.
export async function evaluateAll(client, ctx) {
  const { rows } = await client.query(
    `${INVOICE_SELECT.replace("SELECT i.*,", "SELECT i.*, (SELECT row_to_json(p) FROM promises p WHERE p.invoice_id = i.id AND p.status = 'open') AS open_promise,")}
     WHERE i.status IN ('sent','part_paid') ORDER BY i.customer_id, i.due_date, i.id`,
  );
  const { offsets, auto_rungs } = ctx.cfg.ladder;
  return rows.map((inv) => ({
    inv,
    ev: evaluate(inv, { today: ctx.asOf, offsets, auto_rungs, customer: { opt_out: inv.customer_opt_out }, open_promise: inv.open_promise }),
  }));
}

export async function applyAdvance(client, ctx, inv, ev, actor = "system") {
  if (!ev.eligible) return null;
  if (ev.action === "unpause_and_advance" && inv.open_promise) await markBroken(client, ctx, inv.open_promise);
  const ttl = tokenExpiry(addDays(ctx.asOf, 60));
  await client.query(
    `UPDATE invoices SET rung = $2,
            pay_token_expires_at = CASE WHEN pay_token IS NULL THEN NULL ELSE GREATEST(pay_token_expires_at, $3::timestamptz) END
     WHERE id = $1`,
    [inv.id, ev.target_rung, ttl],
  );
  for (const rung of ev.skipped) await event(client, ctx, inv.id, "rung_skipped", actor, { rung });
  const advanced = await event(client, ctx, inv.id, "rung_advanced", actor, { from: inv.rung ?? null, to: ev.target_rung });
  if (ev.target_rung === "demand_letter") {
    const interest = interestFor(ctx.cfg, inv, await interestInputs(client, inv.id), ctx.asOf);
    return event(client, ctx, inv.id, "letter_generated", actor, {
      interest_paise: interest?.total_interest_paise ?? 0,
      segments_n: interest?.segments.length ?? 0,
      include_interest: inv.letter_include_interest === true,
      deadline_date: addDays(ctx.asOf, ctx.cfg.letter?.deadline_days ?? 7),
    });
  }
  if (ev.target_rung === "odr_guidance") return event(client, ctx, inv.id, "bundle_ready", actor, {});
  return advanced;
}
