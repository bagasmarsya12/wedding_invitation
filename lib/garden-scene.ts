import * as THREE from "three";

// Botanical forms are curved meshes, not enlarged raster cutouts. Units are CSS pixels.
// A single canvas serves the chapters; only the visible chapter groups are drawn.
type Kind = "leaf" | "petal" | "stem" | "heart" | "bud";
type Species = "combretum" | "orchid" | "cosmos" | "wisteria" | "fern";
type Instance = { matrix: THREE.Matrix4; color: THREE.Color; anchor: number[] };
type Bounds = { left: number; top: number; width: number; height: number };
type Chapter = { element: HTMLElement; group: THREE.Group; top: number; height: number; safe: Bounds[] };
const KINDS: Kind[] = ["stem", "leaf", "bud", "petal", "heart"];
const Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function random(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function blade(petal: boolean) {
  const rows = petal ? 14 : 18, cols = 8;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const side = j / cols * 2 - 1;
      const width = Math.pow(Math.sin(Math.PI * t), petal ? .85 : .78) * (petal ? .27 : .255);
      const x = side * width * (1 + .015 * Math.sin(t * 22) + .035 * Math.sin(t * 7 + side));
      const z = petal
        ? .17 * Math.sin(t * Math.PI) - .19 * t * t + .12 * side * side * Math.sin(t * Math.PI)
        : .065 * Math.sin(t * Math.PI) - .055 * Math.pow(Math.abs(side), 1.7) * Math.sin(t * Math.PI) + .12 * t * t;
      positions.push(x, t, z); uv.push(j / cols, t);
      if (i < rows && j < cols) {
        const a = i * (cols + 1) + j, b = a + cols + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function mountGarden(host: HTMLDivElement): () => void {
  const parent = host.parentElement;
  if (!parent) return () => {};
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch { return () => {}; }
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.renderer = "procedural-botanical-garden";
  host.appendChild(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff8e4, 0x3c5140, 2.7));
  const sun = new THREE.DirectionalLight(0xfff3d8, 1.6);
  sun.position.set(-250, 450, 800); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc6d3c2, .65);
  fill.position.set(400, -80, 200); scene.add(fill);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 3000);
  camera.position.z = 1400;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = matchMedia("(pointer: coarse)");
  const uniforms = {
    uGardenTime: { value: 0 }, uGardenMotion: { value: media.matches ? 0 : 1 },
    uGardenViewport: { value: new THREE.Vector2(1, 1) },
    uGardenSafe: { value: Array.from({ length: 12 }, () => new THREE.Vector4(-10, -10, -9, -9)) },
    uGardenSafeCount: { value: 0 }, uGardenNight: { value: 0 },
  };

  function material(kind: Kind) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: kind === "leaf" ? .81 : .88, metalness: 0,
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        attribute vec4 gardenAnchor;
        uniform float uGardenTime;
        uniform float uGardenMotion;
        varying vec2 vGardenUv;
      `).replace("#include <uv_vertex>", "#include <uv_vertex>\nvGardenUv = uv;")
        .replace("#include <project_vertex>", `
          vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
          float angle = sin(uGardenTime * .42 + gardenAnchor.z) * .009 * uGardenMotion;
          vec2 relative = mvPosition.xy - gardenAnchor.xy;
          mvPosition.xy = gardenAnchor.xy + mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * relative;
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;
        `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        uniform vec2 uGardenViewport;
        uniform vec4 uGardenSafe[12];
        uniform int uGardenSafeCount;
        uniform float uGardenNight;
        varying vec2 vGardenUv;
      `).replace("#include <color_fragment>", `#include <color_fragment>
        ${kind === "leaf" ? `
          float midrib = 1.0 - smoothstep(.006, .024, abs(vGardenUv.x - .5));
          float ribs = abs(fract(vGardenUv.y * 10.0 - abs(vGardenUv.x - .5) * 3.8) - .5);
          float veins = 1.0 - smoothstep(.015, .075, ribs);
          float mottling = sin(vGardenUv.x * 137.0 + sin(vGardenUv.y * 87.0)) * .025;
          diffuseColor.rgb *= .81 + .2 * midrib + .105 * veins + mottling;
        ` : kind === "petal" ? `
          float ribs = sin((vGardenUv.x-.5) * 37.0 / (.28 + vGardenUv.y));
          diffuseColor.rgb *= .93 + .055 * ribs + .055 * vGardenUv.y;
        ` : ""}
        vec2 screen = vec2(gl_FragCoord.x / uGardenViewport.x, 1.0 - gl_FragCoord.y / uGardenViewport.y);
        float safe = 1.0;
        for (int i = 0; i < 12; i++) {
          if (i >= uGardenSafeCount) break;
          vec4 box = uGardenSafe[i];
          vec2 outside = max(box.xy - screen, screen - box.zw);
          safe = min(safe, smoothstep(-.006, .028, max(outside.x, outside.y)));
        }
        float edge = 1.0 - smoothstep(.07, .30, min(screen.x, 1.0 - screen.x));
        diffuseColor.a *= mix(.07 + uGardenNight * .16, .94, safe) * mix(.52, 1.0, edge);
      `);
    };
    mat.customProgramCacheKey = () => `garden-${kind}`;
    return mat;
  }
  const materials = Object.fromEntries(KINDS.map(kind => [kind, material(kind)])) as Record<Kind, THREE.MeshStandardMaterial>;
  const geometries: Record<Kind, THREE.BufferGeometry> = {
    leaf: blade(false), petal: blade(true), stem: new THREE.CylinderGeometry(1, 1, 1, 5),
    heart: new THREE.SphereGeometry(1, 8, 6), bud: new THREE.SphereGeometry(1, 8, 8),
  };
  const colors = {
    leaf: ["#344f2b", "#526b35", "#667a3e", "#405e32", "#738546"],
    flower: ["#fff8e5", "#f4d4cc", "#d9869b", "#b63662", "#e7abb5", "#f5eee0"],
  };
  let chapters: Chapter[] = [], frame = 0, resizeFrame = 0, width = 1, height = 1, disposed = false;
  let lastDraw = 0, dirty = true, animationOrigin = performance.now(), contextUnavailable = false;

  function makeChapter(element: HTMLElement, index: number) {
    const rect = element.getBoundingClientRect();
    const w = rect.width, h = rect.height, mobile = w < 721;
    const rng = random(720 + index * 183);
    // Beyond retains its original seed, geometry, palette and arrangement.
    const habitat: Species = ({ profiles: "orchid", archive: "fern", rsvp: "cosmos", "useful-bits": "orchid", gifts: "cosmos", "leave-a-mark": "wisteria" } as Record<string, Species>)[element.id] || "combretum";
    const group = new THREE.Group();
    const pool: Record<Kind, Instance[]> = { stem: [], leaf: [], bud: [], petal: [], heart: [] };
    const scale = mobile ? .65 : Math.min(1.1, w / 1200);
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), size = new THREE.Vector3();
    const transform = new THREE.Matrix4();
    let anchor = [0, 0, 0, 0];
    function add(kind: Kind, p: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3, color: string) {
      transform.compose(p, q, s);
      pool[kind].push({ matrix: transform.clone(), color: new THREE.Color(color), anchor: [...anchor] });
    }
    function stem(a: THREE.Vector3, b: THREE.Vector3, radius: number, color = "#6c7546") {
      const delta = b.clone().sub(a);
      position.copy(a).add(b).multiplyScalar(.5);
      rotation.setFromUnitVectors(Y, delta.clone().normalize());
      size.set(radius, delta.length(), radius);
      add("stem", position, rotation, size, color);
    }
    function flower(center: THREE.Vector3, radius: number, color: string, species: Species = "combretum") {
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - .5) * .8, (rng() - .5) * .7, rng() * TAU));
      if (species === "orchid") {
        for (let p = 0; p < 5; p++) {
          const angle = [0, 1.12, 2.42, 3.86, 5.16][p];
          const q = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle));
          const broad = p === 1 || p === 4;
          add("petal", center, q, new THREE.Vector3(radius * (broad ? 1.85 : .9), radius * (broad ? .88 : 1.12), radius), "#fff9e7");
        }
        const lip = center.clone().add(new THREE.Vector3(0, -radius * .08, radius * .18));
        add("petal", lip, new THREE.Quaternion().setFromEuler(new THREE.Euler(.25, 0, Math.PI)), new THREE.Vector3(radius * 1.2, radius * .55, radius * 1.3), "#dec58c");
        add("heart", center.clone().add(new THREE.Vector3(0, 0, radius * .22)), new THREE.Quaternion(), new THREE.Vector3(radius * .12, radius * .09, radius * .09), "#893d50");
        return;
      }
      if (species === "cosmos" || species === "wisteria") {
        const count = species === "cosmos" ? 8 : 3;
        for (let p = 0; p < count; p++) {
          const q = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p * TAU / count));
          add("petal", center, q, new THREE.Vector3(radius * (species === "cosmos" ? 1.4 : 1.7), radius, radius * 1.5), color);
        }
        add("heart", center.clone().add(new THREE.Vector3(0, 0, 3 * scale)), tilt, new THREE.Vector3(radius * .2, radius * .2, radius * .12), species === "cosmos" ? "#cba44c" : "#f1ddb0");
        return;
      }
      for (let p = 0; p < 5; p++) {
        const q = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p * TAU / 5 + (rng() - .5) * .12));
        add("petal", center, q, new THREE.Vector3(radius * (.86 + rng() * .18), radius, radius), color);
      }
      add("heart", center.clone().add(new THREE.Vector3(0, 0, 2.5 * scale)), new THREE.Quaternion(), new THREE.Vector3(radius * .105, radius * .105, radius * .07), "#a1a15c");
      for (let a = 0; a < 3; a++) {
        const tip = center.clone().add(new THREE.Vector3(Math.cos(a * 2.1) * radius * .16, Math.sin(a * 2.1) * radius * .16, 3 * scale));
        add("heart", tip, new THREE.Quaternion(), new THREE.Vector3(.48, .48, .45).multiplyScalar(scale), "#eee5b0");
      }
    }
    function shrub(edge: number, y: number, direction: number, amplitude = 1, species: Species = habitat) {
      const root = new THREE.Vector3(edge, -y, -35 + rng() * 15);
      anchor = [root.x, root.y, rng() * TAU, 0];
      const extent = scale * amplitude;
      for (let b = 0; b < (species === "fern" ? 3 : 4); b++) {
        const reach = (100 + b * 34 + rng() * 45) * extent;
        const rise = (b % 2 ? -1 : 1) * (55 + rng() * 130) * extent;
        const end = root.clone().add(new THREE.Vector3(direction * reach, rise, 15 + rng() * 35));
        const curve = new THREE.CubicBezierCurve3(root,
          root.clone().add(new THREE.Vector3(direction * reach * .28, rise * .05, 0)),
          end.clone().add(new THREE.Vector3(-direction * reach * .25, -30 * extent, -8)), end);
        for (let n = 0; n < 9; n++) stem(curve.getPoint(n / 9), curve.getPoint((n + 1) / 9), (1.35 - n * .09) * extent);
        for (let n = 1; n < (species === "fern" ? 6 : 9); n++) {
          const t = n / (species === "fern" ? 7 : 10), origin = curve.getPoint(t), tangent = curve.getTangent(t);
          for (const side of [-1, 1]) {
            const angle = Math.atan2(tangent.y, tangent.x) - Math.PI / 2 + side * (.75 + rng() * .45);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - .5) * .85, (rng() - .5) * .65, angle));
            const length = (32 + rng() * 24) * extent * (1 - t * .2);
            const leafOrigin = origin.clone().add(new THREE.Vector3(0, 0, 6 + rng() * 6));
            if (species === "fern") {
              const axis = Y.clone().applyQuaternion(q);
              const tip = leafOrigin.clone().addScaledVector(axis, length * 1.65);
              stem(leafOrigin, tip, .45 * extent);
              for (let pinna = 1; pinna < 9; pinna++) {
                const joint = leafOrigin.clone().lerp(tip, pinna / 10);
                for (const wing of [-1, 1]) {
                  const pinnaQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), wing * 1.05));
                  const l = length * .40 * Math.sin(pinna / 10 * Math.PI);
                  add("leaf", joint, pinnaQ, new THREE.Vector3(l * .52, l, l), colors.leaf[(pinna + b) % colors.leaf.length]);
                }
              }
            } else {
              const slender = species === "orchid" ? .40 : species === "cosmos" ? .33 : .8;
              add("leaf", leafOrigin, q, new THREE.Vector3(length * (slender + rng() * .2), length * (species === "orchid" ? 1.38 : 1), length), colors.leaf[Math.floor(rng() * colors.leaf.length)]);
            }
          }
        }
        const blossoms = species === "fern" ? 0 : species === "orchid" ? 7 : species === "cosmos" ? 8 : species === "wisteria" ? 22 : mobile ? 10 : 14;
        for (let f = 0; f < blossoms; f++) {
          const phi = f * 2.39996 + b, spread = Math.sqrt((f + .5) / blossoms) * 40 * extent;
          const p = end.clone().add(new THREE.Vector3(Math.cos(phi) * spread, Math.sin(phi) * spread * .85 - f * extent * 1.35, 12 + rng() * 16));
          if (species === "wisteria") {
            p.x = end.x + Math.cos(phi) * (27 - f * .8) * extent;
            p.y = end.y - f * 6 * extent;
            const joint = new THREE.Vector3(end.x, p.y, end.z);
            stem(f ? new THREE.Vector3(end.x, p.y + 6 * extent, end.z) : end, joint, .5 * extent);
            stem(joint, p, .35 * extent);
          } else stem(end, p, .42 * extent, "#968f5b");
          if (species === "combretum") {
            flower(p, (10 + rng() * 6.5) * extent, colors.flower[Math.floor(rng() * colors.flower.length)]);
            continue;
          }
          const base = species === "orchid" ? 18 : species === "cosmos" ? 17 : 10;
          const tint = species === "wisteria" ? ["#b8a1c7", "#ddd0df", "#9875ad"][f % 3]
            : species === "cosmos" ? (element.id === "gifts" ? ["#eed596", "#f9e7bf", "#dbaa55"] : ["#e2a2b8", "#ad426d", "#f5d5db"])[f % 3]
            : colors.flower[Math.floor(rng() * colors.flower.length)];
          flower(p, (base + rng() * 6.5) * extent * (species === "wisteria" ? 1 - f * .022 : 1), tint, species);
        }
        for (let f = 0; f < 4; f++) {
          const p = end.clone().add(new THREE.Vector3((rng() - .5) * 105 * extent, (rng() - .5) * 100 * extent, 4));
          stem(end, p, .48 * extent);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, 0, (rng() - .5) * 1.8));
          add("bud", p, q, new THREE.Vector3(1.6, 5.5, 1.5).multiplyScalar(extent), "#b95977");
        }
      }
    }
    // Local arrangements emerge from chapter edges, never a continuous vertical vine.
    const left = -w / 2 - 38 * scale, right = w / 2 + 38 * scale;
    if (element.id === "the-day") {
      shrub(left, h * .18, 1, mobile ? 1.12 : 1.6, "orchid");
      shrub(right, h * .15, -1, mobile ? 1 : 1.65, "wisteria");
      shrub(left, h * .72, 1, 1.32, "fern");
      shrub(right, h * .69, -1, 1.35, "orchid");
      shrub(left, h * .98, 1, 1.65, "combretum");
      shrub(right, h * .98, -1, 1.65, "cosmos");
      if (!mobile) { shrub(-w * .26, 0, 1, .9, "wisteria"); shrub(w * .27, 0, -1, .85, "orchid"); }
    } else if (element.id === "details") {
      shrub(right, h * .18, -1, 1.2); shrub(left, h * .85, 1, 1.1);
    } else {
      shrub(index % 2 ? left : right, Math.min(190, h * .17), index % 2 ? 1 : -1, 1.08);
      shrub(index % 2 ? right : left, Math.min(85, h * .07), index % 2 ? -1 : 1, mobile ? .68 : .86);
      shrub(index % 2 ? right : left, h * .88, index % 2 ? -1 : 1, 1.18, habitat === "fern" ? "orchid" : habitat);
      shrub(index % 2 ? left : right, h * .64, index % 2 ? 1 : -1, .84);
      if (!mobile) shrub(index % 2 ? left : right, h - 20, index % 2 ? 1 : -1, .78);
      if (h > 1300) shrub(index % 2 ? right : left, h * .39, index % 2 ? -1 : 1, .9);
      if (element.id === "beyond") { shrub(left, h * .42, 1, 1.12); shrub(right, h * .32, -1, 1.08); }
    }
    KINDS.forEach((kind, order) => {
      const instances = pool[kind], geometry = geometries[kind].clone();
      const mesh = new THREE.InstancedMesh(geometry, materials[kind], instances.length);
      const anchors = new Float32Array(instances.length * 4);
      instances.forEach((item, i) => { mesh.setMatrixAt(i, item.matrix); mesh.setColorAt(i, item.color); anchors.set(item.anchor, i * 4); });
      geometry.setAttribute("gardenAnchor", new THREE.InstancedBufferAttribute(anchors, 4));
      mesh.frustumCulled = false; mesh.renderOrder = order;
      group.add(mesh);
    });
    group.visible = false; scene.add(group);
    const selectors = "h1, h2, .v2-day-copy, :scope > header > p, .v2-archive-heading > p, .v2-gifts-heading > p, .v2-person > div, .v2-rsvp-copy, .v2-useful-list, .v2-gifts-heading > span, .v2-gift-shelf h3, .v2-gift-shelf p, .v2-text-link, .v2-mark-copy, .v2-beyond-copy";
    const safe = Array.from(element.querySelectorAll<HTMLElement>(selectors)).slice(0, 12).map(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top + window.scrollY, width: box.width, height: box.height };
    });
    return { element, group, top: rect.top + window.scrollY, height: h, safe };
  }

  function clearChapters() {
    for (const chapter of chapters) {
      chapter.group.traverse(object => { if (object instanceof THREE.InstancedMesh) { object.geometry.dispose(); object.dispose(); } });
      scene.remove(chapter.group);
    }
    chapters = [];
  }
  function measure() {
    if (disposed) return;
    width = document.documentElement.clientWidth; height = window.innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse.matches ? 2 : 2.5));
    renderer.setSize(width, height);
    renderer.getDrawingBufferSize(uniforms.uGardenViewport.value);
    camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
    clearChapters();
    chapters = Array.from(parent!.querySelectorAll<HTMLElement>(":scope > .v2-scene")).map(makeChapter);
    dirty = true; schedule();
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || document.hidden || contextUnavailable) return;
    const scroll = window.scrollY;
    const visible = chapters.filter(chapter => chapter.top < scroll + height && chapter.top + chapter.height > scroll);
    if (dirty || now - lastDraw > 1000 / 30) {
      renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
      uniforms.uGardenTime.value = (now - animationOrigin) / 1000;
      for (const chapter of visible) {
        const top = chapter.top - scroll;
        const start = Math.max(0, top), end = Math.min(height, top + chapter.height);
        renderer.setScissor(0, height - end, width, end - start);
        chapter.group.position.y = height / 2 - top;
        chapter.group.visible = true;
        uniforms.uGardenNight.value = chapter.element.id === "beyond" ? 1 : 0;
        uniforms.uGardenSafeCount.value = chapter.safe.length;
        chapter.safe.forEach((box, i) => uniforms.uGardenSafe.value[i].set(box.left / width, (box.top - scroll) / height, (box.left + box.width) / width, (box.top + box.height - scroll) / height));
        renderer.render(scene, camera);
        chapter.group.visible = false;
      }
      parent!.classList.add("has-garden-renderer");
      dirty = false; lastDraw = now;
    }
    if (!media.matches && visible.length) schedule();
  }
  function schedule() { if (!frame && !disposed && !document.hidden && !contextUnavailable) frame = requestAnimationFrame(draw); }
  function scroll() { dirty = true; schedule(); }
  function resize() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(measure); }
  function motion() { uniforms.uGardenMotion.value = media.matches ? 0 : 1; dirty = true; schedule(); }
  function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { animationOrigin = performance.now(); scroll(); } }
  function contextLost(event: Event) { event.preventDefault(); contextUnavailable = true; parent!.classList.remove("has-garden-renderer"); cancelAnimationFrame(frame); frame = 0; }
  function contextRestored() { contextUnavailable = false; measure(); }
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);
  addEventListener("scroll", scroll, { passive: true }); addEventListener("resize", resize, { passive: true });
  addEventListener("wedding-language-change", resize);
  document.addEventListener("visibilitychange", visibility); media.addEventListener("change", motion);
  const observer = new ResizeObserver(resize);
  parent.querySelectorAll(":scope > .v2-scene").forEach(element => observer.observe(element));
  measure();
  return () => {
    disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); observer.disconnect();
    removeEventListener("scroll", scroll); removeEventListener("resize", resize); document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", motion);
    removeEventListener("wedding-language-change", resize);
    canvas.removeEventListener("webglcontextlost", contextLost); canvas.removeEventListener("webglcontextrestored", contextRestored);
    clearChapters(); KINDS.forEach(kind => { geometries[kind].dispose(); materials[kind].dispose(); });
    renderer.dispose(); canvas.remove(); parent.classList.remove("has-garden-renderer");
  };
}
