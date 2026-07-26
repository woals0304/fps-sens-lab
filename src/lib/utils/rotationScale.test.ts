import { describe, expect, it } from 'vitest';
import {
  applyRotationScale,
  calculateCm180,
  calculateCm360,
  calculateOverwatchCm360,
  calculateRotationDifferencePercent,
  getRotationRadiansPerCount,
} from './rotationScale';

describe('rotationScale', () => {
  it('overwatch cm/360 calculation matches the project default scale', () => {
    const overwatchCm360 = calculateOverwatchCm360(1600, 2.5);
    const projectCm360 = calculateCm360(1600, 2.5, 1);

    expect(overwatchCm360).toBeCloseTo(34.64, 2);
    expect(projectCm360).toBeCloseTo(overwatchCm360, 5);
    expect(calculateCm180(1600, 2.5, 1)).toBeCloseTo(overwatchCm360 / 2, 5);
  });

  it('applies the same radians-per-count scale that cm/360 uses', () => {
    const radiansPerCount = getRotationRadiansPerCount(2.5, 1);
    const applied = applyRotationScale(100, 2.5, 1);

    expect(radiansPerCount).toBeCloseTo(0.00028798, 7);
    expect(applied).toBeCloseTo(radiansPerCount * 100, 7);
  });

  it('reports rotation distance differences from calibration changes', () => {
    const target = calculateOverwatchCm360(1600, 2.5);
    const adjusted = calculateCm360(1600, 2.5, 1.1);

    expect(adjusted).toBeLessThan(target);
    expect(calculateRotationDifferencePercent(target, adjusted)).toBeCloseTo(-9.09, 1);
  });
});
