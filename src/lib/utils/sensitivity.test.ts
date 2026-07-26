import { describe, expect, it } from 'vitest';
import {
  getLookMultiplier,
  isSameSensitivity,
  normalizeDegrees,
  roundSensitivity,
} from './sensitivity';

describe('sensitivity utils', () => {
  it('감도와 보정값으로 look multiplier를 만든다', () => {
    expect(getLookMultiplier(2.5, 1)).toBeGreaterThan(0);
    expect(getLookMultiplier(2.5, 1.2)).toBeGreaterThan(getLookMultiplier(2.5, 1));
  });

  it('각도를 -180 ~ 180 범위로 정리한다', () => {
    expect(normalizeDegrees(270)).toBe(-90);
    expect(normalizeDegrees(-190)).toBe(170);
  });

  it('감도를 소수 둘째 자리로 반올림한다', () => {
    expect(roundSensitivity(2.345)).toBe(2.35);
  });

  it('반올림 결과가 같은 값만 동일 감도로 취급한다', () => {
    expect(isSameSensitivity(2.5, 2.504)).toBe(true);
    expect(isSameSensitivity(2.5, 2.51)).toBe(false);
  });
});
