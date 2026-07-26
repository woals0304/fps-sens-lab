import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { STANDARD_TEST_PROTOCOL } from '../constants/appConstants';
import { FlickTestManager } from './flickTestManager';
import { PointerMetricsCollector } from './metricsCollector';

describe('FlickTestManager', () => {
  it('places each new target before reading aim for that same target', () => {
    const protocol = {
      ...STANDARD_TEST_PROTOCOL.standard,
      flickTargetCount: 2,
    };
    const manager = new FlickTestManager(2101, protocol);
    const target = new THREE.Object3D();
    const collector = new PointerMetricsCollector();
    const measuredPositions: THREE.Vector3[] = [];

    target.position.set(999, 999, 999);
    manager.start(0);
    manager.update(10, target, () => {
      measuredPositions.push(target.position.clone());
      return { isOnTarget: true, angularDistanceDeg: 0 };
    });
    manager.handleClick(20, { isOnTarget: true, angularDistanceDeg: 0 }, collector);
    manager.update(30, target, () => {
      measuredPositions.push(target.position.clone());
      return { isOnTarget: true, angularDistanceDeg: 0 };
    });

    expect(measuredPositions).toHaveLength(2);
    expect(measuredPositions[0].equals(new THREE.Vector3(999, 999, 999))).toBe(false);
    expect(measuredPositions[0].equals(measuredPositions[1])).toBe(false);
    expect(target.position.equals(measuredPositions[1])).toBe(true);
  });
});
