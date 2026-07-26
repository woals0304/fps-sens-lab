import { describe, expect, it } from 'vitest';
import type { SensitivityLabSummary } from '../../types/models';
import { buildAnalysisSummary } from './metricsAnalyzer';

function createSummary(sensitivity: number): SensitivityLabSummary {
  return {
    sensitivity,
    flickMetrics: null,
    trackingMetrics: null,
    turnMetrics: null,
    flickScore: 80,
    trackingScore: 80,
    turnScore: 80,
    hitRateScore: 80,
    smoothnessScore: 80,
    overshootPenalty: 0,
    autoWeightedScore: 80,
    manualWeightedScore: null,
    combinedWeightedScore: 80,
    interpretationTags: ['balanced'],
    runCount: 3,
  };
}

describe('buildAnalysisSummary', () => {
  it('현재 감도 자체를 안정 범위와 비교한다', () => {
    const summary = buildAnalysisSummary({
      currentSensitivity: 4,
      summaries: [createSummary(3)],
      bestSensitivity: 3,
      safeRange: { min: 2.8, max: 3.2 },
      validationResult: null,
    });

    expect(summary.currentPaceText).toContain('빠른 편');
  });

  it('추천 안정 범위가 없으면 측정 후보만으로 안정 구간을 단정하지 않는다', () => {
    const summary = buildAnalysisSummary({
      currentSensitivity: 3,
      summaries: [createSummary(2.8), createSummary(3.2)],
      bestSensitivity: 3.2,
      safeRange: null,
      validationResult: null,
    });

    expect(summary.stableRangeText).toBe(
      '이번 측정에서는 안정 범위를 확정하지 못해 추천값만 제시합니다.',
    );
    expect(summary.explanationLines.join(' ')).not.toContain('가장 안정적인 결과');
  });
});
