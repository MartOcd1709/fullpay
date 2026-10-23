import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { badRequest, conflict, notFound } from "./errors.js";
import { ROLES } from "../auth.js";

const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 200) throw badRequest("weak_password", "Password must be 8 to 200 characters");
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function checkHash(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const [, saltHex, keyHex] = stored.split("$");
  const key = scryptSync(password, Buffer.from(saltHex, "hex"), 32, SCRYPT);
  const want = Buffer.from(keyHex, "hex");
  return want.length === key.length && timingSafeEqual(want, key);
}

const PUBLIC = "id, name, email, role, active, created_at, last_login_at";
const normEmail = (e) => String(e ?? "").trim().toLowerCase();

export async function list(client) {
  return (await client.query(`SELECT ${PUBLIC} FROM users ORDER BY role = 'owner' DESC, role = 'accountant' DESC, id`)).rows;
}

export async function get(client, id) {
  const { rows } = await client.query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [id]);
  if (!rows.length) throw notFound("user");
  return rows[0];
}

export async function create(client, ctx, { name, email, role, password }) {
  const n = String(name ?? "").trim();
  const e = normEmail(email);
  if (!n || n.length > 120) throw badRequest("validation", "Name is required (up to 120 characters)");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw badRequest("validation", "Enter a valid email");
  if (!ROLES.includes(role)) throw badRequest("validation", `Role must be one of ${ROLES.join(", ")}`);
  const pw = password ? hashPassword(password) : null;
  const { rows } = await client.query(
    `INSERT INTO users (name, email, role, pw_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING ${PUBLIC}`,
    [n, e, role, pw],
  );
  if (!rows.length) throw conflict("email_taken", "Someone with this email is already on the team");
  return rows[0];
}

async function ownersLeft(client, exceptId) {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM users WHERE role = 'owner' AND active AND id <> $1", [exceptId]);
  return rows[0].n;
}

export async function update(client, ctx, id, { role, active }) {
  const u = await get(client, id);
  if (role != null && !ROLES.includes(role)) throw badRequest("validation", `Role must be one of ${ROLES.join(", ")}`);
  const losingOwner = u.role === "owner" && ((role && role !== "owner") || active === false);
  if (losingOwner && (await ownersLeft(client, id)) === 0) throw conflict("last_owner", "The business needs at least one active owner");
  const { rows } = await client.query(
    `UPDATE users SET role = COALESCE($2, role), active = COALESCE($3, active) WHERE id = $1 RETURNING ${PUBLIC}`,
    [id, role ?? null, active ?? null],
  );
  return rows[0];
}

export async function authenticate(client, email, password) {
  const { rows } = await client.query("SELECT * FROM users WHERE email = $1 AND active", [normEmail(email)]);
  const u = rows[0];
  if (!u || !checkHash(password, u.pw_hash)) return null;
  await client.query("UPDATE users SET last_login_at = now() WHERE id = $1", [u.id]);
  return { uid: Number(u.id), role: u.role, name: u.name };
}

export async function byRole(client, role) {
  const { rows } = await client.query(`SELECT ${PUBLIC} FROM users WHERE role = $1 AND active ORDER BY id LIMIT 1`, [role]);
  return rows[0] ?? null;
}

// Demo team: one person per role, no passwords (demo sign-in only). Idempotent.
export const DEMO_TEAM = [
  { name: "Harpreet Arora", email: "harpreet@aroraauto.example", role: "owner" },
  { name: "Simran Kaur", email: "simran@aroraauto.example", role: "accountant" },
  { name: "CA Rakesh Mehta", email: "ca.mehta@example.in", role: "viewer" },
];

export async function ensureDemoTeam(client) {
  for (const m of DEMO_TEAM) {
    await client.query(
      "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, active = true",
      [m.name, m.email, m.role],
    );
  }
}
