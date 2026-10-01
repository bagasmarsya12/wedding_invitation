import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gardenPortalProfile, makeGardenPortal } from '../lib/garden-portal.ts';
import { heroCameraDistance } from '../lib/hero-passage.ts';

test('elliptical thresholds are separated and drapery leaves the central walkway open', () => {
  for (const [width,height] of [[1440,1120],[390,940],[320,940]]) {
    const profiles = gardenPortalProfile(width,height);
    for(let i=0;i<profiles.length-1;i++) {
      assert.ok(profiles[i].half-profiles[i].thickness-profiles[i+1].half>2,'Visible columns must have air between them');
      assert.ok(profiles[i+1].top-profiles[i].top-profiles[i].thickness>2,'Crowns must never converge');
    }
    const portal = makeGardenPortal(width,height,heroCameraDistance(height));
    portal.updateMatrixWorld(true);
    const arches = portal.children.filter(child=>child.name.startsWith('threshold-'));
    assert.equal(arches.length,3);
    const cloth = portal.children.filter(child=>child.name.startsWith('drapery-'));
    assert.equal(cloth.length,2);
    assert.ok(cloth.every(mesh=>mesh.geometry.getAttribute('position').count<2000));
    for(const mesh of cloth) {
      const vertices = mesh.geometry.getAttribute('position');
      const compensation = (heroCameraDistance(height)-profiles[0].z-12)/heroCameraDistance(height);
      for(let v=0;v<vertices.count;v++) {
        assert.ok(Number.isFinite(vertices.getX(v)) && Number.isFinite(vertices.getY(v)) && Number.isFinite(vertices.getZ(v)));
        assert.ok(Math.abs(vertices.getX(v)/compensation)>width*(width<721?.40:.35),'Fabric must stay outside the readable center');
      }
    }
    const ray = new THREE.Raycaster();
    for (let y=-height*.65;y>-height*1.5;y-=8) {
      ray.set(new THREE.Vector3(0,y,4000),new THREE.Vector3(0,0,-1));
      assert.equal(ray.intersectObjects([...arches,...cloth]).length,0,'Neither a crossbar nor fabric may block the center of the walkway');
    }
    portal.traverse(object=>{
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); object.material.dispose(); }
    });
  }
});
