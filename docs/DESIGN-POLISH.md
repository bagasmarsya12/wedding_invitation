# Current design polish — 2 October 2026

The 2 October accent revision restores the exact live Three.js chapter renderer, three-tier conservatory arch and attached pleated drapery. Botanical framing has greater volume: larger shoulder and foreground plants, a fuller asymmetric garland and a denser low meadow. The live geometry, camera, palette, species, native scrolling and text clearances remain. Existing raster assets are unchanged. MapLibre remains the venue map.

## Public content readiness

- `lib/public-content.ts`: explicit `PROFILE_ENABLED = false`, confirmed Useful Bits, available Beyond destinations, empty The Mark process material list, and the shared unfinished-copy guard.
- Profiles additionally require all six real observation fields from the existing CMS. Their implementation and styles remain available.
- `lib/homepage-content.ts`: load only public, published, featured Archive records with genuine copy; retain the built-in The Mark; derive gift collection previews from actual catalogue items. Query failures keep The Mark available and gifts hidden.
- Homepage gifts require real preview items plus the existing site gift flag. Private catalogue and RSVP endpoints are unchanged.
- Standalone Archive and direct story routes apply the same readiness guard. Empty process material and missing media produce no placeholder promise.
- `lib/invitation-clock.ts`: Jakarta date boundary, dynamic sentence-case countdown, existing phase overrides.

Native anchors follow the working standalone Archive navigation pattern and avoid the deployed Vinext client-navigation error. CMS literal overrides and keyed field values are now passed separately to `LanguageProvider`.

The footer paper uses `overflow: clip`: its negative-inset decorative light must not create an internal scroll container. Previously, keyboard End could move the paper contents 32px and crop the folio identity/date. Footer layout and copy remain the same.

## Verification

Current supported commands: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run test:admin`.

Browser verification for this pass uses the built Worker and isolated local D1 state at 390×844, 430×932, 768×1024 and 1440×900. It includes EN/ID, envelope/skip/Continue, map/directions, Archive/story/return, public preview RSVP, synthetic private RSVP save/update/persistence, focus visibility, content readiness and overflow checks.

Historical visual harnesses and earlier design notes are listed in `tests/README.md`; they are not current acceptance criteria. The accent comparison and current verification evidence are delivered beside this worktree in `../REPORT.md`.

No production deployment, remote D1 mutation, migration or guest submission is performed by this polish pass.
