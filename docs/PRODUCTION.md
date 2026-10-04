# Bagas × Iga — production operations

The production invitation runs Vinext/React on the standalone Cloudflare Worker recorded in `deploy/cloudflare.json`, with D1 for structured data and R2 for guest drawings and CMS media. The site is public; individual invitations use opaque `/invite/<token>` links. Admin authentication is either dispatch-owned ChatGPT sign-in plus a server-side `ADMIN_USER_IDS`/`ADMIN_EMAILS` allowlist, or email + password sign-in backed by a PBKDF2-hashed credential in the `settings` table (`admin.credential.<email>`, key `admin.session_secret` for the signed session cookie). Seed or rotate a password from the admin desk (Pengaturan tab) or with `node --experimental-strip-types scripts/seed-admin.mjs --email you@example.com --password-file <file>` (add `--remote` once a standalone Worker deploy exists). The client never receives the allowlist, credential hashes, or token hashes.

## Standalone Cloudflare deployment (added 26 Sep 2026)

- Worker **`bagas-iga-wedding`** → https://bagas-iga-wedding.bagasmarsya.workers.dev (workers.dev subdomain `bagasmarsya`, account `a88d690a…`). D1 **`wedding-invitation`** (`4c2cdd67-…`, APAC), R2 **`wedding-invitation-media`**; ids recorded in `deploy/cloudflare.json` (ids are not secrets; no API tokens live in this repo — wrangler keeps its own OAuth session).
- Redeploy after `npm run build`: `node scripts/deploy-cloudflare.mjs`; for an existing database apply one pending file with `--migration <filename>`. `--migrate` initializes a new database only; never replay the entire migration chain on production.
- Off-platform hosts have no `oai-authenticated-*` headers, so admin sign-in there is **email + password** (seed or rotate: `node --experimental-strip-types scripts/seed-admin.mjs --email you@example.com --remote`). `ADMIN_SESSION_SECRET` is optional; when unset the session secret is generated into the settings table.
- A brand-new `*.workers.dev` subdomain can refuse TLS handshakes (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`) for a few minutes while its certificate is provisioned; retry.

## Before sending invitations

1. Confirm the existing Cloudflare `DB` and `BUCKET` bindings from `deploy/cloudflare.json`. Standalone production uses the existing email/password account; local Sites mock authentication is loopback only. Never commit credentials.
2. Apply only migrations missing from the production schema. Do not point local/preview test fixtures at production D1. Local Wrangler data is isolated under `.wrangler/state`; automated tests use temporary stores.
3. Open `/admin`, sign in as an allowlisted admin, import real guests, and save the downloaded CSV containing newly generated invitation URLs in a private location. Import format: `displayName,partyLimit,email,reference`. `email` and `reference` are optional; use a stable unique `reference` for households with similar names. Import is idempotent. New invitation tokens are encrypted with the existing admin session secret and can be recovered or exported by authenticated CMS admins. Token hashes still authenticate guest access. Pre-migration links must be pasted and verified in Prepare WhatsApp message before they can be recovered; regenerating a link invalidates the old one. A revoked guest link stops working.
4. Set the real gift catalogue, shipping instructions (only if needed), and Archive entries in admin. Archive entries stay drafts until published. No fake guests, memories, or gifts are seeded. RSVP and marks work with the current configured lifecycle; check feature toggles before sending.
5. Run a real-device check with a private test household before distributing links. Remove/revoke that household if it should not remain in the guest list.

## Local verification

Use Node 22.13+ and `npm ci`, then `npm run build`. Run `npm run dev` for the UI. Apply each pending local migration once, in order, using Wrangler with `--local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/<migration>.sql`. The files currently start at `0000_cooing_anthem.sql` and continue in journal order. The existing README contains the full local Wrangler command. `npm run start` serves the built Worker; it does not simulate admin sign-in.

Before a release run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run test:admin`, and `npm run build`. The HTTP and admin integration suites create and remove isolated local databases; they never write production data. Set `SITE_URL=https://your-site.example` and run `npm run smoke` to check public pages and denial of anonymous admin access without mutations. For a personalized smoke check, set `INVITE_TEST_URL` to a dedicated test household link too; do not put a real guest link in logs or screenshots.

## Daily operations

- `/admin` shows guest households, RSVP responses and counts, reservations, marks, Archive, and settings. Only authenticated owners can read or change these on the server.
- Export RSVP CSV or the full JSON data backup from admin. The backup includes private records, token hashes and encrypted invitation tokens, and may include the settings required to decrypt those tokens. Treat both exports as confidential. R2 drawings are separate binary objects, not embedded in JSON.
- A gift becomes reserved through an atomic D1 update; a second guest cannot reserve it. Guests can release or mark their own reservation purchased. Admin can release an active reservation. Shipping instructions are shown only to the reserving/purchasing guest for a shipping-required gift, never in the public catalogue.
- New marks are pending. Review in admin and approve/reject; only approved, public marks appear publicly. R2 image responses are private-cache/no-store so a moderation reversal does not leave a stale public image cached by the app.
- The lifecycle uses 1 November 2026 in Asia/Jakarta: `auto`, `pre-wedding`, `wedding-day`, or `post-wedding`. Admin may override `site_phase` and set RSVP/Gifts/Marks to `auto`, `on`, or `off`. Directions remain accessible across phases.

## Backups, incidents, and rollback

Export private JSON and RSVP CSV before a production release and routinely during the RSVP period; store them outside the public repository. Confirm D1 Time Travel/PITR availability and retention in the Cloudflare dashboard for the actual production database. R2 requires a separate bucket backup/replication plan for drawings; the JSON export alone is insufficient. Test restoration into a **separate** database/bucket before relying on it.

Cloudflare publishing creates a new Worker version. On a bad frontend release, roll back to the previous known-good Worker version. A code rollback does **not** reverse a D1 migration: these migrations are additive; assess data compatibility before rolling back. For a data incident use a timestamped D1 Time Travel restore into a separate database, validate it, then deliberately switch bindings. Never run local test or destructive recovery commands against the production binding by accident.

The API logs action/error class only, not invite tokens, names, messages, drawings, or shipping details. Use Worker/Sites logs and D1 health for errors. There is no paid email, external analytics, or monitoring provider configured; CMS visit summaries are stored locally in D1 and respect browser privacy signals; core invitation flows do not depend on one. Establish an operational owner to review failed RSVP/mark/gift actions and pending marks during the event period.

## Device checklist

On iOS Safari, Android Chrome, and WhatsApp/Instagram in-app browsers where available: open the envelope, follow an invite link, read date/time/address before imagery loads, use directions if MapLibre fails, submit/update RSVP and refresh using synthetic staging guests, reserve a gift when the real catalogue is enabled, submit a text mark and a drawing, scroll with the map in view, rotate the device, use the keyboard, and test reduced-motion mode. Test desktop Chrome and Safari too. The restored botanical renderer must fall back to existing DOM/CSS artwork on WebGL failure; MapLibre failure must not block the invitation or its directions link. Do not use production guest data for these mutation tests.

## Keepsake and envelope release · 4 October 2026

The entry envelope shares the approved Atelier illustration, paper and foil renderer. A hinged flap, lifted seal and emerging card lead into the invitation; reduced motion enters immediately, and DOM artwork remains available if WebGL fails. A 3.6-second completion guard prevents a disabled animation from trapping the guest.

Use **Tamu & link → Tulis pesan keepsake** to write a guest's front note (180 characters) and back message (600 characters). The language selection chooses interface labels; the message remains literal. Global signature and all guest viewer labels are editable in **Konten → Keepsake / Interface keepsake**. The private card link is `/invite/<token>/keepsake`. Guests see the card and front PNG, back PNG and MP4 download controls. Exports use 1080 × 1920 pixels; long back messages paginate. `/keepsake` is a generic public preview and never loads a guest's personal message.

Personal notes live under the private `guest-keepsake.<guestId>` settings prefix. Global content selects only `content.*`. Both invalid and revoked tokens return 404. Owner access and same-origin validation protect writes; dynamic card responses use no-store and noindex.

Migration `0008_cms_workspace.sql` adds encrypted invitation recovery and page visits. Existing production was verified to have migrations 0005–0007 but not 0008. Back up D1 privately before applying 0008 once. The previous Worker version is `0e6d1246-4696-414a-9adb-a2954132d0ba`; a code rollback leaves these additive schema changes in place.

Release verification: typecheck and build passed; lint passed with 40 existing/advisory warnings and no errors; 28 unit tests passed; isolated HTTP and admin suites passed, including RSVP, import idempotence, backup, moderation, gift concurrency/privacy, personal note isolation, literal CMS labels, revocation, QR party limits and duplicate arrival. Native in-app browser QA covered the envelope, reopening, Indonesian switch, 320/390-pixel layouts, CMS note save and private card, and PNG/MP4 downloads. Both PNGs were 1080 × 1920; MP4 was AVC, 1080 × 1920, 15 seconds. Physical iOS/Android/Instagram browser checks remain a pre-distribution task. Owner photos, family details and personal copy remain CMS content work.
