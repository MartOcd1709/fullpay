import { badRequest, conflict, notFound, AppError } from "./errors.js";
import { event } from "./common.js";
import * as payments from "./payments.js";
import * as inbox from "./inbox.js";
import * as settings from "./settings.js";
import * as followups from "./followups.js";

// Maker-checker: an accountant prepares a money-moving action; it waits here until the owner approves it.
// Owners (and machine/legacy sessions) run the action directly. The executed action keeps its own chain
// events; the approval adds one more sealed event naming who prepared it and who approved it.

const EXECUTE = {
  payment_confirm: (c, ctx, a) => payments.confirm(c, ctx, a.target_id, a.payload.allocations ?? null),
  payment_reject: (c, ctx, a) => payments.reject(c, ctx, a.target_id, { reply: a.payload.reply ?? null }),
  inbox_resolve: (c, ctx, a) => inbox.resolve(c, ctx, a.target_id, a.payload),
  settings_save: (c, ctx, a) => settings.save(c, ctx, a.payload),
  tds_record: (c, ctx, a) => followups.recordTds(c, ctx, a.target_id),
};

export const needsApproval = (ctx) => ctx?.user?.role === "accountant";

// Runs the action now for an owner, or queues it for approval when an accountant asks.
export async function guard(client, ctx, { kind, target_id = null, payload = {}, summary, amount_paise = null }) {
  if (!EXECUTE[kind]) throw badRequest("validation", `Unknown action ${kind}`);
  if (!needsApproval(ctx)) return EXECUTE[kind](client, ctx, { target_id, payload });
  const { rows } = await client.query(
    `INSERT INTO approvals (kind, target_id, payload, summary, amount_paise, requested_by)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6)
     ON CONFLICT (kind, target_id) WHERE status = 'pending' AND target_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [kind, target_id, JSON.stringify(payload), summary, amount_paise, ctx.user.uid || null],
  );
  if (!rows.length) throw conflict("approval_pending", "This is already waiting for the owner's approval");
  return { approval_pending: true, approval: rows[0] };
}

export async function list(client, { status = "pending", limit = 200 } = {}) {
  const { rows } = await client.query(
    `SELECT a.*, r.name AS requested_by_name, d.name AS decided_by_name
     FROM approvals a LEFT JOIN users r ON r.id = a.requested_by LEFT JOIN users d ON d.id = a.decided_by
     WHERE ($1::text IS NULL OR a.status = $1) ORDER BY a.id DESC LIMIT $2`,
    [status, limit],
  );
  return rows;
}

export async function counts(client) {
  const { rows } = await client.query("SELECT status, count(*)::int AS n, coalesce(sum(amount_paise), 0)::bigint AS paise FROM approvals GROUP BY status");
  return Object.fromEntries(rows.map((r) => [r.status, { n: r.n, paise: r.paise }]));
}

export async function decide(client, ctx, id, { approve, note = null }) {
  if (ctx?.user?.role !== "owner") throw new AppError(403, "forbidden", "Only the owner can approve");
  const { rows } = await client.query("SELECT * FROM approvals WHERE id = $1 FOR UPDATE", [id]);
  const a = rows[0];
  if (!a) throw notFound("approval");
  if (a.status !== "pending") throw conflict("already_decided", "This was already decided");
  if (a.requested_by && Number(a.requested_by) === ctx.user.uid) throw conflict("same_person", "The person who prepared it cannot approve it");
  let status = approve ? "approved" : "rejected";
  let error = null;
  let result = null;
  if (approve) {
    await client.query("SAVEPOINT approval_exec");
    try {
      result = await EXECUTE[a.kind](client, ctx, { target_id: a.target_id == null ? null : Number(a.target_id), payload: a.payload });
      await client.query("RELEASE SAVEPOINT approval_exec");
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT approval_exec");
      status = "failed";
      error = err?.message ?? "failed";
    }
  }
  const upd = await client.query(
    "UPDATE approvals SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4, error = $5 WHERE id = $1 RETURNING *",
    [id, status, ctx.user.uid || null, note, error],
  );
  await event(client, ctx, null, "approval_decided", "owner", {
    approval_id: Number(a.id), kind: a.kind, target_id: a.target_id == null ? null : Number(a.target_id), status,
    amount_paise: a.amount_paise == null ? null : Number(a.amount_paise),
    prepared_by: a.requested_by == null ? null : Number(a.requested_by), decided_by: ctx.user.uid || null,
  });
  return { approval: upd.rows[0], result };
}

export async function decideMany(client, ctx, ids, { approve, note = null }) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) throw badRequest("validation", "Choose between 1 and 500 approvals");
  const out = [];
  for (const id of ids) {
    try {
      const r = await decide(client, ctx, id, { approve, note });
      out.push({ id, status: r.approval.status, error: r.approval.error });
    } catch (err) {
      out.push({ id, status: "skipped", error: err.message });
    }
  }
  return { results: out, approved: out.filter((r) => r.status === "approved").length, failed: out.filter((r) => r.status === "failed").length };
}
