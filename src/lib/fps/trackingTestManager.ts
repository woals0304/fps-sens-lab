import * as THREE from 'three';
import {
  TRACKING_ON_TARGET_THRESHOLD_DEG,
} from '../constants/appConstants';
import type { ProtocolVariantConfig, TrackingMetrics } from '../../types/models';
import { PointerMetricsCollector } from './metricsCollector';
import { getTrackingPosition } from './targetSpawner';

function toDegreesAngle(camera: THREE.PerspectiveCamera, targetPosition: THREE.Vector3): number {
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).normalize();
  const toTarget = targetPosition.clone().sub(camera.position).normalize();
  return THREE.MathUtils.radToDeg(forward.angleTo(toTarget));
}

export class TrackingTestManager {
  private readonly durationMs: number;

  private readonly speedScale: number;

  private startedAt = 0;

  private lastSampleAt = 0;

  private sampledDurationMs = 0;

  private distanceDurationSum = 0;

  private squaredDistanceDurationSum = 0;

  private trackingLossCount = 0;

  private onTargetDurationMs = 0;

  private wasOnTarget = false;

  constructor(
    private readonly seed: number,
    protocol: ProtocolVariantConfig,
  ) {
    this.durationMs = protocol.trackingDurationMs;
    this.speedScale = protocol.trackingTargetSpeedScale;
  }

  start(now: number): void {
    this.startedAt = now;
    this.lastSampleAt = now;
    this.sampledDurationMs = 0;
    this.distanceDurationSum = 0;
    this.squaredDistanceDurationSum = 0;
    this.trackingLossCount = 0;
    this.onTargetDurationMs = 0;
    this.wasOnTarget = false;
  }

  getRemainingMs(now: number): number {
    return Math.max(0, this.durationMs - (now - this.startedAt));
  }

  getDurationMs(): number {
    return this.durationMs;
  }

  update(
    now: number,
    targetMesh: THREE.Object3D,
    camera: THREE.PerspectiveCamera,
    collector: PointerMetricsCollector,
  ): TrackingMetrics | null {
    const elapsed = Math.max(0, now - this.startedAt);
    const sampleElapsed = Math.min(elapsed, this.durationMs);
    const sampleAt = this.startedAt + sampleElapsed;
    const position = getTrackingPosition(this.seed, sampleElapsed, this.speedScale);
    targetMesh.position.copy(position);
    targetMesh.visible = true;

    const distanceDeg = toDegreesAngle(camera, position);
    const isOnTarget = distanceDeg <= TRACKING_ON_TARGET_THRESHOLD_DEG;
    const sampleDurationMs = Math.max(0, sampleAt - this.lastSampleAt);

    if (sampleDurationMs > 0) {
      this.sampledDurationMs += sampleDurationMs;
      this.distanceDurationSum += distanceDeg * sampleDurationMs;
      this.squaredDistanceDurationSum += (distanceDeg ** 2) * sampleDurationMs;

      if (isOnTarget) {
        this.onTargetDurationMs += sampleDurationMs;
      }

      if (!isOnTarget && this.wasOnTarget) {
        this.trackingLossCount += 1;
      }

      this.wasOnTarget = isOnTarget;
      this.lastSampleAt = sampleAt;
    }

    if (elapsed < this.durationMs) {
      return null;
    }

    const averageDistance = this.sampledDurationMs > 0
      ? this.distanceDurationSum / this.sampledDurationMs
      : 0;
    const distanceVariance = this.sampledDurationMs > 0
      ? Math.max(
        0,
        (this.squaredDistanceDurationSum / this.sampledDurationMs) - (averageDistance ** 2),
      )
      : 0;
    const stability = Math.max(0, 100 - Math.sqrt(distanceVariance) * 12);
    const smoothness = collector.getSmoothnessScore(this.durationMs, sampleAt);
    const averageCorrectionFrequency = collector.getDirectionChangeRate(this.durationMs, sampleAt);

    return {
      durationMs: this.durationMs,
      averageCrosshairDistanceDeg: averageDistance,
      timeOnTargetRatio: this.sampledDurationMs > 0
        ? this.onTargetDurationMs / this.sampledDurationMs
        : 0,
      followStability: stability,
      movementSmoothness: smoothness,
      trackingLossCount: this.trackingLossCount,
      averageCorrectionFrequency,
    };
  }
}
