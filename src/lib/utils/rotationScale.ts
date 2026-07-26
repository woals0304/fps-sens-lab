import { BASE_LOOK_SCALE, OVERWATCH_YAW_DEGREES_PER_COUNT } from '../constants/appConstants';
import { normalizeSensitivity } from './sensitivity';

function normalizeCalibrationMultiplier(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return value;
}

function normalizeDpi(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

export function getRotationRadiansPerCount(
  sensitivity: number,
  calibrationMultiplier = 1,
): number {
  return (
    BASE_LOOK_SCALE *
    normalizeSensitivity(sensitivity) *
    normalizeCalibrationMultiplier(calibrationMultiplier)
  );
}

export function applyRotationScale(
  delta: number,
  sensitivity: number,
  calibrationMultiplier = 1,
): number {
  return delta * getRotationRadiansPerCount(sensitivity, calibrationMultiplier);
}

export function calculateDegreesPerCount(
  sensitivity: number,
  calibrationMultiplier = 1,
): number {
  return (
    OVERWATCH_YAW_DEGREES_PER_COUNT *
    normalizeSensitivity(sensitivity) *
    normalizeCalibrationMultiplier(calibrationMultiplier)
  );
}

export function calculateCm360(
  dpi: number,
  sensitivity: number,
  calibrationMultiplier = 1,
): number {
  const normalizedDpi = normalizeDpi(dpi);
  const degreesPerCount = calculateDegreesPerCount(sensitivity, calibrationMultiplier);

  if (normalizedDpi <= 0 || degreesPerCount <= 0) {
    return 0;
  }

  return (360 * 2.54) / (normalizedDpi * degreesPerCount);
}

export function calculateCm180(
  dpi: number,
  sensitivity: number,
  calibrationMultiplier = 1,
): number {
  return calculateCm360(dpi, sensitivity, calibrationMultiplier) / 2;
}

export function calculateRotationDifferencePercent(
  targetCm360: number,
  actualCm360: number,
): number {
  if (!Number.isFinite(targetCm360) || targetCm360 <= 0 || !Number.isFinite(actualCm360)) {
    return 0;
  }

  return ((actualCm360 - targetCm360) / targetCm360) * 100;
}

export function calculateOverwatchCm360(dpi: number, sensitivity: number): number {
  return calculateCm360(dpi, sensitivity, 1);
}

export function calculateOverwatchCm180(dpi: number, sensitivity: number): number {
  return calculateCm180(dpi, sensitivity, 1);
}
