# Chapter gardens
> The 2 October accent revision restores the live renderer and architecture and increases botanical volume. Incomplete public sections remain hidden. See [DESIGN-POLISH.md](DESIGN-POLISH.md) for current content readiness; earlier placeholder descriptions below are history.

The user's two recordings dated 23 September 2026 are the visual reference: the dense white, blush, and crimson blossoms surrounding **Beyond the invitation**, with overlapping foliage and a readable center. Other chapters use that abundance as background scenery. No continuous vine connects the page from top to bottom.

`app/garden-background.tsx` loads `lib/garden-scene.ts` after the envelope opens. One transparent Three.js canvas draws independently composed chapter gardens. Flowers have five curved petal meshes, centers and buds; lanceolate leaves have curved surfaces and procedural vein shading. Stems connect each leaf and flower cluster. These shapes have no raster texture resolution to enlarge.

The renderer uses instanced geometry, renders only visible chapters, and shares lighting and materials. The scene follows document scroll directly; a very small root-based sway keeps leaves and flowers attached. Animation pauses in hidden tabs. Reduced motion renders on scroll/resize only. WebGL failure or context loss preserves the HTML and existing static botanical fallback.

Text and form areas have soft clearances in the shader. The canvas never receives pointer events or enters the accessibility tree. Event details, maps, navigation, and forms remain HTML.

Existing raster cutouts are capped using their verified source width divided by device pixel ratio. For example, the Combretum climbers are only 372px and 252px wide, and the Dendrobium branch is 251px wide. A larger CSS box cannot add detail. The original images remain unmodified; the procedural garden supplies extra density around them.

Sources: project-provided botanical artwork and newly authored geometry. Implementation references: [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh), [WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer).

## Garden rooms and language (September 23, next pass)

The opening chapter now uses a luminous architectural arch and a large centered couple signature, with date, venue, times and RSVP in the same view. Chapter order remains unchanged. New procedural accents are botanical interpretations, not scientifically exact species models:

- Opening: mixed white orchids, lavender pendants, fern fronds and pink open flowers.
- Details: the established flowering branches.
- Profiles: broad white orchid petals with contrasting lips and slender leaves.
- Archive: compound fern fronds, with a white flowering accent at the opposite edge.
- RSVP: eight-petal pink cosmos-like blooms with gold centers.
- Useful information: white flowering foliage.
- Gifts: soft gold and ivory open flowers.
- Guest marks: hanging lavender racemes.
- Beyond: original Combretum arrangement, random sequence, palette, materials and CSS retained. Only authored text gains translation.

All existing raster density limits and geometry instancing remain. Ferns use fewer main branches to bound vertex cost. The renderer remeasures translated content after language changes without rebuilding the React invitation or resetting form input.

## Conservatory pass — September 29

The hero is now an ivory aperture inside three architectural frames, with a moss-green exterior, low stone steps and a rooted meadow. The archive is a forest-green room so its paper objects read as collected objects, not another pale grid. Portrait placeholders remain explicitly placeholders; their frames echo the architecture without inventing personal imagery.

- Added low-poly, tapered grass ribbons, upright flowering stems, and mixed fern accents. All are locally authored geometry; no new third-party assets or raster enlargement.
- Plants carry a root-level depth value. Scroll changes their lateral scale and vertical offset; pointer response and a small elastic bend give near plants more movement. Stems, flowers and leaves share their root deformation. Ferns no longer carry flowering buds.
- `lib/garden-journey.ts` gives selected architectural layers, portrait frames and archive cards damped, scroll-linked movement. Document scrolling remains native; headings and forms do not zoom. Mobile movement is reduced to 40%. Card flips retain their own transform.
- No motion attributes are attached to Beyond or the envelope. Beyond's existing plants retain depth zero and their original seed/composition. No continuous vertical vines were added.
- Geometry is reused for viewport-height-only changes; it regenerates only when a chapter's width or height changes. DPR is capped at 2 for fine pointers and 1.5 for coarse pointers. Instancing, visible-chapter drawing, lazy Three.js import, hidden-tab pause, static fallback and reduced-motion remain in place.
- Moving scenery updates at animation-frame cadence while scrolling/settling. Slow idle wind is scheduled at approximately 12fps, with no continuously running idle animation-frame loop. Hardware-specific mobile performance still needs real-device verification; headless frame samples are diagnostic, not a universal frame-rate guarantee.

Visual smoke: `tests/garden-visual-qa.py`, with `GARDEN_QA_URL` pointing to the local preview. It opens the public invitation and checks all nine sections at 1440px, 390px and 320px, archive flipping, language switching without losing form state, reduced motion and a simulated context-loss fallback. It never submits guest data.

`lib/invitation-copy.ts` contains authored EN-to-ID interface copy. The header language control persists only a two-letter preference in versioned local storage. Blocked storage is non-fatal. The document language updates for assistive technology. The envelope, invitation, built-in archive story, gift interface and postcard interface share the preference. Names, guest contributions and future user-authored archive stories remain in their original language. No translation API receives guest data.

## Usability and runtime audit — September 30

- Only nearby chapter gardens are constructed immediately. The remaining chapters hydrate one at a time in idle callbacks; scrolling into an unbuilt chapter constructs it on demand. Hidden tabs also cancel queued hydration.
- Useful information and gifts are calmer intervals, with fewer procedural plants. Mobile archive and gift shelves scroll horizontally instead of stretching the invitation with empty placeholders. All nine chapters remain; the envelope and Beyond composition are unchanged.
- Header Info includes direct links to practical and personal sections. Controls have 44px touch targets. Site-state flags govern RSVP, gift links and the postcard editor, and remain closed until state loads successfully.
- `app/postcard-wall.tsx` is shared by public and private invitations. The inline horizontal wall shows three rows by four columns on desktop, two rows by three columns on mobile. It requests successive keyset-paginated pages as the reader approaches the end; the window is not an overall postcard cap. Only approved public marks appear. There is no separate “See every postcard” link.
- Tapping a postcard opens a full-sized native dialog, with Escape, body scroll locking and focus restoration. Each public drawing is lazy-loaded as an image, not embedded in the JSON payload.
- Private drawing previews stream from the guest-scoped image endpoint. Ownership is checked before retrieving the R2 object; pending drawings remain private and rejected drawings are not served.
- `.node-version` pins Node 22.13.0 to match the supported tooling baseline.

Regression checks: `tests/invitation-audit-qa.py` uses browser-only postcard fixtures and verifies grid dimensions, pagination, reader focus, closed-state language and section overflow at 1440px, 390px and 320px. `tests/http-flow.integration.mjs` runs against an isolated local worker database and verifies private drawing ownership, moderation and public pagination alongside the RSVP and gift flows. Neither test writes to production guest data.

## Postcard reader — September 30

The envelope redesign was explicitly reverted: the original envelope and its opening motion remain. The swipe request applies to guest postcards, not the invitation opening.

- `app/postcard-reader.tsx` is a native modal with a physical paper stack. Mouse/touch swipes, Previous/Next buttons and keyboard arrows browse approved cards without liking, dismissing or changing them. Pages load near the end of the stack.
- Motion uses transforms and opacity through the Web Animations API, starting at the actual dragged position. Short or cancelled drags settle back; reduced motion changes cards immediately. Vertical gestures still scroll long messages.
- Saved styles, fonts, original messages and drawings are retained. In the expanded reader, artwork and text have separate areas, and airmail borders leave room for the signature. Thumbnails align cleanly and preview drawings without text covering the artwork.
- Frame inset and text padding share fixed-distance CSS tokens, rather than mixing a percentage frame with fixed mobile padding. Text keeps at least 15px of clearance inside the frame; the competing full-width signature rule is removed. Paper texture is quieter, botanical accents stay in the lower-right margin, and short landscape viewports scroll the reader instead of squeezing its content.
- Escape/Close and backdrop dismissal unlock page scrolling and restore focus to the original card. The native dialog contains keyboard focus; card changes announce the author and position.
- The wall remains 3×4 desktop / 2×3 mobile. The editor, API and guest data are unchanged by this reader pass.

`tests/postcard-reader-qa.py` intercepts browser-only fixtures to check selected-card entry, mouse and actual browser touch swipes, vertical text scrolling, message/art separation, airmail signatures, pagination, final-card boundaries, Escape and focus restoration at 1440px, 390px and 320px. Optional `POSTCARD_REAL_PREVIEW=1` captures the existing first public card without submitting any data.

`tests/postcard-spacing-qa.py` checks all five paper styles with all three saved font choices on desktop, mobile, small mobile and landscape. It verifies frame clearance, signature spacing, a readable message area and unchanged guest text. Fixtures are intercepted in the browser only.

## Walking into our garden — hero prototype, September 30

This pass is deliberately limited to the first garden room and its exit into Details. The envelope, Beyond composition, section order, invitation content and practical interactions remain unchanged.

- The hero now uses a perspective camera, three locally authored extruded arch frames and separated near/middle/far plant layers. Scroll advances the camera through the threshold; every other chapter retains the existing orthographic renderer.
- Initial projection is compensated to preserve the readable composition. The arch geometry is an open U, not a closed frame with a bottom bar. The rooted foreground meadow stays low, particularly along the central path.
- A directional light casts real geometry shadows onto a transparent paper receiver. Leaves share the rooted wind deformation in their visible and depth shaders. Lighting is restored before rendering other chapters.
- Wedding names, date, venue and CTAs remain normal HTML with native scrolling. Only scenery receives the camera dolly and light drift. A short background fade bridges the first room into Details; no scroll hijacking or delayed access to information.
- Mobile dolly distance is smaller. Hero idle rendering is capped at 24fps on coarse pointers / 30fps otherwise; the existing 12fps idle cap remains elsewhere. Scrolling uses animation-frame cadence, hidden tabs pause, and reduced motion disables camera travel and time-based movement. Existing fallback remains available.
- No new third-party assets or libraries: all architecture and botanical depth are authored with the installed Three.js. No private data is used by the visual system.

`tests/hero-passage.test.mjs` verifies bounded, reversible and reduced-motion travel. `tests/garden-portal.test.mjs` raycasts the center pathway on mobile/desktop to prevent the bottom-crossbar regression. `tests/cinematic-hero-qa.py` checks perspective activation, stable HTML copy, directions, WebGL shader errors, reduced motion and a pixel comparison against the pre-pass Beyond screenshot at 1440px, 390px and 320px. Visual and interaction checks are read-only; physical-device GPU performance still requires real-device validation.

### Hero correction — stationary threshold and grounded plants

The prototype's layered arches and dolly were rejected after visual review. They are replaced with one open sculpted arch, a fixed perspective camera, and a chapter-sized rendering viewport that follows the document. This matters: moving a 3D group past a viewport-centered camera sends different depth planes upward at different speeds, even without zoom. The new projection makes every depth plane scroll with the hero surface instead. Real depth, rooted wind and slowly shifting sunlight remain.

Paper, the fallback arch and stone steps no longer receive independent scroll scaling or translation. The redundant inner paper outline is removed. Wedding Details and RSVP buttons are removed from the hero only; the existing Continue cue and header Info links still reach Details and RSVP. No form, section, guest data, envelope or Beyond composition is removed.

The read-only cinematic test now samples a meadow root through the actual camera projection and renderer viewport. Its document-space position must stay within 2px while scrolling both down and up, with or without reduced motion. The pre-fix version failed this check at the first 150px step (1150.736px → 1142.408px). The same test verifies absent hero CTAs, header access, Maps, no shader errors and the unchanged Beyond screenshot. The portal unit test now requires exactly one open arch.

### Draped elliptical gateway — revised layering

The user approved layering again, with a redesigned shape and drapery/floral treatment. Three progressively finer elliptical frames now have explicit crown/column clearances, sage–chalk colors and separate depth planes. Only the outer frame casts an architectural shadow, avoiding repeated dark hoops across the invitation. The stationary room-sized projection is retained: no camera dolly, independent paper scaling or accelerated foreground scrolling returns.

Two ivory cloth meshes have sculpted pleats, narrow gathered waists and asymmetrical lengths. Each point of the upper hem attaches to the outer elliptical curve; the cloth remains outside the readable center. There are no raster textures or enlarged image cutouts. Each cloth mesh has 1,525 vertices and owns its geometry/material for normal chapter cleanup.

A connected stem follows the same outer arch profile, with restrained orchid/Combretum-inspired flowers and lanceolate leaves. The left shoulder is fuller, the right is lighter, and gaps prevent a solid decorative halo. Flowers and foliage use the existing instanced plant material and rooted wind deformation; they are atmospheric botanical interpretations, not personal memories or exact species specimens.

The revised portal unit test requires three separated crowns/columns, two finite, bounded cloth meshes, an unobstructed center and an open base at 1440px, 390px and 320px. Cinematic checks continue to cover grounded forward/reverse scrolling, hidden hero CTAs, header access to Details/RSVP, reduced motion, WebGL errors and the unchanged Beyond composition. The envelope and all practical functionality remain untouched. No third-party assets or new libraries were introduced.

### Threshold into The Details

The next pass keeps the approved gateway and the current Details layout. A stationary floor-colored overlay softens the cut at the base of the garden; the top of Details uses the same sage color at the seam. It does not move plant roots, add a new section or delay practical information.

`public/assets/authored/destination-canopy-shadow.svg` is a locally authored scalable foliage silhouette for projected-light atmosphere, not a personal object or scientifically exact specimen. A low-opacity, softly masked shadow falls over the paper margin. `lib/destination-light.ts` drives only the light/shadow offset, capped at ±16px desktop and ±8px mobile. It shares the existing damped passive-scroll scheduler in `garden-journey.ts`, updates only near the Details room, pauses in hidden tabs and resets under reduced motion. Paper, headings, event card and map never inherit this movement. Two thin backing edges reinforce the physical paper depth without changing dimensions.

`tests/destination-transition-qa.py` verifies asset loading, bounded light, unchanged document-space bounds for the paper/header/event card/map through forward/reverse scroll, unobstructed map buttons, directions, reduced motion and no horizontal overflow at 1440px, 390px and 320px. It is read-only and does not submit forms. The cinematic test retains the grounded-foreground and pixel-based Beyond comparison. Maps implementation, copy, section order, envelope and guest functionality are unchanged.

### Profiles — paired editorial folio

The approved next pass changes only Profiles. `app/profiles.css` is scoped to `.v2-profile-folio`: a compact opening, alternating portrait/copy spreads on desktop, portrait-first vertical reading below 900px, larger names and a slim monogram seam. Both people and all three observation fields remain. Repeated names/placeholder sentences are reduced; no personal facts, photos or quotations are invented. New labels have EN/ID translations. The large B and I are typographic placeholders, not portraits or a replacement for the identity mark.

Two stationary photo-print frames replace the old floating arches. Sage and dusty-rose windows use the existing locally authored vector shadow and a low-opacity light band. Only the shadow/light offset follows the shared passive-scroll scheduler, bounded to ±12px desktop / ±6px mobile; portrait, caption and copy never move independently. Reduced-motion CSS immediately disables the offsets; the existing hidden-tab pause and cleanup are retained. Portraits are also protected by the Three.js readability masks. Profiles now has two smaller fern/orchid edge arrangements instead of generic meadow/extra shrubs; other chapters' recipes are unchanged.

The existing Dendrobium short branch and Melastoma full stem attach to the lower print margins. Their CSS widths are capped by native pixel width divided by the existing screen-density variable, so they cannot be enlarged past source resolution. They have no independent floating animation. The Iga placeholder label sits above the taller pink stem to keep text unobstructed, including at 320px.

`tests/profiles-qa.py` checks alternating/stacked layout, full-width 4:5 portrait windows, all six fields, native-density asset limits, stationary forward/reverse scrolling, bounded light, bilingual labels, no horizontal overflow, reduced motion and WebGL-loss fallback at 1440px, 820px, 390px and 320px. It is read-only and does not submit forms. The portrait-window check failed before explicit width sizing (180px window inside a 384px print) and passes with the window filling the print. Envelope, gateway, Details/Maps, Archive, Beyond and postcard functionality remain outside this redesign.

The existing Beyond bitmap check is now explicitly a composition comparison: 12px box-averaged tiles retain the original mean color-error threshold, with separate exact checks for heading, Archive destination and the six botanical sources. The raw mobile bitmap differed by about 3/255 mean channel intensity after the upstream section-height change, despite the unchanged Beyond source/arrangement and stopped shader motion. The test does not claim pixel-identical backdrop/antialiasing output. A `data-garden-motion` read-only probe verifies that reduced motion reaches the shader as well as CSS.

### Archive — a collecting table at dusk

The homepage's three fragments now use `ArchiveTable` and the scoped `archive-scene.css`. A warm ivory-to-olive seam introduces the collecting surface. Small, uneven paper stacks, contact shadows, a sage photographic mount and a dusty-rose archival sleeve give different kinds of material distinct silhouettes. Blank mounts/sleeves are authored CSS, not fabricated photographs, handwriting or personal artifacts. The approved identity image is unchanged. No external assets, libraries or animation loops are added; the existing procedural garden remains behind the surface.

Archive sheets no longer have independent scroll parallax. Selecting a piece lifts it by only 0.6rem and fades its cover into a readable context panel; selecting another returns the first to the table. The footer action stays available to put it back. One sheet opens at a time, with `aria-expanded`, an inert hidden reading region, keyboard arrows between sheets and Escape returning focus. Long excerpts have a bounded native reading scroll. Published API entries retain their real slug and link to their existing story route; placeholders never receive invented story links. Failed images reveal an honest unavailable state instead of a broken bitmap.

Below 1000px the table becomes a native horizontal snap collection, with previous/next controls that scroll only the collection and preserve the document reading position. Interface additions have EN/ID translations. Reduced motion disables lifting/fades and makes directional browsing immediate. Existing botanical edge rasters are capped at native width divided by display density; the backdrop shadow reuses the locally authored vector. Envelope, gateway, Details/Maps, Profiles, Beyond, forms, postcards and section order remain unchanged.

`tests/archive-table-qa.py` exercises 1440px, 820px, 390px and 320px, selection/focus, grounded scrolling, horizontal browsing, bilingual copy, reduced motion, resolution caps, WebGL-loss fallback and browser-only published-entry fixtures for long text, real slugs and missing images. No database/guest writes occur. The Beyond composition test permits at most one vertical pixel of screenshot registration below the fixed header when preceding chapters change height; its color-error threshold and exact content/source checks are unchanged. Physical-device performance remains a separate validation step.

### Your reply — RSVP and postcard together, October 1

The approved simplification replaces the separate RSVP room with attendance at the top of the existing postcard studio. There are eight actual garden rooms; both `#rsvp` and `#leave-a-mark` still work from the header. Only two attendance choices remain. There is no guest-facing count, names list or special-needs question. A postcard is optional for either answer: write, draw, combine both, or save attendance alone. EN/ID copy and a clear preview-only state are provided.

The subsequent closing/performance pass adds a still paper colophon after Beyond and defers editor loading near this reply room, without deferring the existing private attendance read or unmounting drafts when scrolling away. Garden preparation/retention is bounded to nearby rooms; the original chapter seeds and Beyond artwork stay locked. See `docs/PERFORMANCE.md` for measurements, limits and reproduction instructions.

`ReplyStudio` owns private attendance and delegates postcard composition to the existing `MarkEditor`. Attendance saves first; a failed mark preserves both the saved answer and the draft. Retrying the card skips an unchanged attendance POST. Editing an existing postcard never saves an unsaved attendance change. Pending cards appear only in the owner's strip, not the public wall. Neither attendance nor legacy private notes enters a public postcard payload. RSVP and postcard feature flags remain independent; the wall remains readable when submissions close. No schema migration or deletion is needed.

The attendance-only API preserves an existing affirmative count within the current invitation limit, otherwise uses the admin's allocated places. A decline has zero places. The dashboard labels the aggregate **Expected places**, not a surveyed exact headcount. Legacy clients that supply a count remain supported. Omitted legacy names, dietary notes and private messages are preserved on updates; they never prefill a postcard. Existing authorization, same-origin checks, private cache headers, rate limits and moderation remain in place.

The visual change is scoped to the reply room: an ivory reply paper against dusty-rose/olive dusk, with the original wall to its right on desktop and below on mobile. Its existing 3×4 desktop / 2×3 mobile scrollable wall and swipe reader remain. Only confirmation has a short reveal; reduced motion disables it. Text stays below the stamp and above the signature. Canvas sizing and the date stamp initialize when the feature-gated editor actually mounts, including delayed site-state responses. The Melastoma edge asset remains source-resolution-capped and inside this room, rather than spilling into Beyond. Stable chapter identities retain the original later gardens' seeds/arrangements after merging RSVP.

`tests/reply-studio-qa.py` covers 1440px, 820px, 390px and 320px, both languages, radio-only attendance, optional writing/drawing, delayed loading, paper gutters, wall geometry and overflow. With `REPLY_BROWSER_QA=1 npm run test:integration`, the integration harness supplies an isolated ephemeral Worker/DB and launches the browser suite against a fixture invitation. Browser mutations are intercepted; backend integration assertions use only the harness's temporary database. Cases include RSVP-only, cleared paper, declined-with-message, drawing-only, rapid double clicks, partial success/retry, editing, independent feature flags, persisted declines and failed-load recovery. No real guest or production data is written.

The cinematic regression keeps the original Beyond baselines and error limit. At 320px only, its comparison masks the 64×50px upper-right corner containing the **previous room's** old Melastoma tip, not Beyond artwork. A separate bounds assertion requires the current specimen to stay outside Beyond. Everything else remains compared with the same one-pixel registration limit, along with exact heading, destination, six sources and reduced-motion checks. This is a scoped composition regression, not a pixel-identical whole-boundary claim.

### Gifts — a small collection cabinet, October 1

The homepage Gifts room now presents three physical alcoves: sage for Bagas, dusty rose for Iga and limestone for the home. Different silhouettes, stationary plinths and contact shadows replace repeated text panels. Empty displays honestly say that the collection is still being chosen; no wishlist products, photographs or personal objects are invented. Existing CMS heading/caption literals remain available. Category links open the authorized private catalogue directly at the selected collection; closed gift flags render non-interactive mounts.

`app/gift-gallery.css` is scoped to the Gifts room, private catalogue and public invitation gate. The locally authored destination canopy vector supplies softly projected light, not a new asset or rendering loop. `garden-journey.ts` shares the existing passive-scroll scheduler and bounds only light/shadow travel to ±16px desktop / ±8px mobile; shelving, text and objects retain their document positions. Hover or keyboard focus lifts the small paper ticket, not the entire display. Reduced motion disables offsets and transitions. Mobile uses native horizontal snap browsing with a visible instruction; catalogue tabs support Arrow keys, Home and End.

The private catalogue uses the same visual architecture with actual source photographs resting on their plinths. Image width is capped to native pixels divided by screen density, with no multiply recoloring. Missing photographs have an honest unavailable/awaiting-photo state. The existing botanical edge assets remain source-density-capped and inside the room. No third-party assets or libraries are introduced.

Reservation, release and purchased actions retain the existing guest-scoped API contract and authorization. Distinct loading/error/empty states, retry/refresh controls and a synchronous pending guard prevent misleading empty shelves and duplicate submissions. Private shipping information and purchase links are shown only from the authorized server response; a failed mutation does not erase already authorized delivery details. Clipboard denial has a manual-copy instruction. The public `/gifts` gate does not request private inventory. New interface copy has EN/ID translations; real product titles/descriptions remain unchanged.

`tests/gift-collections.test.mjs` verifies category whitelisting. With `GIFT_BROWSER_QA=1 npm run test:integration`, the isolated Worker/DB harness runs `tests/gifts-scene-qa.py` against a fixture invitation. Browser writes are intercepted; real backend assertions operate only on the ephemeral database. Checks cover 1440px, 820px, 390px and 320px, source-density caps, image/plinth grounding, stationary scrolling, bounded light, native shelf browsing, keyboard tabs, language switching, reduced motion, loading/retry, closed flags, reserve/release/purchased states, rapid double clicks, conflicts and private-information visibility. `REPLY_BROWSER_QA=1` can run the existing merged RSVP/postcard suite in the same isolated run. The unchanged Beyond composition remains covered by `tests/cinematic-hero-qa.py`. Physical-device GPU performance and the existing large-bundle warning remain separate optimization work.

### Full Archive — a room of kept material, October 1

This pass changes `/archive` and `/archive/[slug]`, not the homepage collecting table or Beyond. The public collection keeps its existing database query, publication/visibility gates, ordering, type filters and built-in identity story. No schema changes, new memories or real database writes are needed. A collection containing only the identity mark remains one honest folio rather than a set of invented personal artifacts.

`app/archive-room.css` uses the established Baskerville/sans pairing, olive tabletop, ivory folios, sage object recesses and dusty-rose paper sleeves. `archiveMaterial` maps stored types to mark, photograph/place, object, paper/conversation or audio presentations. Actual imagery is preserved without cropping or recoloring; paper material does not imitate handwriting or invent scans. The hero reuses the locally authored canopy-shadow vector and an existing source-density-capped Combretum branch. There are no additional libraries, external assets, idle motion loops or scroll hijacking.

Choosing a piece gently lifts its folio and expands its context through a reversible CSS grid transition. Only one piece opens at a time; closed regions are inert and hidden from assistive technology. Escape closes the active piece and restores focus. Long excerpts have bounded native scrolling. Original titles, excerpts, dates, locations and stories stay in their supplied language; authored controls and the existing built-in story retain EN/ID translations. Audio entries use native controls, `preload="none"` and no autoplay. Missing media has an honest unavailable state.

Reading routes use a print/caption beside the original prose on desktop, then title, material and story on mobile. A restrained process placeholder remains for the existing logo story; no sketches or memories are generated. Explicit collection-return links remount the collection and restore its filter, selected public slug, reading coordinate and keyboard focus. Versioned session storage contains only those browsing coordinates, expires after 30 minutes and validates against the current public inventory. Storage denial, stale data and removed entries fall back safely to ordinary browsing. A server-rendered `noscript` collection of the same public story links preserves direct reading without JavaScript.

`ArchiveImage` caps display width by source pixels divided by current display density. Both its mount callback and load event enforce the cap, including images already cached before hydration; failed cached images are handled as well. The logo uses the existing 1200px JPEG master rather than the 400px WebP derivative for large/retina spreads. Decorative bitmaps are not enlarged beyond their native density.

`tests/archive-collection.test.mjs` checks material mapping and validated, minimal return state. `tests/archive-room-qa.py` checks 1440px, 820px, 390px and 320px, smooth intermediate opening states, Escape/focus, filters, the unchanged logo story, bilingual copy, return coordinates, density limits, reduced motion, storage denial and overflow. With `ARCHIVE_BROWSER_QA=1 npm run test:integration`, the existing isolated Worker harness adds clearly identified ephemeral photograph/object/note/conversation/audio fixtures and verifies long text, failed/lazy images, native audio controls and exclusion of unlisted/draft records. It never writes these fixtures into the user's local or production database. The existing Gifts and RSVP/postcard browser suites can run in the same integration invocation; the original Beyond composition regression remains separate. Real-device performance and the pre-existing large-bundle warning remain outside this visual pass.
