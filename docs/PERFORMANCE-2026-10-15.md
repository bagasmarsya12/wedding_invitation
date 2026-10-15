# Invitation loading and background work

Scope: the main invitation at iganyabagas.com, including entry, garden, map,
profiles and CMS photo album. No production records or approved artwork changed.

## Observed before the change

A read-only proxy of the production page recorded 6,979,414 bytes of resource
bodies before opening the envelope. This is uncompressed asset size, not a
mobile network benchmark. The initial page fetched the full native Three r186
modules (2,120,885 bytes), the garden chunk (545,631 bytes), and MapLibre
(1,027,506 bytes). Two WebGL contexts were initialized while the envelope was
still locked. Garden idle preparation eventually initialized all eight rooms.

Two profile loops totalled 4,941,242 bytes. At the album, native lazy loading
fetched ten images/GIFs, including GIFs of 2.5, 3.0 and 6.1 MB, well beyond the
immediately visible cards. These CMS originals remain intact.

## Changes

- Load the garden only after the envelope handoff. Prepare only rooms in its
  existing viewport window, retaining already visited rooms for return scroll.
- Load the interactive map and its CSS within 250 px of the map after entry.
- Derive the live envelope runtime from the exact approved scene and vendored
  Three r186, tree-shaken and minified. Master source, shaders, art and export
  renderers are unchanged. `scripts/build-envelope-runtime.mjs` regenerates the
  tracked runtime before the release fingerprint. Keep its MIT notice.
- Scope CMS and staff styles to their route layouts.
- Use 560 x 644 H.264 profile previews (919,297 bytes combined). All 117 frames,
  25 fps and 4.68-second duration are retained. Full decode and comparison with
  the resized originals gave SSIM 0.9724 and 0.9750. Play each portrait only
  while visible; synchronize when both are visible.
- Gate album image requests within 200 px after entry. Keep full originals,
  captions, photo viewer, comments, and a no-JavaScript image fallback.
- Use the previously validated 225,636-byte Stakk preview in the invitation
  footer. Unsupported/autoplay-blocked video keeps its still poster instead of
  downloading a 6.9 MB GIF.

Profile previews can be reproduced with ffmpeg using the original bundled MP4s:
`-vf scale=560:644:flags=lanczos -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart -an`.

## Verification scope

Envelope pose parity is sampled at 361 positions against the approved source.
Unit, TypeScript, compiled guest-flow, CMS/admin-flow, release guard and browser
checks cover the release. Desktop Chrome with a narrow viewport checks layout
and visibility scheduling; it does not establish performance on a real Samsung
or iPhone. Large original CMS GIFs still cost their original bytes when viewed.
