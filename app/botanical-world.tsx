"use client";

import { useEffect, useRef } from "react";

type BotanicalWorldProps = { active: boolean; reducedMotion: boolean };

/**
 * One document-space plant, viewed through a viewport-sized camera. The canvas
 * sticks while its parent spans the three chapters; no section owns the vine.
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
        if (!hero || !details || !profiles || !renderer) return;

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
        const small = width <= 720;
        const x = (value: number) => width * value;
        const r = small ? 1.2 : 1.45;
        // One uninterrupted stem physically crosses BOTH chapter seams.
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
        ];

        for (const [index, spec] of branchSpecs.entries()) {
          if (small && index === 1) continue; // Paper/map gets breathing room on mobile.
          makeCurve(spec.points, r * .49, 0x5f5a3e);
          for (const [leafX, leafY, leafZ, size, rotation] of spec.leaves) {
            addPlane(leafTexture, x(leafX), leafY, leafZ, size, rotation, .7, index * 1.8);
          }
          if (spec.flower && !small) {
            const [flowerX, flowerY, flowerZ, size, rotation] = spec.flower;
            addPlane(blossomTexture, x(flowerX), flowerY, flowerZ, size, rotation, .8, 2.4);
          }
        }

        // Sparse growth directly on the stem gives the long line a living rhythm.
        for (const [index, at] of (small ? [.13, .27, .4, .72, .89] : [.11, .19, .28, .34, .44, .59, .73, .85, .93]).entries()) {
          const point = stem.getPointAt(at);
          addPlane(
            leafTexture,
            point.x + width / 2 + (index % 2 ? -16 : 10),
            -point.y,
            point.z + 16,
            small ? 42 : 64 + index % 3 * 8,
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
