import * as THREE from 'three';
import { clampPitchRadians } from '../utils/sensitivity';
import { normalizeDegrees } from '../utils/sensitivity';
import { applyRotationScale } from '../utils/rotationScale';

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;

  private yaw = 0;

  private pitch = 0;

  private sensitivity: number;

  private calibrationMultiplier: number;

  constructor(camera: THREE.PerspectiveCamera, sensitivity: number, calibrationMultiplier: number) {
    this.camera = camera;
    this.sensitivity = sensitivity;
    this.calibrationMultiplier = calibrationMultiplier;
    this.camera.rotation.order = 'YXZ';
  }

  setSensitivity(sensitivity: number, calibrationMultiplier: number): void {
    this.sensitivity = sensitivity;
    this.calibrationMultiplier = calibrationMultiplier;
  }

  applyMouseDelta(dx: number, dy: number): void {
    this.yaw -= applyRotationScale(dx, this.sensitivity, this.calibrationMultiplier);
    this.pitch = clampPitchRadians(
      this.pitch - applyRotationScale(dy, this.sensitivity, this.calibrationMultiplier),
    );
    this.applyToCamera();
  }

  setAngles(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = clampPitchRadians(pitch);
    this.applyToCamera();
  }

  reset(): void {
    this.yaw = 0;
    this.pitch = 0;
    this.applyToCamera();
  }

  getYawDegrees(): number {
    return normalizeDegrees(THREE.MathUtils.radToDeg(this.yaw));
  }

  getPitchDegrees(): number {
    return normalizeDegrees(THREE.MathUtils.radToDeg(this.pitch));
  }

  getForwardVector(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(this.camera.rotation);
    return forward.normalize();
  }

  private applyToCamera(): void {
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
