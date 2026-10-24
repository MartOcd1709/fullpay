// The settlement drive before a festival: who would get the warm "settle before Dhanteras" message, and sending it.
// Same rules as every reminder: opted-out customers and disputed / paused / promised invoices are left out, at most one
// message per customer per day, and the drive is sent to a customer only once.
import { festivalState, driveRunId } from "../festivals.js";
import { INVOICE_SELECT } from "./common.js";
import { queue, compose } from "./outbox.js";
import { badRequest } from "./errors.js";

export async function driveView(client, ctx) {
  const { drive, quiet } = festivalState(ctx.cfg, ctx.asOf);
  if (!drive) return { drive: null, quiet, customers: [] };
  const runId = driveRunId(drive);
  const { rows: invs } = await client.query(
    `${INVOICE_SELECT} WHERE i.status IN ('sent','part_paid') AND b.outstanding_paise > 0 AND i.paused_by IS NULL
       AND NOT EXISTS (SELECT 1 FROM promises p WHERE p.invoice_id = i.id AND p.status = 'open')
     ORDER BY i.customer_id, i.due_date, i.id`,
  );
  const ids = [...new Set(invs.map((i) => Number(i.customer_id)))];
  const { rows: custs } = await client.query("SELECT * FROM customers WHERE id = ANY($1::bigint[]) AND anonymized_at IS NULL ORDER BY name", [ids]);
  const { rows: sent } = await client.query("SELECT DISTINCT customer_id FROM outbox WHERE run_id = $1", [runId]);
  const { rows: today } = await client.query(
    `SELECT DISTINCT customer_id FROM outbox WHERE rung <> 'invoice_sent' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date`,
    [ctx.asOf],
  );
  const done = new Set(sent.map((r) => Number(r.customer_id)));
  const busy = new Set(today.map((r) => Number(r.customer_id)));
  const customers = custs.map((c) => {
    const mine = invs.filter((i) => Number(i.customer_id) === Number(c.id));
    const state = c.opt_out ? "opted_out" : done.has(Number(c.id)) ? "sent" : busy.has(Number(c.id)) ? "messaged_today" : !c.email && !c.phone ? "no_contact" : "ready";
    return {
      id: Number(c.id), name: c.name, lang: c.preferred_lang === "hi" ? "hi" : "en", channel: c.email ? "email" : "whatsapp", state,
      owed_paise: mine.reduce((a, i) => a + i.outstanding_paise, 0), invoices: mine.map((i) => i.number),
    };
  });
  // The exact message, as the first ready customer in each language would get it.
  const previews = {};
  for (const lang of ["en", "hi"]) {
    const c = customers.find((x) => x.state === "ready" && x.lang === lang) ?? customers.find((x) => x.state === "ready");
    if (!c) continue;
    const full = custs.find((x) => Number(x.id) === c.id);
    const msg = compose({ ...ctx, run_id: runId }, { customer: { ...full, preferred_lang: lang }, invoices: invs.filter((i) => Number(i.customer_id) === c.id), template: "festival_settlement", runId });
    previews[lang] = { to: c.name, subject: msg.subject, body: msg.body };
  }
  return { drive, quiet, run_id: runId, customers, previews, ready: customers.filter((c) => c.state === "ready").length,
    owed_paise: customers.filter((c) => c.state === "ready").reduce((a, c) => a + c.owed_paise, 0) };
}

// customer_ids: who to send to (each must be "ready"). Email goes out now; WhatsApp waits in Today's follow-ups for one tap.
export async function sendDrive(client, ctx, { customer_ids }) {
  if (!Array.isArray(customer_ids) || !customer_ids.length) throw badRequest("validation", "Choose at least one customer");
  const view = await driveView(client, ctx);
  if (!view.drive) throw badRequest("no_drive", "There is no festival coming up");
  const want = new Set(customer_ids.map(Number));
  const { rows: invs } = await client.query(
    `${INVOICE_SELECT} WHERE i.status IN ('sent','part_paid') AND b.outstanding_paise > 0 AND i.paused_by IS NULL
       AND NOT EXISTS (SELECT 1 FROM promises p WHERE p.invoice_id = i.id AND p.status = 'open') ORDER BY i.due_date, i.id`,
  );
  const out = { emailed: 0, whatsapp: 0, skipped: 0 };
  for (const c of view.customers.filter((x) => want.has(x.id))) {
    if (c.state !== "ready") { out.skipped++; continue; }
    const customer = (await client.query("SELECT * FROM customers WHERE id = $1", [c.id])).rows[0];
    const mine = invs.filter((i) => Number(i.customer_id) === c.id);
    await queue(client, { ...ctx, run_id: view.run_id }, {
      customer, invoices: mine, rung: "festival", channel: c.channel, status: c.channel === "email" ? "queued" : "awaiting_owner",
    });
    out[c.channel === "email" ? "emailed" : "whatsapp"]++;
  }
  return out;
}
