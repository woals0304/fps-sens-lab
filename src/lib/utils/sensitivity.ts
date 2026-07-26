import { BASE_LOOK_SCALE, MAX_ALLOWED_SENSITIVITY, MIN_ALLOWED_SENSITIVITY } from '../constants/appConstants';
import { clamp } from './numberUtils';

const SENSITIVITY_SCALE = 100;

function toSensitivityUnits(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * SENSITIVITY_SCALE);
}

export function getLookMultiplier(sensitivity: number, calibrationMultiplier: number): number {
  return BASE_LOOK_SCALE * sensitivity * calibrationMultiplier;
}

export function clampPitchRadians(value: number): number {
  const halfPi = Math.PI / 2;
  return clamp(value, -halfPi + 0.02, halfPi - 0.02);
}

export function normalizeDegrees(value: number): number {
  let angle = value;

  while (angle <= -180) {
    angle += 360;
  }

  while (angle > 180) {
    angle -= 360;
  }

  return angle;
}

export function normalizeRadians(value: number): number {
  let angle = value;

  while (angle <= -Math.PI) {
    angle += Math.PI * 2;
  }

  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }

  return angle;
}

export function normalizeSensitivity(value: number): number {
  return toSensitivityUnits(value) / SENSITIVITY_SCALE;
}

export function clampSensitivity(value: number): number {
  return normalizeSensitivity(clamp(value, MIN_ALLOWED_SENSITIVITY, MAX_ALLOWED_SENSITIVITY));
}

export function formatSensitivity(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  return normalizeSensitivity(value).toFixed(2);
}

export function addSensitivityStep(base: number, step: number): number {
  return normalizeSensitivity(base + step);
}

export function isSensitivityClose(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(normalizeSensitivity(a) - normalizeSensitivity(b)) <= tolerance;
}

export function isSameSensitivity(a: number, b: number): boolean {
  return toSensitivityUnits(a) === toSensitivityUnits(b);
}

export function compareSensitivity(a: number, b: number): number {
  return toSensitivityUnits(a) - toSensitivityUnits(b);
}

export function roundSensitivity(value: number): number {
  return normalizeSensitivity(value);
}

export function getFineTuneStep(baseStep: number): number {
  const normalizedStep = normalizeSensitivity(baseStep);

  if (normalizedStep >= 0.1) {
    return 0.02;
  }

  if (normalizedStep >= 0.05) {
    return 0.01;
  }

  return normalizeSensitivity(Math.max(0.01, normalizedStep / 2));
}

export function getValidationOffset(baseStep: number): number {
  const normalizedStep = normalizeSensitivity(baseStep);

  if (normalizedStep >= 0.1) {
    return 0.02;
  }

  if (normalizedStep >= 0.05) {
    return 0.01;
  }

  return 0.01;
}
