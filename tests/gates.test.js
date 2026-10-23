// K29: the cheap "looks unfinished" tells, checked on every commit (tracked files only).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n")
  .filter((f) => f && !f.startsWith("docs/planning/") && !/\.(png|jpg|ico|woff2?|lock)$/.test(f) && f !== "package-lock.json");
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const code = files.filter((f) => /\.(js|mjs|jsx|json|css|yaml|yml|md|sql|csv)$/.test(f));

test("no persona left over from the organiser's sample prompt (Baaki, Sharma Packaging, Rakesh, Pune)", () => {
  // Tests may quote the pack's own fixtures; the app, its seed and the README may not.
  const bad = code.filter((f) => /^(app|lib|components|db)\//.test(f) && /\bbaaki\b|sharma packaging|\brakesh sharma\b/i.test(read(f)));
  assert.deepEqual(bad, []);
});

test("no merge-conflict markers or TODO/FIXME left in application code", () => {
  const bad = code.filter((f) => /^(app|lib|components|db|scripts)\//.test(f) && /^(<<<<<<<|>>>>>>>)|\b(TODO|FIXME|XXX)\b/m.test(read(f)));
  assert.deepEqual(bad, []);
});

test("no console.log in application code (console.info / console.error only)", () => {
  const bad = code.filter((f) => /^(app|lib|components)\//.test(f) && /console\.log\(/.test(read(f)));
  assert.deepEqual(bad, []);
});

test("no secrets committed (API keys, tokens, private keys)", () => {
  const secret = /\b(re_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9-]{20,}|sk-ant-[A-Za-z0-9-]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|rnd_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
  const bad = files.filter((f) => secret.test(read(f)));
  assert.deepEqual(bad, []);
  assert.ok(!files.some((f) => /(^|\/)\.env(\.local)?$/.test(f)), ".env files are not tracked");
});
