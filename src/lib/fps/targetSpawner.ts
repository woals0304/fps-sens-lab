import * as THREE from 'three';
import { LAB_TARGET_DISTANCE } from '../constants/appConstants';

function createSeededRandom(seed: number): () => number {
  let value = seed % 2147483647;

  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function createFlickTargetPositions(seed: number, count: number): THREE.Vector3[] {
  const random = createSeededRandom(seed);
  const positions: THREE.Vector3[] = [];

  for (let index = 0; index < count; index += 1) {
    const x = (random() - 0.5) * 8;
    const y = 1.1 + random() * 3.4;
    const z = -LAB_TARGET_DISTANCE - random() * 1.8;
    positions.push(new THREE.Vector3(x, y, z));
  }

  return positions;
}

export function getTrackingPattern(seed: number): 'linear' | 'circle' | 'zigzag' {
  const patterns: Array<'linear' | 'circle' | 'zigzag'> = ['linear', 'circle', 'zigzag'];
  return patterns[Math.abs(seed) % patterns.length];
}

export function getTrackingPosition(
  seed: number,
  elapsedMs: number,
  speedScale = 1,
): THREE.Vector3 {
  const pattern = getTrackingPattern(seed);
  const time = (elapsedMs / 1000) * speedScale;

  if (pattern === 'linear') {
    return new THREE.Vector3(Math.sin(time * 0.9) * 4.5, 2 + Math.sin(time * 0.45) * 1.5, -LAB_TARGET_DISTANCE);
  }

  if (pattern === 'circle') {
    return new THREE.Vector3(Math.cos(time * 0.9) * 3.2, 2 + Math.sin(time * 0.9) * 2.1, -LAB_TARGET_DISTANCE);
  }

  return new THREE.Vector3(
    Math.sin(time * 1.8) * 4,
    1.8 + (Math.sign(Math.sin(time * 0.7)) * 1.3),
    -LAB_TARGET_DISTANCE,
  );
}

export function getTurnMarkerPosition(targetYawDegrees: number, radius = 9): THREE.Vector3 {
  const radians = THREE.MathUtils.degToRad(targetYawDegrees);
  return new THREE.Vector3(-Math.sin(radians) * radius, 1.7, -Math.cos(radians) * radius);
}
