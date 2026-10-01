import * as THREE from "three";

export function gardenPortalProfile(width: number, height: number) {
  const narrow = width < 721;
  return [
    { half: width * (narrow ? .52 : .445), z: height * .14, top: 82, thickness: narrow ? 8 : 12, color: "#a7b393" },
    { half: width * (narrow ? .485 : .410), z: 0, top: narrow ? 99 : 108, thickness: narrow ? 6 : 9, color: "#d7d6bd" },
    { half: width * (narrow ? .45 : .374), z: -height * .14, top: narrow ? 116 : 134, thickness: narrow ? 4 : 6, color: "#b9c0a5" },
  ].map(tier => ({ ...tier, rise: Math.min(height * .28, tier.half * .86) }));
}

/** Sculpted pleats: the mesh narrows at its gathered waist, never covers text. */
function drapery(width: number, height: number, side: number, half: number, top: number, rise: number): THREE.BufferGeometry {
  const narrow = width < 721;
  const rows = 60, columns = 24;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const finish = -height * (side < 0 ? .92 : .85);
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const gather = Math.exp(-(((t - .53) / .11) ** 2));
    const breadth = width * (narrow ? .075 : .058) * (.95 + t * .30 - gather * .76);
    const center = side * (half * .91 + Math.sin(t * Math.PI) * width * .012);
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const fold = Math.cos(u * Math.PI * 10 + t * .4);
      // Pin every point of the upper hem to the curved arch, rather than
      // leaving a straight cut edge suspended below it.
      const attachmentX = side * half * .91 + (u - .5) * width * (narrow ? .075 : .058) * .95;
      const start = -top - rise + rise * Math.sqrt(Math.max(0, 1 - (attachmentX / half) ** 2));
      const y = start + (finish - start) * t - Math.sin(Math.PI * u) * t ** 5 * (narrow ? 12 : 26);
      positions.push(center + (u - .5) * breadth, y, fold * (narrow ? 3.5 : 7) * (1 - gather * .75) + Math.sin(t * Math.PI) * 6);
      uvs.push(u, t);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Locally authored architectural geometry, not a raster backdrop. */
export function makeGardenPortal(width: number, height: number, distance: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "conservatory-threshold";
  const tiers = gardenPortalProfile(width, height);
  function locate(geometry: THREE.BufferGeometry, z: number) {
    const compensation = (distance - z) / distance;
    geometry.scale(compensation, compensation, 1);
    geometry.translate(0, height / 2 * (compensation - 1), z);
  }
  tiers.forEach((tier, index) => {
    const thickness = tier.thickness;
    const shape = new THREE.Shape();
    const half=tier.half, top=tier.top, bottom=-height-70;
    const spring=-top-tier.rise, inner=half-thickness;
    // True concentric elliptical arcs, an open base and separated silhouettes.
    shape.moveTo(-half,bottom); shape.lineTo(-half,spring);
    shape.absellipse(0,spring,half,tier.rise,Math.PI,0,true,0);
    shape.lineTo(half,bottom); shape.lineTo(inner,bottom); shape.lineTo(inner,spring);
    shape.absellipse(0,spring,inner,tier.rise-thickness,0,Math.PI,false,0);
    shape.lineTo(-inner,bottom); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 8, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2, curveSegments: 32 });
    locate(geometry, tier.z);
    const material = new THREE.MeshStandardMaterial({ color: tier.color, roughness: .86, metalness: 0 });
    const arch = new THREE.Mesh(geometry, material);
    arch.name = `threshold-${index}`;
    // Only the outer frame casts a shadow: no repeating dark hoops on the paper.
    arch.castShadow = index === 0;
    arch.renderOrder = -3 + index;
    arch.userData.ownsMaterial = true;
    group.add(arch);
  });
  const outer = tiers[0];
  for (const side of [-1, 1]) {
    const geometry = drapery(width, height, side, outer.half, outer.top, outer.rise);
    locate(geometry, outer.z + 12);
    const material = new THREE.MeshStandardMaterial({ color: "#f2ebd8", roughness: .94, side: THREE.DoubleSide });
    const cloth = new THREE.Mesh(geometry, material);
    cloth.name = `drapery-${side < 0 ? "left" : "right"}`;
    cloth.userData.ownsMaterial = true;
    cloth.castShadow = true;
    group.add(cloth);
  }
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.5, height * 1.4), new THREE.ShadowMaterial({ opacity: .065, depthWrite: false }));
  paper.name = "paper-shadow-receiver";
  paper.position.set(0, -height * .5, -height * .32);
  paper.receiveShadow = true;
  paper.renderOrder = -10;
  paper.userData.ownsMaterial = true;
  group.add(paper);
  return group;
}
