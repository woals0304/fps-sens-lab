import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants/appConstants';
import { calculateWeightedScore } from '../scoring/calculateWeightedScore';
import { buildRecommendation } from './recommendationEngine';

describe('buildRecommendation', () => {
  it('best, safe range, backup, next test를 항상 만든다', () => {
    const rangeEntries = [
      {
        sensitivity: 2.1,
        accuracyScore: 70,
        trackingComfort: 72,
        flickComfort: 68,
        overshoot: 20,
        overallFeeling: 75,
        memo: '좋음',
        weightedScore: calculateWeightedScore({
          accuracyScore: 70,
          trackingComfort: 72,
          flickComfort: 68,
          overshoot: 20,
          overallFeeling: 75,
        }),
        testedAt: new Date().toISOString(),
      },
      {
        sensitivity: 2.3,
        accuracyScore: 82,
        trackingComfort: 78,
        flickComfort: 75,
        overshoot: 28,
        overallFeeling: 84,
        memo: '가장 자연스러움',
        weightedScore: calculateWeightedScore({
          accuracyScore: 82,
          trackingComfort: 78,
          flickComfort: 75,
          overshoot: 28,
          overallFeeling: 84,
        }),
        testedAt: new Date().toISOString(),
      },
      {
        sensitivity: 2.5,
        accuracyScore: 73,
        trackingComfort: 70,
        flickComfort: 69,
        overshoot: 45,
        overallFeeling: 72,
        memo: '조금 빠름',
        weightedScore: calculateWeightedScore({
          accuracyScore: 73,
          trackingComfort: 70,
          flickComfort: 69,
          overshoot: 45,
          overallFeeling: 72,
        }),
        testedAt: new Date().toISOString(),
      },
    ];

    const recommendation = buildRecommendation(DEFAULT_SETTINGS, rangeEntries, [
      {
        candidateA: 2.3,
        candidateB: 2.5,
        choice: 'A',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(recommendation.bestSensitivity).toBe(2.3);
    expect(recommendation.safeRange).not.toBeNull();
    expect(recommendation.slightlyLowerBackup).not.toBeNull();
    expect(recommendation.slightlyHigherBackup).not.toBeNull();
    expect(recommendation.topCandidates.length).toBeGreaterThan(0);
    expect(recommendation.reasonSummary.length).toBeGreaterThan(0);
    expect(recommendation.nextTestCandidates.length).toBeLessThanOrEqual(2);
  });

  it('최종 추천이 2자리 감도일 때 상하 대안도 2자리 기준으로 만든다', () => {
    const recommendation = buildRecommendation(
      {
        ...DEFAULT_SETTINGS,
        step: 0.1,
      },
      [],
      [],
      [],
      null,
      {
        baselineSensitivity: 1.8,
        comparedSensitivities: [1.8, 1.82, 1.84],
        candidateResults: [],
        passed: false,
        finalSensitivity: 1.82,
        decisionReason: ['정밀 비교에서 1.82가 더 안정적이었습니다.'],
        validatedAt: new Date().toISOString(),
      },
    );

    expect(recommendation.bestSensitivity).toBe(1.82);
    expect(recommendation.slightlyLowerBackup).toBe(1.8);
    expect(recommendation.slightlyHigherBackup).toBe(1.84);
  });

  it('측정 근거가 없으면 빈 후보 점수 대신 AI 예측을 사용한다', () => {
    const recommendation = buildRecommendation(DEFAULT_SETTINGS, [], [], [], {
      predictedBestSensitivity: 2.73,
      recommendedNextPair: null,
      confidence: 0.8,
      generatedAt: new Date().toISOString(),
    });

    expect(recommendation.bestSensitivity).toBe(2.73);
    expect(recommendation.topCandidates).toEqual([]);
  });

  it('인접한 0.01 감도를 최종 감도 자신과 구분해 대안을 만든다', () => {
    const recommendation = buildRecommendation(
      {
        ...DEFAULT_SETTINGS,
        currentSensitivity: 2.5,
        minSensitivity: 2.49,
        maxSensitivity: 2.51,
        step: 0.01,
      },
      [],
      [],
      [],
      null,
      {
        baselineSensitivity: 2.5,
        comparedSensitivities: [2.49, 2.5, 2.51],
        candidateResults: [],
        passed: true,
        finalSensitivity: 2.5,
        decisionReason: [],
        validatedAt: new Date().toISOString(),
      },
    );

    expect(recommendation.slightlyLowerBackup).toBe(2.49);
    expect(recommendation.slightlyHigherBackup).toBe(2.51);
  });

  it('다음 시험 후보는 추천 감도에서 가까운 양쪽 값을 우선한다', () => {
    const recommendation = buildRecommendation(
      {
        ...DEFAULT_SETTINGS,
        currentSensitivity: 2.5,
        minSensitivity: 2.1,
        maxSensitivity: 2.9,
        step: 0.2,
      },
      [
        {
          sensitivity: 2.5,
          accuracyScore: 90,
          trackingComfort: 90,
          flickComfort: 90,
          overshoot: 10,
          overallFeeling: 90,
          memo: '',
          weightedScore: 90,
          testedAt: new Date().toISOString(),
        },
      ],
      [],
    );

    expect(recommendation.nextTestCandidates).toEqual([2.3, 2.7]);
  });

  it('실패 경향이 뚜렷한 검증 후보는 안정 범위에서 제외한다', () => {
    const candidateBase = {
      flickScore: 40,
      trackingScore: 40,
      turnScore: 40,
      overshootPenalty: 0,
    };
    const recommendation = buildRecommendation(DEFAULT_SETTINGS, [], [], [], null, {
      baselineSensitivity: 2.5,
      comparedSensitivities: [2.48, 2.5, 2.52],
      candidateResults: [
        {
          ...candidateBase,
          sensitivity: 2.48,
          role: 'lower',
          score: 40,
          interpretationTags: ['too_slow'],
        },
        {
          ...candidateBase,
          sensitivity: 2.5,
          role: 'recommended',
          score: 90,
          interpretationTags: ['balanced'],
        },
        {
          ...candidateBase,
          sensitivity: 2.52,
          role: 'higher',
          score: 40,
          interpretationTags: ['too_fast'],
        },
      ],
      passed: true,
      finalSensitivity: 2.5,
      decisionReason: [],
      validatedAt: new Date().toISOString(),
    });

    expect(recommendation.safeRange).toEqual({ min: 2.5, max: 2.5 });
  });

  it('검증에서 탈락한 baseline은 점수가 가까워도 안정 범위에 다시 넣지 않는다', () => {
    const candidateBase = {
      flickScore: 80,
      trackingScore: 80,
      turnScore: 80,
      overshootPenalty: 0,
    };
    const recommendation = buildRecommendation(DEFAULT_SETTINGS, [], [], [], null, {
      baselineSensitivity: 2.5,
      comparedSensitivities: [2.48, 2.5, 2.52],
      candidateResults: [
        {
          ...candidateBase,
          sensitivity: 2.48,
          role: 'lower',
          score: 92,
          interpretationTags: ['balanced'],
        },
        {
          ...candidateBase,
          sensitivity: 2.5,
          role: 'recommended',
          score: 89,
          interpretationTags: ['balanced'],
        },
        {
          ...candidateBase,
          sensitivity: 2.52,
          role: 'higher',
          score: 70,
          interpretationTags: ['too_fast'],
        },
      ],
      passed: false,
      finalSensitivity: 2.48,
      decisionReason: [],
      validatedAt: new Date().toISOString(),
    });

    expect(recommendation.safeRange).toEqual({ min: 2.48, max: 2.48 });
  });
});
