#!/usr/bin/env node
// Seed (or rotate) a password admin account in the wedding site database.
//
// Usage:
//   node --experimental-strip-types scripts/seed-admin.mjs --email you@example.com [--remote]
//        [--iterations 50000] [--password-file /path/to/secret]
//
// The password is read from --password-file or stdin (first line) and is never
// printed. Local mode (default) targets .wrangler/state through the built
// Worker config; --remote targets the deployed database and needs an
// authenticated Wrangler (`wrangler login`).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { credentialKey, hashPassword } from "../lib/admin-auth.ts";

const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : fallback;
}

const email = (arg("email") ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
  console.error("Usage: node --experimental-strip-types scripts/seed-admin.mjs --email you@example.com [--remote] [--iterations 50000] [--password-file path]");
  process.exit(1);
}
const iterations = Number(arg("iterations", "50000"));
const remote = args.includes("--remote");

let password;
const passwordFile = arg("password-file");
try {
  password = (passwordFile ? readFileSync(passwordFile, "utf8") : readFileSync(0, "utf8")).split("\n")[0];
} catch {
  console.error("Could not read the password. Pass --password-file or pipe it via stdin.");
  process.exit(1);
}
password = password.replace(/\r$/, "");
if (password.length < 12) {
  console.error("Refusing to seed: password shorter than 12 characters.");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const config = fileURLToPath(new URL("../dist/server/wrangler.json", import.meta.url));
if (!existsSync(config)) {
  console.error("dist/server/wrangler.json is missing. Run `npm run build` first.");
  process.exit(1);
}

const credential = await hashPassword(password, iterations);
const sql =
  `INSERT INTO settings (key, value, updated_at) VALUES ('${credentialKey(email)}', '${JSON.stringify(credential)}', CURRENT_TIMESTAMP) ` +
  "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP";

console.log(`Seeding admin credential for ${email} (${iterations} PBKDF2 iterations, ${remote ? "remote" : "local"})...`);
execFileSync("npx", [
  "wrangler", "d1", "execute", "DB", "--config", config,
  ...(remote ? ["--remote"] : ["--local", "--persist-to", ".wrangler/state"]),
  "--command", sql,
], { stdio: ["ignore", "inherit", "inherit"], cwd: root });
console.log(`OK: email + password sign-in is ready for ${email}.`);
