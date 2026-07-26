import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants/appConstants';
import { generateCandidates } from './candidateUtils';

describe('generateCandidates', () => {
  it('min, max, step 기준으로 후보를 만든다', () => {
    const candidates = generateCandidates({
      ...DEFAULT_SETTINGS,
      minSensitivity: 1.5,
      maxSensitivity: 2.1,
      currentSensitivity: 1.9,
      step: 0.2,
    });

    expect(candidates.map((candidate) => candidate.value)).toEqual([1.5, 1.7, 1.9, 2.1]);
  });

  it('현재 감도가 그리드 밖이어도 후보에 포함한다', () => {
    const candidates = generateCandidates({
      ...DEFAULT_SETTINGS,
      minSensitivity: 1.5,
      maxSensitivity: 2.1,
      currentSensitivity: 2.5,
      step: 0.2,
    });

    expect(candidates.map((candidate) => candidate.value)).toContain(2.5);
  });

  it('간격 허용 오차 때문에 최대값을 넘는 후보를 만들지 않는다', () => {
    const values = generateCandidates(DEFAULT_SETTINGS).map((candidate) => candidate.value);

    expect(values[values.length - 1]).toBe(DEFAULT_SETTINGS.maxSensitivity);
    expect(values.every((value) => value <= DEFAULT_SETTINGS.maxSensitivity)).toBe(true);
  });

  it('앱 허용 범위 밖의 현재 감도는 경계값으로 보정한다', () => {
    const values = generateCandidates({
      ...DEFAULT_SETTINGS,
      currentSensitivity: 99,
    }).map((candidate) => candidate.value);

    expect(values).toContain(8);
    expect(values.every((value) => value <= 8)).toBe(true);
  });
});
