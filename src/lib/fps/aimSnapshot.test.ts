import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { getAimSnapshot } from './aimSnapshot';

describe('getAimSnapshot', () => {
  it('updates a stale camera world matrix before raycasting', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    const target = new THREE.Mesh(new THREE.SphereGeometry(1));
    target.position.set(-10, 0, 0);
    target.visible = true;

    camera.updateMatrixWorld(true);
    camera.rotation.y = Math.PI / 2;

    const snapshot = getAimSnapshot(camera, target);

    expect(snapshot.angularDistanceDeg).toBeCloseTo(0, 8);
    expect(snapshot.isOnTarget).toBe(true);
  });

  it('does not raycast a hidden target', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    const target = new THREE.Mesh(new THREE.SphereGeometry(1));
    target.position.set(0, 0, -10);
    target.visible = false;

    expect(getAimSnapshot(camera, target)).toEqual({
      isOnTarget: false,
      angularDistanceDeg: 0,
    });
  });
});
