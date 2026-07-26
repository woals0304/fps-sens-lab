import { DEFAULT_SETTINGS, STANDARD_TEST_PROTOCOL } from '../lib/constants/appConstants';
import { buildAnalysisSummary, buildLabSummariesFromRuns } from '../lib/experiment/metricsAnalyzer';
import { evaluateValidationResult } from '../lib/experiment/validationEngine';
import { buildRecommendation } from '../lib/recommendation/recommendationEngine';
import { calculateWeightedScore } from '../lib/scoring/calculateWeightedScore';
import type {
  FlickMetrics,
  LabRun,
  RangeTestEntry,
  TrackingMetrics,
  TurnMetrics,
  StoredSession,
} from '../types/models';

function createRangeEntry(
  sensitivity: number,
  accuracyScore: number,
  trackingComfort: number,
  flickComfort: number,
  overshoot: number,
  overallFeeling: number,
  memo: string,
): RangeTestEntry {
  return {
    sensitivity,
    accuracyScore,
    trackingComfort,
    flickComfort,
    overshoot,
    overallFeeling,
    memo,
    weightedScore: calculateWeightedScore({
      accuracyScore,
      trackingComfort,
      flickComfort,
      overshoot,
      overallFeeling,
    }),
    testedAt: new Date().toISOString(),
  };
}

function createFlickMetrics(
  hitRate: number,
  oneShotHitRate: number,
  time: number,
  overshootReturnCount: number,
  averageOvershootAmount: number,
): FlickMetrics {
  return {
    shotCount: 20,
    hits: Math.round(hitRate * 20),
    misses: 20 - Math.round(hitRate * 20),
    hitRate,
    oneShotHitRate,
    averageTimeToHitMs: time,
    averageCorrectionTimeMs: 170,
    overshootEvents: overshootReturnCount + 1,
    overshootReturnCount,
    reacquireCount: overshootReturnCount,
    firstEnterDelayMs: 210,
    preClickJitter: 0.01,
    averageOvershootAmount,
  };
}

function createTrackingMetrics(
  distance: number,
  timeOnTargetRatio: number,
  smoothness: number,
  correctionFrequency: number,
): TrackingMetrics {
  return {
    durationMs: 15000,
    averageCrosshairDistanceDeg: distance,
    timeOnTargetRatio,
    followStability: 86 - distance * 4,
    movementSmoothness: smoothness,
    trackingLossCount: Math.max(0, Math.round(12 - timeOnTargetRatio * 12)),
    averageCorrectionFrequency: correctionFrequency,
  };
}

function createTurnMetrics(
  time: number,
  overshoot: number,
  corrections: number,
  stabilizationTimeMs: number,
): TurnMetrics {
  return {
    instructionCount: 10,
    completionRate: 1,
    completionTimeMs: time,
    angularErrorDeg: 2.2,
    overshootAngleDeg: overshoot,
    correctionCount: corrections,
    stabilizationTimeMs,
  };
}

function createLabRun(
  taskId: string,
  sensitivity: number,
  mode: LabRun['mode'],
  stage: LabRun['stage'],
  metrics: FlickMetrics | TrackingMetrics | TurnMetrics,
  pairId: string | null = null,
  pairLabel: 'A' | 'B' | null = null,
  protocolVariant: LabRun['protocolVariant'] = 'standard',
): LabRun {
  return {
    id: crypto.randomUUID(),
    taskId,
    pairId,
    pairLabel,
    stage,
    mode,
    protocolVariant,
    sensitivity,
    seed: 1100 + Math.round(sensitivity * 100),
    createdAt: new Date().toISOString(),
    metrics,
  };
}

export function createSampleSession(): StoredSession {
  const settings = {
    ...DEFAULT_SETTINGS,
    heroCategory: 'tracking' as const,
    playStyle: 'tracking-focus' as const,
  };

  const rangeEntries = [
    createRangeEntry(2.1, 77, 75, 73, 20, 79, '조준은 안정적이지만 큰 회전이 약간 느립니다.'),
    createRangeEntry(2.3, 83, 81, 78, 26, 86, '가장 자연스럽고 밸런스가 좋습니다.'),
    createRangeEntry(2.5, 76, 70, 72, 40, 74, '조금 빠르게 느껴지고 지나침이 늘어납니다.'),
    createRangeEntry(2.7, 70, 62, 68, 58, 66, '빠르지만 추적이 흔들립니다.'),
  ];

  const labRuns: LabRun[] = [
    createLabRun('range-21-f', 2.1, 'flick', 'range_test', createFlickMetrics(0.82, 0.68, 620, 2, 3.4)),
    createLabRun('range-21-t', 2.1, 'tracking', 'range_test', createTrackingMetrics(2.7, 0.76, 79, 1.4)),
    createLabRun('range-21-r', 2.1, 'turn', 'range_test', createTurnMetrics(1380, 8, 2, 240)),
    createLabRun('range-23-f', 2.3, 'flick', 'range_test', createFlickMetrics(0.9, 0.78, 560, 1, 2.1)),
    createLabRun('range-23-t', 2.3, 'tracking', 'range_test', createTrackingMetrics(2.0, 0.83, 86, 1.1)),
    createLabRun('range-23-r', 2.3, 'turn', 'range_test', createTurnMetrics(980, 6, 1, 180)),
    createLabRun('range-25-f', 2.5, 'flick', 'range_test', createFlickMetrics(0.84, 0.62, 540, 3, 5.2)),
    createLabRun('range-25-t', 2.5, 'tracking', 'range_test', createTrackingMetrics(3.0, 0.69, 72, 2.1)),
    createLabRun('range-25-r', 2.5, 'turn', 'range_test', createTurnMetrics(850, 14, 2, 220)),
    createLabRun('range-27-f', 2.7, 'flick', 'range_test', createFlickMetrics(0.78, 0.52, 520, 4, 7.1)),
    createLabRun('range-27-t', 2.7, 'tracking', 'range_test', createTrackingMetrics(3.6, 0.61, 68, 2.8)),
    createLabRun('range-27-r', 2.7, 'turn', 'range_test', createTurnMetrics(760, 18, 3, 260)),
    createLabRun('duel-a-23-f', 2.3, 'flick', 'duel_test', createFlickMetrics(0.91, 0.8, 550, 1, 2.0), 'sample-duel-1', 'A'),
    createLabRun('duel-a-23-t', 2.3, 'tracking', 'duel_test', createTrackingMetrics(2.1, 0.82, 84, 1.2), 'sample-duel-1', 'A'),
    createLabRun('duel-a-23-r', 2.3, 'turn', 'duel_test', createTurnMetrics(960, 6, 1, 170), 'sample-duel-1', 'A'),
    createLabRun('duel-b-25-f', 2.5, 'flick', 'duel_test', createFlickMetrics(0.85, 0.63, 535, 3, 5.0), 'sample-duel-1', 'B'),
    createLabRun('duel-b-25-t', 2.5, 'tracking', 'duel_test', createTrackingMetrics(3.1, 0.67, 70, 2.2), 'sample-duel-1', 'B'),
    createLabRun('duel-b-25-r', 2.5, 'turn', 'duel_test', createTurnMetrics(840, 14, 2, 210), 'sample-duel-1', 'B'),
    createLabRun('fine-24-f', 2.4, 'flick', 'fine_tune', createFlickMetrics(0.89, 0.74, 575, 1, 2.3)),
    createLabRun('fine-24-t', 2.4, 'tracking', 'fine_tune', createTrackingMetrics(2.2, 0.81, 83, 1.2)),
    createLabRun('fine-24-r', 2.4, 'turn', 'fine_tune', createTurnMetrics(940, 7, 1, 175)),
    createLabRun('val-22-f', 2.2, 'flick', 'validation', createFlickMetrics(0.86, 0.71, 600, 2, 3.0), null, null, 'validation'),
    createLabRun('val-22-t', 2.2, 'tracking', 'validation', createTrackingMetrics(2.4, 0.79, 82, 1.3), null, null, 'validation'),
    createLabRun('val-22-r', 2.2, 'turn', 'validation', createTurnMetrics(1080, 7, 1, 200), null, null, 'validation'),
    createLabRun('val-23-f', 2.3, 'flick', 'validation', createFlickMetrics(0.92, 0.8, 555, 1, 2.1), null, null, 'validation'),
    createLabRun('val-23-t', 2.3, 'tracking', 'validation', createTrackingMetrics(2.0, 0.84, 87, 1.0), null, null, 'validation'),
    createLabRun('val-23-r', 2.3, 'turn', 'validation', createTurnMetrics(955, 6, 1, 168), null, null, 'validation'),
    createLabRun('val-24-f', 2.4, 'flick', 'validation', createFlickMetrics(0.9, 0.75, 575, 1, 2.4), null, null, 'validation'),
    createLabRun('val-24-t', 2.4, 'tracking', 'validation', createTrackingMetrics(2.2, 0.81, 84, 1.1), null, null, 'validation'),
    createLabRun('val-24-r', 2.4, 'turn', 'validation', createTurnMetrics(940, 7, 1, 176), null, null, 'validation'),
  ];

  const duelMatches = [
    {
      candidateA: 2.3,
      candidateB: 2.5,
      choice: 'A' as const,
      note: '자동 측정 비교에서 2.3이 더 안정적이었습니다.',
      playedAt: new Date().toISOString(),
      source: 'auto_lab' as const,
      pairId: 'sample-duel-1',
    },
  ];

  const labSummaries = buildLabSummariesFromRuns(labRuns, rangeEntries);
  const validationSummaries = buildLabSummariesFromRuns(
    labRuns.filter((run) => run.stage === 'validation'),
    rangeEntries,
  );
  const validationResult = evaluateValidationResult({
    validationRuns: validationSummaries,
    baselineSensitivity: 2.3,
  });
  const recommendation = buildRecommendation(
    settings,
    rangeEntries,
    duelMatches,
    labSummaries,
    null,
    validationResult,
  );
  const analysisSummary = buildAnalysisSummary({
    currentSensitivity: settings.currentSensitivity,
    summaries: labSummaries,
    bestSensitivity: recommendation.bestSensitivity,
    safeRange: recommendation.safeRange,
    validationResult,
  });
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    storageVersion: 5,
    settings,
    testProtocol: STANDARD_TEST_PROTOCOL,
    rangeEntries,
    duelMatches,
    labRuns,
    labSummaries,
    analysisSummary,
    decisionLog: [
      {
        id: crypto.randomUUID(),
        stage: 'range_test',
        sensitivity: 2.3,
        action: 'advanced',
        reason: '범위 시험 가중 종합 점수가 가장 높아 비교 시험으로 올렸습니다.',
        score: 84.5,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        stage: 'duel_test',
        sensitivity: 2.5,
        action: 'eliminated',
        reason: '비교 시험과 자동 측정 결과를 함께 보면 지나침 감점이 커서 제외했습니다.',
        score: 73.8,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        stage: 'fine_tune',
        sensitivity: 2.4,
        action: 'validation_target',
        reason: '추천 후보 주변 값을 다시 짧게 확인하기 위해 최종 검증 대상으로 올렸습니다.',
        score: 82.1,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        stage: 'validation',
        sensitivity: validationResult.finalSensitivity ?? 2.3,
        action: validationResult.passed ? 'confirmed' : 'adjusted',
        reason: validationResult.passed
          ? '최종 검증에서도 가장 안정적이라 최종 감도로 확정했습니다.'
          : '최종 검증 결과를 반영해 추천 감도를 조정했습니다.',
        score: validationResult.candidateResults.find(
          (candidate) => candidate.sensitivity === validationResult.finalSensitivity,
        )?.score ?? null,
        createdAt: now,
      },
    ],
    validationResult,
    experimentState: {
      stage: 'result',
      tasks: [],
      activeTaskId: null,
      initialCenter: settings.currentSensitivity,
      searchCenter: 2.3,
      searchPhase: 'ready_for_duel',
      recenterCount: 1,
      lastDirectionTrend: 'lower',
      lastResumeTab: 'results',
      lastLabSection: 'results',
      calibrationMultiplier: 1,
      manualSensitivityOverride: null,
      recommendedPairs: [],
      stopReason: '샘플 세션은 최종 검증까지 끝난 상태입니다.',
      lastUpdatedAt: now,
    },
    recommendation,
    aiPrediction: null,
  };
}
