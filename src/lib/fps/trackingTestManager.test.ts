import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STANDARD_TEST_PROTOCOL } from '../constants/appConstants';
import { PointerMetricsCollector } from './metricsCollector';
import { getTrackingPosition } from './targetSpawner';
import { TrackingTestManager } from './trackingTestManager';

function pointCameraWithYawOffset(
  camera: THREE.PerspectiveCamera,
  targetPosition: THREE.Vector3,
  yawOffsetDeg: number,
): number {
  camera.lookAt(targetPosition);
  camera.rotateY(THREE.MathUtils.degToRad(yawOffsetDeg));

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).normalize();
  const toTarget = targetPosition.clone().sub(camera.position).normalize();
  return THREE.MathUtils.radToDeg(forward.angleTo(toTarget));
}

describe('TrackingTestManager', () => {
  it('weights distance, on-target time, and stability by clamped delta time', () => {
    const seed = 0;
    const durationMs = 1_000;
    const protocol = {
      ...STANDARD_TEST_PROTOCOL.standard,
      trackingDurationMs: durationMs,
    };
    const manager = new TrackingTestManager(seed, protocol);
    const target = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    const collector = new PointerMetricsCollector();
    const smoothnessSpy = vi.spyOn(collector, 'getSmoothnessScore');
    const correctionFrequencySpy = vi.spyOn(collector, 'getDirectionChangeRate');
    camera.position.set(0, 1.6, 0);
    collector.reset();
    manager.start(0);

    const distanceAt100 = pointCameraWithYawOffset(
      camera,
      getTrackingPosition(seed, 100, protocol.trackingTargetSpeedScale),
      10,
    );
    expect(manager.update(100, target, camera, collector)).toBeNull();

    const distanceAt200 = pointCameraWithYawOffset(
      camera,
      getTrackingPosition(seed, 200, protocol.trackingTargetSpeedScale),
      10,
    );
    expect(manager.update(200, target, camera, collector)).toBeNull();

    const distanceAtEnd = pointCameraWithYawOffset(
      camera,
      getTrackingPosition(seed, durationMs, protocol.trackingTargetSpeedScale),
      0,
    );
    const metrics = manager.update(1_200, target, camera, collector);

    const weightedMean = (
      (distanceAt100 * 100)
      + (distanceAt200 * 100)
      + (distanceAtEnd * 800)
    ) / durationMs;
    const weightedVariance = (
      (((distanceAt100 - weightedMean) ** 2) * 100)
      + (((distanceAt200 - weightedMean) ** 2) * 100)
      + (((distanceAtEnd - weightedMean) ** 2) * 800)
    ) / durationMs;

    expect(metrics?.durationMs).toBe(durationMs);
    expect(metrics?.averageCrosshairDistanceDeg).toBeCloseTo(weightedMean, 8);
    expect(metrics?.timeOnTargetRatio).toBeCloseTo(0.8, 8);
    expect(metrics?.followStability).toBeCloseTo(
      Math.max(0, 100 - Math.sqrt(weightedVariance) * 12),
      8,
    );
    expect(smoothnessSpy).toHaveBeenLastCalledWith(durationMs, durationMs);
    expect(correctionFrequencySpy).toHaveBeenLastCalledWith(durationMs, durationMs);
  });
});
