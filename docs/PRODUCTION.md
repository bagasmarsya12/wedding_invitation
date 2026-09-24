# Bagas × Iga — production operations

The existing Sites deployment runs Vinext/React on a Cloudflare Worker, D1 for structured data, and R2 for guest drawings. The site is public; individual invitations use opaque `/invite/<token>` links. Admin authentication is dispatch-owned ChatGPT sign-in plus a server-side `ADMIN_USER_IDS`/`ADMIN_EMAILS` allowlist. The client never receives the allowlist or token hashes.

## Before sending invitations

1. Confirm the production Site still has the `DB` D1 and `BUCKET` R2 bindings in `.openai/hosting.json`, and configure `ADMIN_EMAILS` or `ADMIN_USER_IDS` in the Site environment. See `.env.example`; never commit values.
2. Apply the ordered migrations under `drizzle/` using the Sites publish workflow. Do not point local/preview test fixtures at production D1. Local Wrangler data is isolated under `.wrangler/state`; automated tests use temporary stores.
3. Open `/admin`, sign in as an allowlisted admin, import real guests, and save the downloaded CSV containing newly generated invitation URLs in a private location. Import format: `displayName,partyLimit,email,reference`. `email` and `reference` are optional; use a stable unique `reference` for households with similar names. Import is idempotent. Raw tokens are shown **only when first created**; the database stores only hashes, so lost links cannot be exported again. Do not re-import expecting fresh links. A revoked guest link stops working.
4. Set the real gift catalogue, shipping instructions (only if needed), and Archive entries in admin. Archive entries stay drafts until published. No fake guests, memories, or gifts are seeded. RSVP and marks work with the current configured lifecycle; check feature toggles before sending.
5. Run a real-device check with a private test household before distributing links. Remove/revoke that household if it should not remain in the guest list.

## Local verification

Use Node 22.13+ and `npm ci`, then `npm run build`. Run `npm run dev` for the UI. Apply each pending local migration once, in order, using Wrangler with `--local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/<migration>.sql`. The files currently start at `0000_cooing_anthem.sql` and continue in journal order. The existing README contains the full local Wrangler command. `npm run start` serves the built Worker; it does not simulate admin sign-in.

Before a release run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run test:admin`, and `npm run build`. The HTTP and admin integration suites create and remove isolated local databases; they never write production data. Set `SITE_URL=https://your-site.example` and run `npm run smoke` to check public pages and denial of anonymous admin access without mutations. For a personalized smoke check, set `INVITE_TEST_URL` to a dedicated test household link too; do not put a real guest link in logs or screenshots.

## Daily operations

- `/admin` shows guest households, RSVP responses and counts, reservations, marks, Archive, and settings. Only allowlisted ChatGPT users can read or change these on the server.
- Export RSVP CSV or the full JSON data backup from admin. The backup includes private records and token **hashes**, not usable invitation links. Treat both exports as confidential. R2 drawings are separate binary objects, not embedded in JSON.
- A gift becomes reserved through an atomic D1 update; a second guest cannot reserve it. Guests can release or mark their own reservation purchased. Admin can release an active reservation. Shipping instructions are shown only to the reserving/purchasing guest for a shipping-required gift, never in the public catalogue.
- New marks are pending. Review in admin and approve/reject; only approved, public marks appear publicly. R2 image responses are private-cache/no-store so a moderation reversal does not leave a stale public image cached by the app.
- The lifecycle uses 1 November 2026 in Asia/Jakarta: `auto`, `pre-wedding`, `wedding-day`, or `post-wedding`. Admin may override `site_phase` and set RSVP/Gifts/Marks to `auto`, `on`, or `off`. Directions remain accessible across phases.

## Backups, incidents, and rollback

Export private JSON and RSVP CSV before a production release and routinely during the RSVP period; store them outside the public repository. Confirm D1 Time Travel/PITR availability and retention in the Cloudflare dashboard for the actual production database. R2 requires a separate bucket backup/replication plan for drawings; the JSON export alone is insufficient. Test restoration into a **separate** database/bucket before relying on it.

Site publishing creates a new immutable Site version. On a bad frontend release, redeploy the previous known-good Site version in Sites. A code rollback does **not** reverse a D1 migration: these migrations are additive; assess data compatibility before rolling back. For a data incident use a timestamped D1 Time Travel restore into a separate database, validate it, then deliberately switch bindings. Never run local test or destructive recovery commands against the production binding by accident.

The API logs action/error class only, not invite tokens, names, messages, drawings, or shipping details. Use Worker/Sites logs and D1 health for errors. There is no paid email, analytics, or external monitoring provider configured; core invitation flows do not depend on one. Establish an operational owner to review failed RSVP/mark/gift actions and pending marks during the event period.

## Device checklist

On iOS Safari, Android Chrome, and WhatsApp/Instagram in-app browsers where available: open the envelope, follow an invite link, read date/time/address before heavy imagery loads, use directions if MapLibre fails, submit/update RSVP and refresh, reserve a gift, submit a text mark and a drawing, scroll with the map/canvas in view, rotate the device, use the keyboard, and test reduced-motion mode. Test desktop Chrome and Safari too. Three.js is decorative; a WebGL failure must not block the invitation. Do not use production guest data for these mutation tests.
