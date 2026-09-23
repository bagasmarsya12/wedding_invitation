# Chapter gardens

The user's two recordings dated 23 September 2026 are the visual reference: the dense white, blush, and crimson blossoms surrounding **Beyond the invitation**, with overlapping foliage and a readable center. Other chapters use that abundance as background scenery. No continuous vine connects the page from top to bottom.

`app/garden-background.tsx` loads `lib/garden-scene.ts` after the envelope opens. One transparent Three.js canvas draws independently composed chapter gardens. Flowers have five curved petal meshes, centers and buds; lanceolate leaves have curved surfaces and procedural vein shading. Stems connect each leaf and flower cluster. These shapes have no raster texture resolution to enlarge.

The renderer uses instanced geometry, renders only visible chapters, and shares lighting and materials. The scene follows document scroll directly; a very small root-based sway keeps leaves and flowers attached. Animation pauses in hidden tabs. Reduced motion renders on scroll/resize only. WebGL failure or context loss preserves the HTML and existing static botanical fallback.

Text and form areas have soft clearances in the shader. The canvas never receives pointer events or enters the accessibility tree. Event details, maps, navigation, and forms remain HTML.

Existing raster cutouts are capped using their verified source width divided by device pixel ratio. For example, the Combretum climbers are only 372px and 252px wide, and the Dendrobium branch is 251px wide. A larger CSS box cannot add detail. The original images remain unmodified; the procedural garden supplies extra density around them.

Sources: project-provided botanical artwork and newly authored geometry. Implementation references: [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh), [WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer).
