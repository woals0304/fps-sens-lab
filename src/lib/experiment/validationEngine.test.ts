import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants/appConstants';
import type { SensitivityLabSummary } from '../../types/models';
import { evaluateValidationResult, getValidationCandidateSensitivities } from './validationEngine';

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

describe('validationEngine', () => {
  it.each([
    [createSummary(2.4, 80)],
    [createSummary(2.42, 90), createSummary(2.44, 85)],
    [createSummary(2.4, 80), createSummary(2.4, 82)],
  ])('기준 후보와 서로 다른 비교 후보가 없으면 판단을 보류한다: %j', (...runs) => {
    const result = evaluateValidationResult({
      baselineSensitivity: 2.4,
      validationRuns: runs,
    });
    expect(result.passed).toBeNull();
    expect(result.finalSensitivity).toBe(2.4);
    expect(result.validatedAt).toBeNull();
  });

  it.each([0, 1, -1])('작은 차이 %s점은 최적값 확정 근거로 쓰지 않는다', (gap) => {
    const baseline = createSummary(2.4, 80);
    baseline.interpretationTags = ['too_fast'];
    const result = evaluateValidationResult({
      baselineSensitivity: 2.4,
      validationRuns: [baseline, createSummary(2.42, 80 + gap)],
    });
    expect(result.passed).toBeNull();
    expect(result.finalSensitivity).toBe(2.4);
    expect(result.validatedAt).toBeNull();
  });

  it.each([[80, 85, false, 2.42], [85, 80, true, 2.4]])(
    '분명한 점수 차이는 기존 내부 판정 기준으로 처리한다', (base, other, passed, final) => {
      const result = evaluateValidationResult({
        baselineSensitivity: 2.4,
        validationRuns: [createSummary(2.4, base as number), createSummary(2.42, other as number)],
      });
      expect(result.passed).toBe(passed);
      expect(result.finalSensitivity).toBe(final);
    },
  );

  it('최종 확인 후보를 추천 감도 주변 2자리 간격으로 만든다', () => {
    const candidates = getValidationCandidateSensitivities(
      {
        ...DEFAULT_SETTINGS,
        step: 0.1,
      },
      {
        bestSensitivity: 2.63,
        preValidationSensitivity: 2.63,
        finalSensitivity: 2.63,
        validationPassed: null,
        safeRange: null,
        slightlyLowerBackup: null,
        slightlyHigherBackup: null,
        topCandidates: [],
        reasonSummary: [],
        nextTestCandidates: [],
      },
      [],
    );

    expect(candidates).toEqual([2.63, 2.61, 2.65]);
  });

  it('유지와 변경 기준 사이의 애매한 점수 차이를 통과로 확정하지 않는다', () => {
    const result = evaluateValidationResult({
      baselineSensitivity: 2.4,
      validationRuns: [createSummary(2.4, 80), createSummary(2.42, 82)],
    });

    expect(result.passed).toBeNull();
    expect(result.finalSensitivity).toBe(2.4);
    expect(result.decisionReason.join(' ')).toContain('판단을 보류');
  });
});
