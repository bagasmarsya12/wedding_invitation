#!/usr/bin/env node
// One-command Cloudflare deploy for the wedding site.
//
// Requirements: `npm run build` has produced dist/, and `npx wrangler login` is
// done (OAuth session is stored by wrangler, not by this repo).
//
// Usage:
//   node scripts/deploy-cloudflare.mjs            # build config + deploy
//   node scripts/deploy-cloudflare.mjs --migrate  # also (re-)apply drizzle files
//
// Migrations are additive one-time files: apply each exactly once per database.
// Pass --migrate only when a new drizzle/*.sql file must reach production.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const ids = JSON.parse(readFileSync(new URL("../deploy/cloudflare.json", import.meta.url), "utf8"));

const baseConfig = `${REPO}dist/server/wrangler.json`;
if (!existsSync(baseConfig)) {
  console.error("dist/server/wrangler.json is missing — run `npm run build` first.");
  process.exit(1);
}

const config = JSON.parse(readFileSync(baseConfig, "utf8"));
config.topLevelName = ids.worker_name;
config.name = ids.worker_name;
config.d1_databases = [{ binding: "DB", database_name: ids.database_name, database_id: ids.database_id }];
config.r2_buckets = [{ binding: "BUCKET", bucket_name: ids.bucket_name }];
const deployConfig = `${REPO}dist/server/wrangler.deploy.json`;
writeFileSync(deployConfig, JSON.stringify(config));
console.log(`deploy config ready: ${ids.worker_name} → ${ids.worker_url}`);

const run = args => execFileSync("npx", ["wrangler", ...args], { cwd: REPO, stdio: "inherit" });
const wranglerConfig = ["--config", "dist/server/wrangler.deploy.json"];

if (process.argv.includes("--migrate")) {
  for (const file of ["0000_cooing_anthem.sql", "0001_flat_mephistopheles.sql", "0002_brainy_robbie_robertson.sql", "0003_guest_mark_style.sql", "0004_guest_mark_font.sql"]) {
    console.log(`applying drizzle/${file} …`);
    run(["d1", "execute", "DB", "--remote", "--yes", ...wranglerConfig, "--file", `drizzle/${file}`]);
  }
}

run(["deploy", ...wranglerConfig]);
console.log("deployed. Seed/rotate the admin login with: node --experimental-strip-types scripts/seed-admin.mjs --email <you> --remote");
