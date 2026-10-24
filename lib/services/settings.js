import { DEFAULT_CONFIG, mergeConfig, saveConfig } from "../config.js";
import { isISODate } from "../time.js";
import { event } from "./common.js";
import { badRequest } from "./errors.js";

export const get = (client, ctx) => ctx.cfg;

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Owner-editable sections only; the RBI series, GST rates, festival dates and legal text stay in code-reviewed config.
export const EDITABLE = ["business", "ladder", "forecast", "finance", "calendar", "ui", "demo"];
const FINANCE = { borrow_rate_bps: 6000, max_discount_bps: 1000 }; // editable key → largest value (60 % a year, 10 % off)

// Throws a 400 for anything the owner may not change or a value out of range. Runs before an approval is queued, and again on save.
export function check(patch) {
  if (!isPlain(patch) || !Object.keys(patch).length) throw badRequest("invalid_settings", "Settings must be a non-empty object");
  if (Object.keys(patch).some((k) => !EDITABLE.includes(k))) throw badRequest("invalid_settings", `Editable sections: ${EDITABLE.join(", ")}`);
  if (patch.finance !== undefined) {
    const f = patch.finance;
    const ok = isPlain(f) && Object.entries(f).every(([k, v]) => k in FINANCE && Number.isSafeInteger(v) && v >= 0 && v <= FINANCE[k]);
    if (!ok) throw badRequest("invalid_finance", "Borrowing rate must be 0–60 % a year and the largest pay-early discount 0–10 %");
  }
  if (patch.calendar !== undefined && (!isPlain(patch.calendar) || Object.keys(patch.calendar).some((k) => k !== "quiet_days"))) {
    throw badRequest("invalid_settings", "Only quiet days can be changed here; festival dates are set in code");
  }
  const clock = patch.demo?.clock_date;
  if (clock !== undefined && clock !== null && !isISODate(clock)) throw badRequest("invalid_date", "Demo date must be YYYY-MM-DD");
  if (patch.ui?.text_size !== undefined && !["sm", "md", "lg"].includes(patch.ui.text_size)) throw badRequest("invalid_text_size", "Text size must be sm, md or lg");
  if (patch.business?.registration !== undefined && !["regular", "composition", "unregistered"].includes(patch.business.registration)) {
    throw badRequest("invalid_registration", "Registration must be regular, composition or unregistered");
  }
  if (patch.calendar?.quiet_days !== undefined) {
    const q = patch.calendar.quiet_days;
    const ok = Array.isArray(q) && q.length <= 20 && q.every((d) => isPlain(d) && isISODate(d.from) && isISODate(d.to ?? d.from) && (d.to ?? d.from) >= d.from
      && (d.label == null || (typeof d.label === "string" && d.label.length <= 40)));
    if (!ok) throw badRequest("invalid_quiet_days", "Quiet days need a start date, an end date on or after it, and a short name (at most 20)");
  }
}

// patch is deep-merged over the stored overrides, then validated against the defaults (validateConfig).
export async function save(client, ctx, patch) {
  check(patch);
  const { rows } = await client.query("SELECT data FROM config WHERE id = 1");
  const next = mergeConfig(rows[0]?.data ?? {}, patch);
  const query = (t, p) => client.query(t, p);
  const merged = await saveConfig(query, next).catch((err) => {
    throw err.code === "CONFIG_INVALID" ? badRequest("config_invalid", err.message) : err;
  });
  await event(client, ctx, null, "config_changed", "owner", { keys: Object.keys(patch).sort() });
  return mergeConfig(DEFAULT_CONFIG, merged);
}
