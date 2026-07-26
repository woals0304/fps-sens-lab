import {
  DIRECTION_MEANINGFUL_GAP,
  DIRECTION_SIMILAR_SCORE_DELTA,
  DIRECTION_WIN_COUNT_THRESHOLD,
  FOCUSED_PROBE_MAX_STEP,
  FOCUSED_PROBE_MIN_STEP,
  MAX_ALLOWED_SENSITIVITY,
  MAX_SEARCH_RECENTER_COUNT,
  MIN_ALLOWED_SENSITIVITY,
  RECENTER_MAX_SHIFT,
  RECENTER_MIN_SHIFT,
  WIDE_PROBE_FAR_MAX_OFFSET,
  WIDE_PROBE_FAR_MIN_OFFSET,
  WIDE_PROBE_FAR_RATIO,
  WIDE_PROBE_NEAR_MAX_OFFSET,
  WIDE_PROBE_NEAR_MIN_OFFSET,
  WIDE_PROBE_NEAR_RATIO,
  WIDE_PROBE_STEP,
} from '../constants/appConstants';
import type { DirectionTrend, SensitivityLabSummary } from '../../types/models';
import { clamp } from '../utils/numberUtils';
import {
  addSensitivityStep,
  clampSensitivity,
  compareSensitivity,
  normalizeSensitivity,
} from '../utils/sensitivity';

export interface DirectionTrendResult {
  trend: DirectionTrend;
  lowerWins: number;
  higherWins: number;
  similarCount: number;
  lowerStrength: number;
  higherStrength: number;
  winningSensitivity: number | null;
  recommendedCenter: number | null;
  reason: string;
}

function getSummaryScore(summary: SensitivityLabSummary): number {
  return summary.combinedWeightedScore ?? summary.autoWeightedScore ?? 0;
}

function roundToProbeStep(value: number): number {
  return normalizeSensitivity(Math.round(value / WIDE_PROBE_STEP) * WIDE_PROBE_STEP);
}

function dedupeAndSort(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => normalizeSensitivity(value)))).sort((left, right) =>
    compareSensitivity(left, right),
  );
}

function ensureFiveCandidates(values: number[], center: number, step: number): number[] {
  const result = [...values];

  while (result.length < 5) {
    const lowest = result[0] ?? center;
    const highest = result[result.length - 1] ?? center;
    const lowerCandidate = clampSensitivity(addSensitivityStep(lowest, -step));
    const upperCandidate = clampSensitivity(addSensitivityStep(highest, step));
    let addedCandidate = false;

    if (!result.includes(lowerCandidate)) {
      result.unshift(lowerCandidate);
      addedCandidate = true;
    }

    if (result.length < 5 && !result.includes(upperCandidate)) {
      result.push(upperCandidate);
      addedCandidate = true;
    }

    if (!addedCandidate) {
      break;
    }
  }

  return dedupeAndSort(result);
}

export function buildWideProbeCandidates(currentSensitivity: number): number[] {
  const center = clampSensitivity(currentSensitivity);
  const nearOffset = roundToProbeStep(
    clamp(center * WIDE_PROBE_NEAR_RATIO, WIDE_PROBE_NEAR_MIN_OFFSET, WIDE_PROBE_NEAR_MAX_OFFSET),
  );
  const farOffset = roundToProbeStep(
    clamp(center * WIDE_PROBE_FAR_RATIO, WIDE_PROBE_FAR_MIN_OFFSET, WIDE_PROBE_FAR_MAX_OFFSET),
  );
  const values = dedupeAndSort([
    clampSensitivity(addSensitivityStep(center, -farOffset)),
    clampSensitivity(addSensitivityStep(center, -nearOffset)),
    center,
    clampSensitivity(addSensitivityStep(center, nearOffset)),
    clampSensitivity(addSensitivityStep(center, farOffset)),
  ]);

  return ensureFiveCandidates(values, center, WIDE_PROBE_STEP).slice(0, 5);
}

export function buildFocusedCandidates(searchCenter: number, baseStep: number): number[] {
  const center = clampSensitivity(searchCenter);
  const step = normalizeSensitivity(
    clamp(baseStep, FOCUSED_PROBE_MIN_STEP, FOCUSED_PROBE_MAX_STEP),
  );

  return dedupeAndSort([
    clampSensitivity(addSensitivityStep(center, -step * 2)),
    clampSensitivity(addSensitivityStep(center, -step)),
    center,
    clampSensitivity(addSensitivityStep(center, step)),
    clampSensitivity(addSensitivityStep(center, step * 2)),
  ]);
}

export function isMeaningfulTrend(result: DirectionTrendResult): boolean {
  if (result.trend === 'stable' || result.trend === 'unclear') {
    return false;
  }

  const dominantStrength = Math.max(result.lowerStrength, result.higherStrength);
  const dominantWins = Math.max(result.lowerWins, result.higherWins);
  return dominantWins >= DIRECTION_WIN_COUNT_THRESHOLD && dominantStrength >= DIRECTION_MEANINGFUL_GAP;
}

export function detectDirectionTrend(
  currentCenter: number,
  summaries: SensitivityLabSummary[],
): DirectionTrendResult {
  const center = clampSensitivity(currentCenter);
  const ordered = [...summaries].sort((left, right) => compareSensitivity(left.sensitivity, right.sensitivity));
  const centerSummary =
    ordered.find((summary) => summary.sensitivity === center) ??
    [...ordered].sort(
      (left, right) =>
        Math.abs(left.sensitivity - center) - Math.abs(right.sensitivity - center),
    )[0] ??
    null;
  const centerScore = centerSummary ? getSummaryScore(centerSummary) : 0;
  let lowerWins = 0;
  let higherWins = 0;
  let similarCount = 0;
  let lowerStrength = 0;
  let higherStrength = 0;
  let bestLowerSummary: SensitivityLabSummary | null = null;
  let bestHigherSummary: SensitivityLabSummary | null = null;

  for (const summary of ordered) {
    if (summary.sensitivity === centerSummary?.sensitivity) {
      continue;
    }

    const scoreDelta = getSummaryScore(summary) - centerScore;
    const distance = Math.abs(summary.sensitivity - center);
    const weightedDelta = scoreDelta * (1 + distance);

    if (Math.abs(scoreDelta) <= DIRECTION_SIMILAR_SCORE_DELTA) {
      similarCount += 1;
      continue;
    }

    if (summary.sensitivity < center && scoreDelta > 0) {
      lowerWins += 1;
      lowerStrength += weightedDelta;
      if (!bestLowerSummary || getSummaryScore(summary) > getSummaryScore(bestLowerSummary)) {
        bestLowerSummary = summary;
      }
    }

    if (summary.sensitivity > center && scoreDelta > 0) {
      higherWins += 1;
      higherStrength += weightedDelta;
      if (!bestHigherSummary || getSummaryScore(summary) > getSummaryScore(bestHigherSummary)) {
        bestHigherSummary = summary;
      }
    }
  }

  let trend: DirectionTrend = 'unclear';

  if (similarCount >= 2 && Math.abs(lowerStrength - higherStrength) < DIRECTION_MEANINGFUL_GAP) {
    trend = 'stable';
  } else if (
    lowerWins >= DIRECTION_WIN_COUNT_THRESHOLD &&
    lowerStrength - higherStrength >= DIRECTION_MEANINGFUL_GAP
  ) {
    trend = 'lower';
  } else if (
    higherWins >= DIRECTION_WIN_COUNT_THRESHOLD &&
    higherStrength - lowerStrength >= DIRECTION_MEANINGFUL_GAP
  ) {
    trend = 'higher';
  }

  const winningSummary =
    trend === 'lower' ? bestLowerSummary : trend === 'higher' ? bestHigherSummary : null;

  const recommendedCenter =
    trend === 'unclear' || trend === 'stable' || !winningSummary
      ? null
      : recenterSearchWindow(center, trend, winningSummary.sensitivity);

  let reason = '현재 감도 주변과 먼 구간을 함께 비교했지만 한쪽 방향 우세가 아직 뚜렷하지 않습니다.';

  if (trend === 'lower') {
    reason = `현재 감도보다 낮은 쪽 후보가 ${lowerWins}번 더 안정적이어서 탐색 중심을 낮은 쪽으로 옮깁니다.`;
  } else if (trend === 'higher') {
    reason = `현재 감도보다 높은 쪽 후보가 ${higherWins}번 더 안정적이어서 탐색 중심을 높은 쪽으로 옮깁니다.`;
  } else if (trend === 'stable') {
    reason = '현재 감도 주변에서 큰 차이가 보이지 않아 과한 중심 이동 없이 다음 비교로 넘어갑니다.';
  }

  return {
    trend,
    lowerWins,
    higherWins,
    similarCount,
    lowerStrength: normalizeSensitivity(lowerStrength),
    higherStrength: normalizeSensitivity(higherStrength),
    winningSensitivity: winningSummary?.sensitivity ?? null,
    recommendedCenter,
    reason,
  };
}

export function recenterSearchWindow(
  currentCenter: number,
  trend: DirectionTrend,
  targetSensitivity: number | null,
): number {
  const center = clampSensitivity(currentCenter);

  if (trend === 'stable' || trend === 'unclear' || targetSensitivity === null) {
    return center;
  }

  const target = clampSensitivity(targetSensitivity);
  if ((trend === 'lower' && target >= center) || (trend === 'higher' && target <= center)) {
    return center;
  }

  const distance = target - center;
  const shift = clamp(Math.abs(distance) * 0.65, RECENTER_MIN_SHIFT, RECENTER_MAX_SHIFT);

  return clampSensitivity(center + Math.sign(distance) * Math.min(Math.abs(distance), shift));
}

export function shouldRecenterSearch(result: DirectionTrendResult, recenterCount: number): boolean {
  if (recenterCount >= MAX_SEARCH_RECENTER_COUNT) {
    return false;
  }

  return isMeaningfulTrend(result) && result.recommendedCenter !== null;
}
