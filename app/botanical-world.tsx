"use client";

import { useEffect, useRef } from "react";

type BotanicalWorldProps = { active: boolean; reducedMotion: boolean };

/**
 * One document-space plant, viewed through a viewport-sized camera. The canvas
 * sticks while its parent spans the invitation; no section owns the vine.
 */
export function BotanicalWorld({ active, reducedMotion }: BotanicalWorldProps) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const root = shell?.parentElement;
    if (!shell || !root || !active) return;

    let disposed = false;
    let frame = 0;
    let interval = 0;
    let renderer: import("three").WebGLRenderer | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let detach: (() => void) | undefined;

    const start = async () => {
      const THREE = await import("three");
      if (disposed) return;

      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      const mobile = matchMedia("(max-width: 720px)").matches;
      const modestDevice = mobile || Boolean(saveData) || (navigator.hardwareConcurrency || 8) <= 4;
      const still = reducedMotion || Boolean(saveData);

      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: !modestDevice,
          powerPreference: "low-power",
          preserveDrawingBuffer: false,
        });
      } catch {
        return; // Existing botanical images remain as the no-WebGL composition.
      }
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, saveData ? 1 : mobile ? 1.5 : 1.6));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      shell.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
      const plant = new THREE.Group();
      scene.add(plant);
      const animated: { mesh: import("three").Object3D; phase: number; strength: number }[] = [];
      const materials: import("three").Material[] = [];
      const geometries: import("three").BufferGeometry[] = [];
      const textures: import("three").Texture[] = [];
      const textureLoader = new THREE.TextureLoader();
      const asset = (name: string) => {
        const texture = textureLoader.load(`/assets/botanicals/combretum/${name}.webp`, schedule);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() || 1, 4);
        textures.push(texture);
        return texture;
      };
      const leafTexture = asset("leaf-pair");
      const blossomTexture = asset("flower-tip");

      const disposePlant = () => {
        while (plant.children.length) plant.remove(plant.children[0]);
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        geometries.length = 0;
        materials.length = 0;
        animated.length = 0;
      };

      let width = 0;
      let viewportHeight = 0;
      let sceneHeight = 0;
      let pointerX = 0;
      let pointerY = 0;
      let lastAmbient = 0;
      let firstPaint = true;

      function schedule() {
        if (disposed || frame) return;
        frame = requestAnimationFrame(render);
      }

      function render(time: number) {
        frame = 0;
        if (!renderer || document.hidden || !width) return;
        const bounds = root!.getBoundingClientRect();
        const visible = bounds.bottom > 0 && bounds.top < innerHeight;
        if (!visible) return;

        const localScroll = Math.max(0, -bounds.top);
        const px = !still && !mobile ? pointerX * 3 : 0;
        const py = !still && !mobile ? pointerY * 2 : 0;
        camera.position.set(px, -localScroll - viewportHeight / 2 + py, 900);
        camera.lookAt(px * .25, -localScroll - viewportHeight / 2 + py * .25, 0);

        if (!still) {
          const breath = time * .00028;
          for (const { mesh, phase, strength } of animated) {
            mesh.rotation.z = Math.sin(breath + phase) * strength;
            mesh.rotation.y = Math.cos(breath * .7 + phase) * strength * .55;
          }
        }
        const progress = Math.max(0, Math.min(1, localScroll / Math.max(1, sceneHeight)));
        const warmth = new THREE.Color(0xffffff).lerp(new THREE.Color(0xf5e5d6), progress * .24);
        for (const material of materials) {
          if ("color" in material && material.color instanceof THREE.Color && material.userData.baseColor) {
            material.color.copy(material.userData.baseColor).multiply(warmth);
          }
        }
        renderer.render(scene, camera);
        if (firstPaint) {
          firstPaint = false;
          root!.classList.add("has-botanical-world");
        }
      }

      function makeCurve(points: [number, number, number][], radius: number, color: number) {
        const curve = new THREE.CatmullRomCurve3(
          points.map(([x, y, z]) => new THREE.Vector3(x - width / 2, -y, z)),
          false,
          "centripetal",
          .42,
        );
        const length = points.reduce((sum, point, index) => {
          if (!index) return 0;
          return sum + Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]);
        }, 0);
        const segments = Math.max(20, Math.ceil(length / 21));
        const sides = 5;
        const geometry = new THREE.TubeGeometry(curve, segments, radius, sides, false);
        const positions = geometry.attributes.position;
        for (let i = 0; i <= segments; i++) {
          const center = curve.getPointAt(i / segments);
          const tip = Math.min(1, (1 - i / segments) * 8);
          const root = Math.min(1, i / segments * 9);
          const taper = Math.max(.04, Math.min(tip, root));
          for (let j = 0; j <= sides; j++) {
            const index = i * (sides + 1) + j;
            positions.setXYZ(
              index,
              center.x + (positions.getX(index) - center.x) * taper,
              center.y + (positions.getY(index) - center.y) * taper,
              center.z + (positions.getZ(index) - center.z) * taper,
            );
          }
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .77 });
        material.userData.baseColor = material.color.clone();
        geometries.push(geometry);
        materials.push(material);
        plant.add(new THREE.Mesh(geometry, material));
        return curve;
      }

      function addPlane(texture: import("three").Texture, x: number, y: number, z: number, size: number, rotation: number, opacity: number, phase: number) {
        const aspect = texture === leafTexture ? 185 / 181 : 173 / 199;
        const geometry = new THREE.PlaneGeometry(size * aspect, size);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          opacity,
          side: THREE.DoubleSide,
          color: 0xffffff,
        });
        material.userData.baseColor = material.color.clone();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x - width / 2, -y, z);
        mesh.rotation.z = rotation;
        plant.add(mesh);
        geometries.push(geometry);
        materials.push(material);
        animated.push({ mesh, phase, strength: texture === leafTexture ? .012 : .017 });
      }

      function build() {
        const hero = root!.querySelector<HTMLElement>("#the-day");
        const details = root!.querySelector<HTMLElement>("#details");
        const profiles = root!.querySelector<HTMLElement>("#profiles");
        const archive = root!.querySelector<HTMLElement>("#archive");
        const rsvp = root!.querySelector<HTMLElement>("#rsvp");
        const useful = root!.querySelector<HTMLElement>("#useful-bits");
        const gifts = root!.querySelector<HTMLElement>("#gifts");
        const mark = root!.querySelector<HTMLElement>("#leave-a-mark");
        const beyond = root!.querySelector<HTMLElement>("#beyond");
        if (!hero || !details || !profiles || !archive || !rsvp || !useful || !gifts || !mark || !beyond || !renderer) return;

        const nextWidth = root!.clientWidth;
        const nextHeight = innerHeight;
        const nextSceneHeight = root!.scrollHeight;
        if (!nextWidth || !nextHeight) return;
        width = nextWidth;
        viewportHeight = nextHeight;
        sceneHeight = nextSceneHeight;
        renderer.setSize(width, viewportHeight, false);
        camera.fov = 2 * Math.atan(viewportHeight / (2 * 900)) * 180 / Math.PI;
        camera.aspect = width / viewportHeight;
        camera.updateProjectionMatrix();
        disposePlant();

        const h = hero.offsetHeight;
        const d = details.offsetHeight;
        const p = profiles.offsetHeight;
        const origin = root!.getBoundingClientRect().top;
        const top = (element: HTMLElement) => element.getBoundingClientRect().top - origin;
        const a = top(archive);
        const q = top(rsvp);
        const u = top(useful);
        const g = top(gifts);
        const m = top(mark);
        const b = top(beyond);
        const small = width <= 720;
        const x = (value: number) => width * value;
        const r = small ? 1.35 : 1.65;
        // One stem crosses every chapter. It bends toward the page instead of
        // disappearing beyond the right edge between the main compositions.
        const stem = makeCurve([
          [x(small ? .82 : .76), h * (small ? .69 : .43), -32],
          [x(small ? .85 : .8), h * (small ? .8 : .67), -14],
          [x(small ? .89 : .85), h * .94, 18],
          [x(small ? .9 : .86), h + d * .06, 4],
          [x(small ? .88 : .84), h + d * .28, -15],
          [x(small ? .9 : .86), h + d * .49, -24],
          [x(small ? .87 : .82), h + d * .72, -10],
          [x(small ? .9 : .85), h + d * .94, 11],
          [x(small ? .9 : .85), h + d + p * .04, -4],
          [x(small ? .87 : .81), h + d + p * .13, -30],
          [x(small ? .85 : .79), h + d + p * .29, -65],
          [x(small ? .85 : .85), h + d + p * .86, -75],
          [x(small ? .92 : .94), h + d + p * .96, -58],
          [x(small ? .95 : .98), a + archive.offsetHeight * .15, -48],
          [x(small ? .83 : .79), a + archive.offsetHeight * .52, -20],
          [x(small ? .87 : .83), a + archive.offsetHeight * .92, -60],
          [x(small ? .9 : .86), q + rsvp.offsetHeight * .5, -80],
          [x(small ? .82 : .88), u + useful.offsetHeight * .5, -80],
          [x(small ? .82 : .98), u + useful.offsetHeight * .94, -72],
          [x(small ? 1.06 : 1.04), g + gifts.offsetHeight * .18, -35],
          [x(small ? 1.04 : 1.02), g + gifts.offsetHeight * .34, -32],
          [x(small ? .82 : .77), g + gifts.offsetHeight * .63, -14],
          [x(small ? .88 : .84), m + mark.offsetHeight * .12, -38],
          [x(small ? .85 : .81), m + mark.offsetHeight * .84, -18],
          [x(small ? .8 : .75), b + beyond.offsetHeight * .18, -33],
          [x(small ? .7 : .65), b + beyond.offsetHeight * .37, -45],
        ], r, 0x625e45);

        const pointAtY = (targetY: number) => {
          let lo = 0;
          let hi = 1;
          for (let i = 0; i < 22; i++) {
            const mid = (lo + hi) / 2;
            if (-stem.getPoint(mid).y < targetY) lo = mid;
            else hi = mid;
          }
          return stem.getPoint((lo + hi) / 2);
        };
        const sprouts = [
          { y: h * .83, reach: .14, drop: 55 },
          { y: h + d * .16, reach: .12, drop: 65, desktopOnly: true },
          { y: h + d * .68, reach: .15, drop: -58, flower: true, desktopOnly: true },
          { y: h + d + p * .2, reach: .13, drop: 70 },
          { y: h + d + p * .44, reach: .18, drop: -70, flower: true },
          { y: h + d + p * .68, reach: .16, drop: 85 },
          { y: h + d + p * .87, reach: .17, drop: -55 },
          { y: a + archive.offsetHeight * .31, reach: .16, drop: 65, flower: true },
          { y: a + archive.offsetHeight * .62, reach: .19, drop: -70 },
          { y: a + archive.offsetHeight * .84, reach: .15, drop: 55, flower: true },
          { y: q + rsvp.offsetHeight * .3, reach: .12, drop: 55, desktopOnly: true },
          { y: q + rsvp.offsetHeight * .72, reach: .15, drop: -40 },
          { y: u + useful.offsetHeight * .42, reach: .12, drop: 60, desktopOnly: true },
          { y: u + useful.offsetHeight * .64, reach: .11, drop: 48 },
          { y: u + useful.offsetHeight * .82, reach: .14, drop: -45 },
          { y: g + gifts.offsetHeight * .42, reach: .16, drop: 55, flower: true },
          { y: g + gifts.offsetHeight * .56, reach: .13, drop: 55 },
          { y: g + gifts.offsetHeight * .65, reach: .18, drop: -55, desktopOnly: true },
          { y: g + gifts.offsetHeight * .73, reach: .14, drop: -48, flower: true },
          { y: g + gifts.offsetHeight * .83, reach: .16, drop: 65, flower: true },
          { y: m + mark.offsetHeight * (small ? .53 : .27), reach: .15, drop: -65, flower: true },
          { y: m + mark.offsetHeight * .67, reach: .16, drop: 55 },
          { y: b + beyond.offsetHeight * .17, reach: .2, drop: 80, flower: true },
          { y: b + beyond.offsetHeight * .42, reach: .22, drop: -60, flower: true },
        ];
        for (const [index, sprout] of sprouts.entries()) {
          if (small && sprout.desktopOnly) continue;
          const anchor = pointAtY(sprout.y);
          const anchorX = anchor.x + width / 2;
          const spread = width * sprout.reach * (small ? 1.12 : 1);
          const branch = makeCurve([
            [anchorX, sprout.y, anchor.z + 1],
            [anchorX - spread * .47, sprout.y + sprout.drop * .28, anchor.z + 7],
            [anchorX - spread, sprout.y + sprout.drop, anchor.z + 16],
          ], r * .47, 0x5f5a3e);
          for (let leaf = 0; leaf < 3; leaf++) {
            const point = branch.getPoint(.3 + leaf * .26);
            addPlane(
              leafTexture,
              point.x + width / 2 + (leaf % 2 ? -8 : 9),
              -point.y,
              point.z + 8,
              (small ? 30 : 39) + (index + leaf) % 3 * (small ? 4 : 6),
              leaf % 2 ? -.55 : .42,
              .73,
              index * .81 + leaf,
            );
          }
          if (sprout.flower) {
            const tip = branch.getPoint(.96);
            addPlane(blossomTexture, tip.x + width / 2, -tip.y, tip.z + 10, small ? 43 : 55, index % 2 ? -.2 : .22, .83, index * .73);
          }
        }

        const leafBands: [number, number, number, number][] = [
          [h * .71, h * .96, 3, 2],
          [h + d * .11, h + d * .94, 5, 3],
          [h + d + p * .08, h + d + p * .91, 9, 6],
          [a + archive.offsetHeight * .38, a + archive.offsetHeight * .9, 6, 4],
          [q + rsvp.offsetHeight * .17, q + rsvp.offsetHeight * .88, 3, 2],
          [u + useful.offsetHeight * .17, u + useful.offsetHeight * .86, 4, 3],
          [g + gifts.offsetHeight * .4, g + gifts.offsetHeight * .9, 7, 5],
          [m + mark.offsetHeight * (small ? .53 : .15), m + mark.offsetHeight * .88, 5, 4],
          [b + beyond.offsetHeight * .1, b + beyond.offsetHeight * .39, 4, 3],
        ];
        const leafPositions = leafBands.flatMap(([start, end, desktopCount, mobileCount]) => {
          const count = small ? mobileCount : desktopCount;
          return Array.from({ length: count }, (_, index) => start + (end - start) * (index + .5) / count);
        });
        // Every leaf is sampled from the same stem, including at section seams.
        for (const [index, targetY] of leafPositions.entries()) {
          const point = pointAtY(targetY);
          addPlane(
            leafTexture,
            point.x + width / 2 + (index % 2 ? -10 : 12),
            -point.y,
            point.z + 16,
            (small ? 32 : 43) + index % 3 * (small ? 5 : 7),
            index % 2 ? -.55 : .5,
            .7,
            index * .83,
          );
        }
        schedule();
      }

      const onScroll = () => schedule();
      const onPointer = (event: PointerEvent) => {
        if (mobile || still) return;
        pointerX = event.clientX / innerWidth * 2 - 1;
        pointerY = event.clientY / innerHeight * 2 - 1;
        schedule();
      };
      const onVisibility = () => { if (!document.hidden) schedule(); };
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("pointermove", onPointer, { passive: true });
      addEventListener("resize", build, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      resizeObserver = new ResizeObserver(build);
      resizeObserver.observe(root);
      build();
      if (!still) {
        interval = window.setInterval(() => {
          if (document.hidden) return;
          const rect = root.getBoundingClientRect();
          if (rect.bottom <= 0 || rect.top >= innerHeight) return;
          const now = performance.now();
          if (now - lastAmbient >= (mobile ? 100 : 66)) {
            lastAmbient = now;
            schedule();
          }
        }, mobile ? 100 : 66);
      }
      detach = () => {
        removeEventListener("scroll", onScroll);
        removeEventListener("pointermove", onPointer);
        removeEventListener("resize", build);
        document.removeEventListener("visibilitychange", onVisibility);
        resizeObserver?.disconnect();
        clearInterval(interval);
        cancelAnimationFrame(frame);
        disposePlant();
        textures.forEach(texture => texture.dispose());
        renderer?.dispose();
        renderer?.domElement.remove();
        root.classList.remove("has-botanical-world");
      };
    };

    void start();
    return () => {
      disposed = true;
      detach?.();
    };
  }, [active, reducedMotion]);

  return <div className="v2-botanical-viewport" ref={shellRef} aria-hidden="true" />;
}
