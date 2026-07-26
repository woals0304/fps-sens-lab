import { describe, expect, it } from 'vitest';
import {
  buildFocusedCandidates,
  buildWideProbeCandidates,
  detectDirectionTrend,
  recenterSearchWindow,
  shouldRecenterSearch,
} from './searchStrategy';
import type { SensitivityLabSummary } from '../../types/models';

function createSummary(sensitivity: number, score: number): SensitivityLabSummary {
  return {
    sensitivity,
    flickMetrics: null,
    trackingMetrics: null,
    turnMetrics: null,
    flickScore: score,
    trackingScore: score,
    turnScore: score,
    hitRateScore: score,
    smoothnessScore: score,
    overshootPenalty: 0,
    autoWeightedScore: score,
    manualWeightedScore: null,
    combinedWeightedScore: score,
    interpretationTags: ['balanced'],
    runCount: 3,
  };
}

describe('searchStrategy', () => {
  it('넓은 1차 탐색은 현재 감도에서 멀리 떨어진 후보도 함께 넣는다', () => {
    expect(buildWideProbeCandidates(4)).toEqual([2.9, 3.55, 4, 4.45, 5.1]);
  });

  it.each([
    { center: 0.5, expected: [0.5, 0.7, 0.95, 1, 1.05] },
    { center: 8, expected: [6.7, 6.75, 6.8, 7.55, 8] },
  ])('허용 경계 $center에서도 초기 후보 다섯 개를 보강한다', ({ center, expected }) => {
    expect(buildWideProbeCandidates(center)).toEqual(expected);
  });

  it('초기 비교 결과가 낮은 쪽 우세이면 낮은 방향 경향을 감지한다', () => {
    const result = detectDirectionTrend(2.5, [
      createSummary(1.8, 82),
      createSummary(2.2, 80),
      createSummary(2.5, 71),
      createSummary(2.8, 66),
      createSummary(3.2, 61),
    ]);

    expect(result.trend).toBe('lower');
    expect(result.lowerWins).toBeGreaterThanOrEqual(2);
    expect(shouldRecenterSearch(result, 0)).toBe(true);
  });

  it('중심 이동은 한 번에 너무 멀리 튀지 않고 새 중심을 만든다', () => {
    expect(recenterSearchWindow(2.5, 'lower', 1.8)).toBe(2.05);
    expect(buildFocusedCandidates(2.05, 0.12)).toEqual([1.81, 1.93, 2.05, 2.17, 2.29]);
  });

  it('우세 방향과 반대편의 단일 고득점 후보로 중심을 옮기지 않는다', () => {
    const result = detectDirectionTrend(2.5, [
      createSummary(2, 80),
      createSummary(2.2, 79),
      createSummary(2.5, 70),
      createSummary(2.8, 81),
    ]);

    expect(result.trend).toBe('lower');
    expect(result.winningSensitivity).toBeLessThan(2.5);
    expect(result.recommendedCenter).toBeLessThan(2.5);
    expect(recenterSearchWindow(2.5, 'lower', 2.8)).toBe(2.5);
  });
});
