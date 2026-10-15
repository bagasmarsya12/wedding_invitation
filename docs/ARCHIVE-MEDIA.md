# Archive media previews

The homepage album uses separate WebP previews and MP4 loops. Original photo/GIF
objects, captions, ordering, comments, published mappings and history are retained.
The full photograph viewer still requests the original only when opened.

## Storage and publication

`content/previews/archive-v1/<sha256(original revision key)>/` contains `card.webp`,
`large.webp` and optionally `motion.mp4`. The original key is immutable. Replacing
a photo or restoring an older revision selects its own previews. Public URLs use
a hash of that key instead of a timestamp so two saves in one second cannot reuse
the wrong browser cache entry.

Public `?preview=card|large|motion` requests first resolve the current published
slot mapping. A cached derivative cannot reveal an unpublished draft or bypass
removal of a slot. Private preview requests authenticate before reading their
revision key and always return private/no-store responses. Public derivatives use
an edge cache, ETags and bounded browser caching. MP4 range requests return 206;
invalid ranges return 416. Missing video uses its poster. Legacy image uploads
without derivatives remain readable through the original-image fallback.

## CMS uploads

Archive uploads generate 640/1280-width WebP previews without upscaling. The GIF
decoder and video muxer load only when needed in the CMS. GIF patches are decoded
one at a time, including disposal/background rules; encoded samples retain the
original frame delays. Original GIF bytes are uploaded unchanged. Animated
previews play only when visible, with a poster for reduced motion, blocked
autoplay or unsupported playback.

If the uploading browser cannot encode H.264, or a GIF exceeds the bounded
encoding budget, the CMS keeps its original and prepares still previews. It tells
the owner that the album preview is a still on that upload. Very large GIF
canvases use a still preview rather than decoding all animation patches.

The upload API validates authentication, origin, slot, per-part size, MIME and
file signatures before storing derivatives. Existing clients without derivative
parts retain their prior upload contract.

## Existing library backfill

`scripts/backfill-archive-previews.mjs --manifest <verified-manifest> --upload`
checks every original against R2 before writing only the derivative namespace.
Without `--upload`, it only verifies. It compares published media setting hashes
before and after and never writes D1, overwrites originals, or runs migrations.
`--local --persist-to <directory>` supports isolated QA storage.

The initial backfill covers 17 public media: 11 photos and 6 GIFs (45,957,952
original bytes). All card previews plus loops total 3,012,661 bytes; all large
previews plus loops total 4,616,445 bytes. Responsive images select one preview
size. All 108 GIF frames retain their order, 180 ms holds and exact loop duration.
All 34 WebPs and 6 MP4s were fully decoded and inspected. A real Chrome run of the
CMS encoder also preserved every frame and delay of a 12-frame gallery GIF.

Unit, TypeScript, guest-flow and CMS integration checks cover key versioning,
private drafts, publication/recovery, original-byte preservation, ETags and MP4
range responses. Narrow browser QA is not a physical Samsung/iPhone benchmark.
