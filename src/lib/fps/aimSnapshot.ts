import * as THREE from 'three';

export interface AimSnapshot {
  isOnTarget: boolean;
  angularDistanceDeg: number;
}

export function getAimSnapshot(
  camera: THREE.PerspectiveCamera,
  targetMesh: THREE.Object3D,
): AimSnapshot {
  if (!targetMesh.visible) {
    return {
      isOnTarget: false,
      angularDistanceDeg: 0,
    };
  }

  // Mouse input mutates the camera Euler between render passes. Refresh both
  // world matrices so clicks and per-frame aim checks use the latest pose.
  camera.updateWorldMatrix(true, false);
  targetMesh.updateWorldMatrix(true, true);

  const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const targetPosition = targetMesh.getWorldPosition(new THREE.Vector3());
  const toTarget = targetPosition.sub(camera.getWorldPosition(new THREE.Vector3())).normalize();
  const angularDistanceDeg = THREE.MathUtils.radToDeg(forward.angleTo(toTarget));
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  return {
    isOnTarget: raycaster.intersectObject(targetMesh, false).length > 0,
    angularDistanceDeg,
  };
}
