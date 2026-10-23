import { DEFAULT_CONFIG, mergeConfig, saveConfig } from "../config.js";
import { isISODate } from "../time.js";
import { event } from "./common.js";
import { badRequest } from "./errors.js";

export const get = (client, ctx) => ctx.cfg;

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// patch is deep-merged over the stored overrides, then validated against the defaults (validateConfig).
export async function save(client, ctx, patch) {
  if (!isPlain(patch)) throw badRequest("invalid_settings", "Settings must be an object");
  const clock = patch.demo?.clock_date;
  if (clock !== undefined && clock !== null && !isISODate(clock)) throw badRequest("invalid_date", "Demo date must be YYYY-MM-DD");
  if (patch.ui?.text_size !== undefined && !["sm", "md", "lg"].includes(patch.ui.text_size)) throw badRequest("invalid_text_size", "Text size must be sm, md or lg");
  if (patch.business?.registration !== undefined && !["regular", "composition", "unregistered"].includes(patch.business.registration)) {
    throw badRequest("invalid_registration", "Registration must be regular, composition or unregistered");
  }
  const { rows } = await client.query("SELECT data FROM config WHERE id = 1");
  const next = mergeConfig(rows[0]?.data ?? {}, patch);
  const query = (t, p) => client.query(t, p);
  const merged = await saveConfig(query, next).catch((err) => {
    throw err.code === "CONFIG_INVALID" ? badRequest("config_invalid", err.message) : err;
  });
  await event(client, ctx, null, "config_changed", "owner", { keys: Object.keys(patch).sort() });
  return mergeConfig(DEFAULT_CONFIG, merged);
}
