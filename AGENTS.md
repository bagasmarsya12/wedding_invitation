# Wedding release workflow

Preserve the approved Atelier asset package in `deploy/approved-design.json`. Feature, CMS, guest, and staff work must retain its illustration, identity, and floral compositions unless the user explicitly requests changing that design.

Build with `npm run build`, verify with `npm run verify:release`, then deploy with `node --import ./scripts/sites-env.mjs scripts/deploy-cloudflare.mjs`. The wrapper rejects changed approved art, stale source, and modified build artifacts before any remote action. Direct Wrangler deployment bypasses this local guard and must not be used for normal releases.

Do not regenerate approved-design.json merely to clear a failed check. Restore unintended changes. When a user has authorized a design change, inspect the affected visuals, verify the implementation, and update only the intentionally changed manifest entries and edition. Existing authorization applies; do not demand another confirmation for an already approved request.

Keep CMS/guest data and existing routes intact. Visual and keepsake-export changes need no database migration. Never rerun all production migrations for an existing database.
