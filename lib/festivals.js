// Festival-aware collections: quiet days (no reminders) and the settlement drive before a festival. Pure; dates are IST strings.
import { addDays, daysBetween } from "./time.js";

// { quiet: {key, from, until, resumes} | null, drive: {key, date, eve, settle_by, days_left} | null } for the demo/business day.
export function festivalState(cfg, asOf) {
  const fests = cfg.calendar?.festivals ?? [];
  const ranges = [
    ...fests.map((f) => ({ key: f.key, from: f.quiet_from, to: f.quiet_to })),
    ...(cfg.calendar?.quiet_days ?? []).map((q) => ({ key: q.key ?? "custom", label: q.label ?? null, from: q.from, to: q.to ?? q.from })),
  ].filter((r) => r.from && r.to);
  const q = ranges.find((r) => r.from <= asOf && asOf <= r.to) ?? null;
  const f = fests.find((x) => asOf >= addDays(x.date, -(x.drive_days ?? 15)) && asOf < (x.quiet_from ?? x.date)) ?? null;
  return {
    quiet: q && { key: q.key, label: q.label ?? null, from: q.from, until: q.to, resumes: addDays(q.to, 1) },
    drive: f && { key: f.key, date: f.date, eve: f.eve ?? f.date, settle_by: addDays(f.eve ?? f.date, -1), days_left: daysBetween(asOf, f.date) },
  };
}

export const driveRunId = (drive) => `festival-${drive.key}-${drive.date.slice(0, 4)}`;
export const driveFromRunId = (cfg, runId) => {
  const m = /^festival-([a-z0-9_]+)-(\d{4})$/.exec(runId ?? "");
  return m ? (cfg.calendar?.festivals ?? []).find((f) => f.key === m[1] && f.date.startsWith(m[2])) ?? null : null;
};
