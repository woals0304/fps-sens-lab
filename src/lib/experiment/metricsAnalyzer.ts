import {
  BALANCE_SCORE_GAP_THRESHOLD,
  OVERSHOOT_ALERT_PENALTY,
  TURN_SLOW_TIME_MS,
} from '../constants/appConstants';
import type {
  AnalysisSummary,
  FlickMetrics,
  LabRun,
  RangeTestEntry,
  SafeRange,
  SensitivityLabSummary,
  SensitivityTrendTag,
  TrackingMetrics,
  TurnMetrics,
  ValidationResult,
} from '../../types/models';
import {
  calculateAutoWeightedScore,
  combineManualAndAutoScores,
} from '../scoring/calculateAutoWeightedScore';
import { roundTo } from '../utils/numberUtils';
import { formatSensitivity } from '../utils/sensitivity';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averageBy<T>(items: T[], selector: (item: T) => number): number {
  return average(items.map(selector));
}

function getSummaryScore(summary: SensitivityLabSummary): number {
  return summary.combinedWeightedScore ?? summary.autoWeightedScore ?? 0;
}

function joinSensitivityValues(values: number[]): string {
  return values.map((value) => formatSensitivity(value)).join(', ');
}

function findClosestSummary(
  summaries: SensitivityLabSummary[],
  sensitivity: number,
): SensitivityLabSummary | null {
  if (summaries.length === 0) {
    return null;
  }

  return [...summaries].sort(
    (left, right) => Math.abs(left.sensitivity - sensitivity) - Math.abs(right.sensitivity - sensitivity),
  )[0];
}

function averageFlickMetrics(items: FlickMetrics[]): FlickMetrics {
  return {
    shotCount: roundTo(averageBy(items, (item) => item.shotCount), 2),
    hits: roundTo(averageBy(items, (item) => item.hits), 2),
    misses: roundTo(averageBy(items, (item) => item.misses), 2),
    hitRate: roundTo(averageBy(items, (item) => item.hitRate), 4),
    oneShotHitRate: roundTo(averageBy(items, (item) => item.oneShotHitRate), 4),
    averageTimeToHitMs: roundTo(averageBy(items, (item) => item.averageTimeToHitMs), 2),
    averageCorrectionTimeMs: roundTo(averageBy(items, (item) => item.averageCorrectionTimeMs), 2),
    overshootEvents: roundTo(averageBy(items, (item) => item.overshootEvents), 2),
    overshootReturnCount: roundTo(averageBy(items, (item) => item.overshootReturnCount), 2),
    reacquireCount: roundTo(averageBy(items, (item) => item.reacquireCount), 2),
    firstEnterDelayMs: roundTo(averageBy(items, (item) => item.firstEnterDelayMs), 2),
    preClickJitter: roundTo(averageBy(items, (item) => item.preClickJitter), 4),
    averageOvershootAmount: roundTo(averageBy(items, (item) => item.averageOvershootAmount), 2),
  };
}

function averageTrackingMetrics(items: TrackingMetrics[]): TrackingMetrics {
  return {
    durationMs: roundTo(averageBy(items, (item) => item.durationMs), 2),
    averageCrosshairDistanceDeg: roundTo(averageBy(items, (item) => item.averageCrosshairDistanceDeg), 3),
    timeOnTargetRatio: roundTo(averageBy(items, (item) => item.timeOnTargetRatio), 4),
    followStability: roundTo(averageBy(items, (item) => item.followStability), 2),
    movementSmoothness: roundTo(averageBy(items, (item) => item.movementSmoothness), 2),
    trackingLossCount: roundTo(averageBy(items, (item) => item.trackingLossCount), 2),
    averageCorrectionFrequency: roundTo(
      averageBy(items, (item) => item.averageCorrectionFrequency),
      2,
    ),
  };
}

function averageTurnMetrics(items: TurnMetrics[]): TurnMetrics {
  return {
    instructionCount: roundTo(averageBy(items, (item) => item.instructionCount), 2),
    completionRate: roundTo(averageBy(items, (item) => item.completionRate), 4),
    completionTimeMs: roundTo(averageBy(items, (item) => item.completionTimeMs), 2),
    angularErrorDeg: roundTo(averageBy(items, (item) => item.angularErrorDeg), 2),
    overshootAngleDeg: roundTo(averageBy(items, (item) => item.overshootAngleDeg), 2),
    correctionCount: roundTo(averageBy(items, (item) => item.correctionCount), 2),
    stabilizationTimeMs: roundTo(averageBy(items, (item) => item.stabilizationTimeMs), 2),
  };
}

export function analyzeSummaryTags(summary: SensitivityLabSummary): SensitivityTrendTag[] {
  const tags: SensitivityTrendTag[] = [];

  if (
    summary.trackingScore > 0 &&
    summary.flickScore > 0 &&
    summary.flickScore - summary.trackingScore >= BALANCE_SCORE_GAP_THRESHOLD
  ) {
    tags.push('too_fast');
  }

  if (summary.turnMetrics && summary.turnMetrics.completionTimeMs > TURN_SLOW_TIME_MS) {
    tags.push('too_slow');
  }

  if (summary.overshootPenalty >= OVERSHOOT_ALERT_PENALTY) {
    tags.push('too_fast');
  }

  if (
    (summary.turnMetrics && summary.turnMetrics.correctionCount >= 3) ||
    (summary.flickMetrics && summary.flickMetrics.overshootReturnCount >= 3)
  ) {
    tags.push('fine_control_issue');
  }

  if ((summary.combinedWeightedScore ?? summary.autoWeightedScore ?? 0) >= 72 && tags.length === 0) {
    tags.push('stable_zone');
  }

  if (tags.length === 0) {
    tags.push('balanced');
  }

  return Array.from(new Set(tags));
}

export function buildLabSummariesFromRuns(
  labRuns: LabRun[],
  rangeEntries: RangeTestEntry[],
): SensitivityLabSummary[] {
  const grouped = new Map<number, LabRun[]>();
  const manualMap = new Map(rangeEntries.map((entry) => [entry.sensitivity, entry.weightedScore]));

  for (const run of labRuns) {
    const current = grouped.get(run.sensitivity) ?? [];
    grouped.set(run.sensitivity, [...current, run]);
  }

  return Array.from(grouped.entries())
    .map(([sensitivity, runs]) => {
      const flickRuns = runs.filter((run) => run.mode === 'flick').map((run) => run.metrics as FlickMetrics);
      const trackingRuns = runs
        .filter((run) => run.mode === 'tracking')
        .map((run) => run.metrics as TrackingMetrics);
      const turnRuns = runs.filter((run) => run.mode === 'turn').map((run) => run.metrics as TurnMetrics);
      const flickMetrics = flickRuns.length > 0 ? averageFlickMetrics(flickRuns) : null;
      const trackingMetrics = trackingRuns.length > 0 ? averageTrackingMetrics(trackingRuns) : null;
      const turnMetrics = turnRuns.length > 0 ? averageTurnMetrics(turnRuns) : null;
      const autoScores = calculateAutoWeightedScore({
        flickMetrics,
        trackingMetrics,
        turnMetrics,
      });
      const manualWeightedScore = manualMap.get(sensitivity) ?? null;
      const summary: SensitivityLabSummary = {
        sensitivity,
        flickMetrics,
        trackingMetrics,
        turnMetrics,
        flickScore: autoScores.flickScore ?? 0,
        trackingScore: autoScores.trackingScore ?? 0,
        turnScore: autoScores.turnScore ?? 0,
        hitRateScore: autoScores.hitRateScore ?? 0,
        smoothnessScore: autoScores.smoothnessScore ?? 0,
        overshootPenalty: autoScores.overshootPenalty,
        autoWeightedScore: autoScores.autoWeightedScore,
        manualWeightedScore,
        combinedWeightedScore: combineManualAndAutoScores(autoScores.autoWeightedScore, manualWeightedScore),
        interpretationTags: [],
        runCount: runs.length,
      };

      summary.interpretationTags = analyzeSummaryTags(summary);
      return summary;
    })
    .sort((left, right) => left.sensitivity - right.sensitivity);
}

export function buildTrendTexts(summaries: SensitivityLabSummary[]): {
  tooFastText: string;
  tooSlowText: string;
  reasons: string[];
} {
  const tooFast = summaries.filter((summary) => summary.interpretationTags.includes('too_fast'));
  const tooSlow = summaries.filter((summary) => summary.interpretationTags.includes('too_slow'));
  const stable = summaries.filter((summary) => summary.interpretationTags.includes('stable_zone'));
  const reasons: string[] = [];

  if (stable.length > 0) {
    reasons.push(
      `${joinSensitivityValues(stable.map((summary) => summary.sensitivity))} 구간에서 자동 측정 안정성이 높았습니다.`,
    );
  }

  if (tooFast.length > 0) {
    reasons.push(
      `${joinSensitivityValues(tooFast.map((summary) => summary.sensitivity))} 이상에서 지나침 경향이 반복됐습니다.`,
    );
  }

  if (tooSlow.length > 0) {
    reasons.push(
      `${joinSensitivityValues(tooSlow.map((summary) => summary.sensitivity))} 이하에서 회전 반응이 다소 느렸습니다.`,
    );
  }

  return {
    tooFastText:
      tooFast.length > 0
        ? `${joinSensitivityValues(tooFast.map((summary) => summary.sensitivity))} 구간은 다소 빠른 편입니다.`
        : '자동 측정 기준으로는 뚜렷한 과속 구간이 아직 없습니다.',
    tooSlowText:
      tooSlow.length > 0
        ? `${joinSensitivityValues(tooSlow.map((summary) => summary.sensitivity))} 구간은 다소 느린 편입니다.`
        : '자동 측정 기준으로는 뚜렷한 저속 구간이 아직 없습니다.',
    reasons,
  };
}

export function buildAnalysisSummary(input: {
  currentSensitivity: number;
  summaries: SensitivityLabSummary[];
  bestSensitivity: number | null;
  safeRange: SafeRange | null;
  validationResult: ValidationResult | null;
}): AnalysisSummary {
  const { currentSensitivity, summaries, bestSensitivity, safeRange, validationResult } = input;

  if (summaries.length === 0 || bestSensitivity === null) {
    return {
      currentPaceText: '아직 자동 측정 결과가 부족해서 현재 감도의 빠름/느림을 판단하기 어렵습니다.',
      stableRangeText: '충분한 자동 측정이 모이면 안정 구간을 계산합니다.',
      overshootText: '아직 지나침이 어느 구간부터 늘어나는지 말할 만큼 데이터가 쌓이지 않았습니다.',
      turnSlowText: '아직 회전 반응이 어느 구간에서 느려지는지 말할 만큼 데이터가 쌓이지 않았습니다.',
      balanceText: '아직 순간 조준과 추적 조준의 균형 구간을 계산할 데이터가 부족합니다.',
      recommendationText: '먼저 자동 측정을 조금 더 진행해 주세요.',
      explanationLines: ['자동 측정 데이터가 더 쌓이면 추천 근거 문장이 자동으로 채워집니다.'],
    };
  }

  const overshootSummaries = summaries
    .filter(
      (summary) =>
        summary.overshootPenalty >= OVERSHOOT_ALERT_PENALTY ||
        summary.interpretationTags.includes('too_fast'),
    )
    .sort((left, right) => left.sensitivity - right.sensitivity);

  const turnSlowSummaries = summaries
    .filter(
      (summary) =>
        (summary.turnMetrics?.completionTimeMs ?? 0) >= TURN_SLOW_TIME_MS ||
        summary.interpretationTags.includes('too_slow'),
    )
    .sort((left, right) => left.sensitivity - right.sensitivity);

  const balanceCandidate = [...summaries]
    .sort((left, right) => {
      const leftGap = Math.abs(left.flickScore - left.trackingScore);
      const rightGap = Math.abs(right.flickScore - right.trackingScore);

      if (leftGap !== rightGap) {
        return leftGap - rightGap;
      }

      return getSummaryScore(right) - getSummaryScore(left);
    })[0];

  const currentSummary = findClosestSummary(summaries, currentSensitivity);
  let currentPaceText = `현재 감도 ${formatSensitivity(currentSensitivity)}은 아직 크게 빠르거나 느린 쪽으로 치우치지 않았습니다.`;

  if (
    (safeRange !== null && currentSensitivity > safeRange.max) ||
    currentSummary?.interpretationTags.includes('too_fast')
  ) {
    currentPaceText = `현재 감도 ${formatSensitivity(currentSensitivity)}은 추천 구간보다 약간 빠른 편입니다.`;
  } else if (
    (safeRange !== null && currentSensitivity < safeRange.min) ||
    currentSummary?.interpretationTags.includes('too_slow')
  ) {
    currentPaceText = `현재 감도 ${formatSensitivity(currentSensitivity)}은 추천 구간보다 약간 느린 편입니다.`;
  }

  const currentGap = Math.abs(bestSensitivity - currentSensitivity);
  const recenterText =
    currentGap >= Math.max(0.3, currentSensitivity * 0.12)
      ? bestSensitivity < currentSensitivity
        ? '현재 감도보다 낮은 쪽에서 더 안정적인 결과가 반복되어 탐색 중심을 더 낮은 구간으로 옮겨 확인했습니다.'
        : '현재 감도보다 높은 쪽에서 더 안정적인 결과가 반복되어 탐색 중심을 더 높은 구간으로 옮겨 확인했습니다.'
      : null;
  const farBetterText =
    currentGap >= 0.45
      ? '입력한 현재 감도와 거리가 있는 구간에서 더 좋은 반응이 나와 탐색 중심을 다시 잡았습니다.'
      : null;

  const stableRangeText = safeRange
    ? `${formatSensitivity(safeRange.min)}~${formatSensitivity(safeRange.max)} 구간을 안정 범위로 확인했습니다.`
    : '이번 측정에서는 안정 범위를 확정하지 못해 추천값만 제시합니다.';
  const overshootText =
    overshootSummaries.length > 0
      ? `${formatSensitivity(overshootSummaries[0].sensitivity)} 이상에서는 지나침이 뚜렷하게 늘었습니다.`
      : '측정된 감도 범위 안에서는 지나침이 급격히 늘어나는 지점이 아직 뚜렷하지 않습니다.';
  const turnSlowText =
    turnSlowSummaries.length > 0
      ? `${formatSensitivity(turnSlowSummaries[0].sensitivity)} 이하에서는 회전 반응이 다소 느렸습니다.`
      : '측정된 감도 범위 안에서는 회전 반응이 크게 느려지는 구간이 아직 뚜렷하지 않습니다.';
  const balanceText = `${formatSensitivity(balanceCandidate.sensitivity)} 부근에서 순간 조준과 추적 조준의 균형이 가장 좋았습니다.`;

  const validationLine = validationResult
    ? validationResult.passed
      ? `최종 검증에서도 ${formatSensitivity(validationResult.finalSensitivity)} 감도가 유지됐습니다.`
      : `최종 검증 뒤 ${formatSensitivity(validationResult.finalSensitivity)} 감도로 미세 조정됐습니다.`
    : '아직 최종 검증 단계 전이라서 마지막 확인은 남아 있습니다.';

  const recommendationText =
    safeRange !== null
      ? `추천 감도는 ${formatSensitivity(bestSensitivity)}이며, 안정 범위는 ${formatSensitivity(safeRange.min)}~${formatSensitivity(safeRange.max)}입니다. ${validationLine}`
      : `추천 감도는 ${formatSensitivity(bestSensitivity)}입니다. ${validationLine}`;

  return {
    currentPaceText,
    stableRangeText,
    overshootText,
    turnSlowText,
    balanceText,
    recommendationText,
    explanationLines: [
      currentPaceText,
      stableRangeText,
      overshootText,
      turnSlowText,
      balanceText,
      recenterText,
      farBetterText,
      recommendationText,
    ].filter((line): line is string => Boolean(line)),
  };
}
