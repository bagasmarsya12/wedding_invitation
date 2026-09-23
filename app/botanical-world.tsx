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
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.45));
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
        const r = small ? 1.2 : 1.45;
        // The original vine is never restarted. It recedes outside the frame
        // through the quiet chapters, then grows back into the final canopy.
        const stem = makeCurve([
          [x(small ? .83 : .76), h * (small ? .69 : .43), -32],
          [x(small ? .91 : .88), h * (small ? .8 : .67), -14],
          [x(small ? .94 : .958), h * .94, 18],
          [x(small ? .965 : .982), h + d * .06, 4],
          [x(small ? .945 : .967), h + d * .28, -15],
          [x(small ? .97 : .986), h + d * .49, -24],
          [x(small ? .935 : .97), h + d * .72, -10],
          [x(small ? .96 : .983), h + d * .94, 11],
          [x(small ? .91 : .93), h + d + p * .04, -4],
          [x(small ? .85 : .88), h + d + p * .13, -30],
          [x(1.025), h + d + p * .29, -65],
          [x(1.035), h + d + p * .86, -75],
          [x(.98), a + archive.offsetHeight * .15, -48],
          [x(.955), a + archive.offsetHeight * .52, -20],
          [x(1.025), a + archive.offsetHeight * .92, -60],
          [x(1.04), q + rsvp.offsetHeight * .5, -80],
          [x(1.04), u + useful.offsetHeight * .5, -80],
          [x(1.025), u + useful.offsetHeight * .94, -72],
          [x(.965), g + gifts.offsetHeight * .18, -35],
          [x(.955), g + gifts.offsetHeight * .63, -14],
          [x(.99), m + mark.offsetHeight * .12, -38],
          [x(.985), m + mark.offsetHeight * .84, -18],
          [x(.88), b + beyond.offsetHeight * .18, -33],
          [x(.74), b + beyond.offsetHeight * .37, -45],
        ], r, 0x625e45);

        const branchSpecs: { at: number; points: [number, number, number][]; leaves: [number, number, number, number, number][]; flower?: [number, number, number, number, number] }[] = [
          {
            at: .19,
            points: [[x(small ? .94 : .91), h * .77, -10], [x(small ? .77 : .82), h * .82, -1], [x(small ? .68 : .77), h * .86, 10]],
            leaves: [[small ? .77 : .82, h * .82, 14, small ? 52 : 72, -.35], [small ? .68 : .77, h * .86, 18, small ? 42 : 62, .35]],
          },
          {
            at: .38,
            points: [[x(.96), h + d * .21, -14], [x(small ? .77 : .83), h + d * .28, -10], [x(small ? .68 : .75), h + d * .35, 6]],
            leaves: [[small ? .8 : .85, h + d * .27, -7, small ? 38 : 64, -.45]],
            flower: [small ? .7 : .77, h + d * .34, 9, small ? 49 : 75, .25],
          },
          {
            at: .68,
            points: [[x(.96), h + d * .78, -17], [x(small ? .78 : .84), h + d * .84, -6], [x(small ? .69 : .77), h + d * .9, 8]],
            leaves: [[small ? .8 : .84, h + d * .84, 3, small ? 36 : 62, -.2]],
          },
          {
            at: .84,
            points: [[x(small ? .93 : .95), h + d - 34, -22], [x(small ? .86 : .89), h + d + 20, -9], [x(small ? .78 : .82), h + d + 85, 5]],
            leaves: [[small ? .85 : .89, h + d + 20, -2, small ? 37 : 62, -.45], [small ? .78 : .82, h + d + 85, 9, small ? 30 : 51, .28]],
          },
          {
            at: 1,
            points: [[x(.96), a + archive.offsetHeight * .43, -22], [x(small ? .83 : .86), a + archive.offsetHeight * .51, -12], [x(small ? .76 : .78), a + archive.offsetHeight * .56, 2]],
            leaves: [[small ? .83 : .86, a + archive.offsetHeight * .51, -3, small ? 39 : 70, -.4], [small ? .76 : .78, a + archive.offsetHeight * .56, 9, small ? 32 : 55, .27]],
          },
          {
            at: 1,
            points: [[x(.965), g + gifts.offsetHeight * .22, -31], [x(small ? .86 : .83), g + gifts.offsetHeight * .31, -18], [x(small ? .77 : .74), g + gifts.offsetHeight * .39, 5]],
            leaves: [[small ? .86 : .83, g + gifts.offsetHeight * .31, -9, small ? 40 : 67, -.33], [small ? .77 : .74, g + gifts.offsetHeight * .39, 11, small ? 35 : 59, .38]],
          },
          {
            at: 1,
            points: [[x(.89), b + beyond.offsetHeight * .14, -35], [x(small ? .73 : .76), b + beyond.offsetHeight * .23, -15], [x(small ? .66 : .64), b + beyond.offsetHeight * .3, 2]],
            leaves: [[small ? .73 : .76, b + beyond.offsetHeight * .23, -8, small ? 49 : 75, -.3]],
            flower: [small ? .66 : .64, b + beyond.offsetHeight * .3, 8, small ? 55 : 79, .17],
          },
        ];

        for (const [index, spec] of branchSpecs.entries()) {
          if (small && (index === 1 || index === 5)) continue; // Map and gift shelf keep breathing room.
          makeCurve(spec.points, r * .49, 0x5f5a3e);
          for (const [leafX, leafY, leafZ, size, rotation] of spec.leaves) {
            addPlane(leafTexture, x(leafX), leafY, leafZ, size, rotation, .7, index * 1.8);
          }
          if (spec.flower && (!small || index === 6)) {
            const [flowerX, flowerY, flowerZ, size, rotation] = spec.flower;
            addPlane(blossomTexture, x(flowerX), flowerY, flowerZ, size, rotation, .8, 2.4);
          }
        }

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
        const leafPositions = small
          ? [h * .84, h + d * .09, h + d * .73, h + d + 25, a + archive.offsetHeight * .28, a + archive.offsetHeight * .65, g + gifts.offsetHeight * .48, b + beyond.offsetHeight * .15]
          : [h * .65, h * .85, h + d * .1, h + d * .58, h + d * .9, h + d + 35, a + archive.offsetHeight * .22, a + archive.offsetHeight * .43, a + archive.offsetHeight * .68, g + gifts.offsetHeight * .12, g + gifts.offsetHeight * .51, m + mark.offsetHeight * .87, b + beyond.offsetHeight * .12, b + beyond.offsetHeight * .27];
        // Foliage is anchored to the same spatial curve, never scattered.
        for (const [index, targetY] of leafPositions.entries()) {
          const point = pointAtY(targetY);
          addPlane(
            leafTexture,
            point.x + width / 2 + (index % 2 ? -16 : 10),
            -point.y,
            point.z + 16,
            small ? 42 : 62 + index % 3 * 8,
            index % 2 ? -.55 : .5,
            .58,
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
