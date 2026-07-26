import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { STANDARD_TEST_PROTOCOL, TURN_HOLD_MS } from '../constants/appConstants';
import { normalizeDegrees } from '../utils/sensitivity';
import { TurnTestManager } from './turnTestManager';

describe('TurnTestManager', () => {
  it('finishes all turn instructions and returns metrics instead of hanging', () => {
    const manager = new TurnTestManager(STANDARD_TEST_PROTOCOL.standard);
    const marker = new THREE.Object3D();
    const cameraPosition = new THREE.Vector3(0, 1.6, 0);
    let now = 0;
    let metrics = null;
    let currentYaw = 0;

    manager.start(now, 0);

    for (const instruction of STANDARD_TEST_PROTOCOL.standard.turnInstructions) {
      currentYaw = normalizeDegrees(currentYaw + instruction.angleDeg);

      now += 10;
      expect(manager.update(now, currentYaw, marker, cameraPosition)).toBeNull();

      now += TURN_HOLD_MS + 5;
      metrics = manager.update(now, currentYaw, marker, cameraPosition);
    }

    expect(metrics).not.toBeNull();
    expect(metrics?.instructionCount).toBe(STANDARD_TEST_PROTOCOL.standard.turnInstructions.length);
    expect(metrics?.completionRate).toBe(1);
    expect(marker.visible).toBe(false);
  });

  it('does not count the initial distance to the target as overshoot', () => {
    const protocol = {
      ...STANDARD_TEST_PROTOCOL.standard,
      turnInstructions: [{ id: 'left-90', label: 'left 90', angleDeg: 90 }],
    };
    const manager = new TurnTestManager(protocol);
    const marker = new THREE.Object3D();
    const cameraPosition = new THREE.Vector3(0, 1.6, 0);

    manager.start(0, 0);
    expect(manager.update(10, 90, marker, cameraPosition)).toBeNull();
    const metrics = manager.update(TURN_HOLD_MS + 20, 90, marker, cameraPosition);

    expect(metrics?.overshootAngleDeg).toBe(0);
  });

  it('records only the angle travelled beyond the target', () => {
    const protocol = {
      ...STANDARD_TEST_PROTOCOL.standard,
      turnInstructions: [{ id: 'left-90', label: 'left 90', angleDeg: 90 }],
    };
    const manager = new TurnTestManager(protocol);
    const marker = new THREE.Object3D();
    const cameraPosition = new THREE.Vector3(0, 1.6, 0);

    manager.start(0, 0);
    manager.update(10, 100, marker, cameraPosition);
    manager.update(20, 90, marker, cameraPosition);
    const metrics = manager.update(TURN_HOLD_MS + 30, 90, marker, cameraPosition);

    expect(metrics?.overshootAngleDeg).toBeCloseTo(10, 8);
  });

  it('faces the marker toward the camera at side angles', () => {
    const protocol = {
      ...STANDARD_TEST_PROTOCOL.standard,
      turnInstructions: [{ id: 'left-90', label: 'left 90', angleDeg: 90 }],
    };
    const manager = new TurnTestManager(protocol);
    const marker = new THREE.Object3D();
    const cameraPosition = new THREE.Vector3(0, 1.6, 0);

    manager.start(0, 0);
    manager.update(10, 0, marker, cameraPosition);

    const markerNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(marker.quaternion).normalize();
    const towardCamera = cameraPosition.clone().sub(marker.position).normalize();
    expect(markerNormal.dot(towardCamera)).toBeCloseTo(1, 8);
  });
});
