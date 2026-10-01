# Closing and performance pass — 1 October 2026

## Scope

The homepage ends with a warm paper colophon after the unchanged Beyond room.
The monogram, event date, guest edition, existing small credit and reopen-envelope
action remain. The short closing has English/Indonesian and post-wedding variants.
Only projected light moves, through the existing damped scroll scheduler. Plants
stay fixed to the paper; their widths are capped by source pixels/display density.
No new assets, libraries, autoplay or perpetual footer animation were introduced.

## Loading changes

- `ReplyStudio` still reads private attendance immediately on entry, so the
  header confirmation does not depend on scrolling. The heavier `MarkEditor`
  and its wall are imported only within 800px of the reply room. Once mounted,
  they stay mounted when leaving it; writing/drawing drafts are not discarded.
  The placeholder and loaded container share a measured minimum height to keep
  following sections stable during loading. Real content can still grow normally.
- Failed module loading has an honest error and explicit **Reload the invitation**
  action. A browser can cache a rejected module import: blindly repeating it is
  not a reliable retry. Reloading is offered only before an editor/draft exists.
- Three.js already loaded after entry, and MapLibre already loaded near the map.
  Those existing boundaries are preserved rather than claimed as new savings.
- The garden no longer recursively constructs all eight rooms while idle at the
  hero. Preparation is limited to the nearby viewport window. Distant chapter
  instance buffers/geometries and owned materials are disposed, then recreated
  with their original deterministic seeds when revisited. Fast jumps construct
  the visible room synchronously as a fallback. Mesh detail, palette, camera,
  shadow quality, pixel-ratio limits and the Beyond arrangement are unchanged.
- Full renderer cleanup also disposes the directional light's shadow targets.
  Hidden tabs and context loss cancel rendering and idle preparation as before.

## Measurement and limits

`tests/closing-performance-qa.py` samples a freshly built local production Worker,
in separate cold Chrome contexts at 1440×1000, 390×844 and 320×740. It records
same-origin JavaScript decoded body bytes, long-task durations, heap snapshots,
layout shifts and prepared garden count before opening, after five seconds at the
hero, and after approaching the reply room. Outputs and screenshots are written
to `/tmp/closing-performance-{before,after}.json` and `/tmp/closing-{label}-{size}.png`.
No real invitations, guest writes, production or existing local database are used.

Before this pass, initial JavaScript was **519,493 decoded bytes**. Moving the
21KB editor chunk out of that path offsets the added closing UI; the initial
final after sample was **501,966 bytes**, about **3.4% less**. This is decoded source
volume, **not** compressed network transfer or a Lighthouse score. The roughly
6.8KB gzip editor chunk is deferred, not eliminated, and total full-page code
does not decrease: the new closing and scheduling code add a small amount.

At the hero, the prepared-room probe reports **3 desktop / 2 narrow** instead of
the previous scheduler preparing every chapter. In the first single cold run,
cumulative desktop long-task time through hero idle was 468ms before and 262ms
after; narrow results were 204→192ms and 135→123ms. These are diagnostic samples,
not statistically established speedups. The final combined regression run recorded
250ms / 256ms / 454ms respectively. A subsequent closing-only run recorded
525ms / 208ms / 175ms, including a 146ms desktop task before opening: timings did
not consistently improve and should not be presented as a speedup claim.
Heap snapshots varied with garbage collection; do not claim a general heap
reduction from them. Initial layout-shift scores were unchanged; the final desktop
reply approach added about 0.010, while narrow scores stayed unchanged. The measured
minimum-height reserve reduces section movement, but is not a claim of zero CLS.
There is no measured
physical-phone frame rate, GPU timing, production CDN transfer or Core Web Vitals
claim in this pass.

MapLibre remains about 1.03MB minified / 271KB gzip and the garden about 540KB /
139KB gzip. The existing large-chunk warning remains. Artificially splitting a
library into files does not reduce the bytes needed to use it, so the warning
was not silenced by arbitrary chunking or a raised warning threshold. Follow-up
work should use real-device CPU/GPU profiling before changing rendering quality.

## Verification

Build the application, then run the isolated production/browser checks:

```sh
rtk env CLOSING_BROWSER_QA=1 REPLY_BROWSER_QA=1 GIFT_BROWSER_QA=1 npm run test:integration
```

Use `CLOSING_QA_PYTHON`, `REPLY_QA_PYTHON`, `GIFT_QA_PYTHON` and `PYTHONPATH` when
Playwright is installed in a separate runtime. For a before sample use
`PERF_LABEL=before` on the unmodified baseline build. Do not rebuild while the
production QA Worker is running; it serves that build's hashed assets.

The closing test covers density caps, EN/ID, reduced motion, envelope reopening,
draft preservation, failed-chunk recovery and post-wedding copy. Existing
RSVP/postcard and gift tests retain feature-gate, failure, privacy and reservation
checks. `tests/cinematic-hero-qa.py` retains the original Beyond visual baseline
and its exact content/asset checks. Unit tests cover viewport preparation and
reverse/jump behavior. All existing forms and navigation remain native and usable.

No commit, push or deployment is part of this pass.
