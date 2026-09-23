# Chapter gardens

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

`lib/invitation-copy.ts` contains authored EN-to-ID interface copy. The header language control persists only a two-letter preference in versioned local storage. Blocked storage is non-fatal. The document language updates for assistive technology. The envelope, invitation, built-in archive story, gift interface and postcard interface share the preference. Names, guest contributions and future user-authored archive stories remain in their original language. No translation API receives guest data.
