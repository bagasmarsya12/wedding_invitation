#!/usr/bin/env node
// One-command Cloudflare deploy for the wedding site.
//
// Requirements: `npm run build` has produced dist/, and `npx wrangler login` is
// done (OAuth session is stored by wrangler, not by this repo).
//
// Usage:
//   node scripts/deploy-cloudflare.mjs            # build config + deploy
//   node scripts/deploy-cloudflare.mjs --migrate  # initialize a NEW database
//   node scripts/deploy-cloudflare.mjs --migration 0005_guest_passes.sql # apply only the new migration
//
// Migrations are additive one-time files: apply each exactly once per database.
// Existing databases must use --migration with the one new filename.

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
config.account_id = ids.account_id;
config.d1_databases = [{ binding: "DB", database_name: ids.database_name, database_id: ids.database_id }];
config.r2_buckets = [{ binding: "BUCKET", bucket_name: ids.bucket_name }];
const deployConfig = `${REPO}dist/server/wrangler.deploy.json`;
writeFileSync(deployConfig, JSON.stringify(config));
console.log(`deploy config ready: ${ids.worker_name} → ${ids.worker_url}`);

const run = args => execFileSync("npx", ["wrangler", ...args], { cwd: REPO, stdio: "inherit" });
const wranglerConfig = ["--config", "dist/server/wrangler.deploy.json"];

const migrations = ["0000_cooing_anthem.sql", "0001_flat_mephistopheles.sql", "0002_brainy_robbie_robertson.sql", "0003_guest_mark_style.sql", "0004_guest_mark_font.sql", "0005_guest_passes.sql", "0006_cms_operations.sql", "0007_staff_mode.sql", "0008_cms_workspace.sql"];
const migrationIndex = process.argv.indexOf("--migration");
const selectedMigration = migrationIndex >= 0 ? process.argv[migrationIndex + 1] : null;
if (migrationIndex >= 0 && !migrations.includes(selectedMigration)) throw new Error("Choose a known drizzle migration filename.");
if (selectedMigration && process.argv.includes("--migrate")) throw new Error("Use either --migrate for a new database or --migration for an existing database.");
if (process.argv.includes("--migrate") || selectedMigration) {
  for (const file of selectedMigration ? [selectedMigration] : migrations) {
    console.log(`applying drizzle/${file} …`);
    run(["d1", "execute", "DB", "--remote", "--yes", ...wranglerConfig, "--file", `drizzle/${file}`]);
  }
}

run(["deploy", ...wranglerConfig]);
console.log("deployed. Seed/rotate the admin login with: node --experimental-strip-types scripts/seed-admin.mjs --email <you> --remote");
