import {
  VALIDATION_SCORE_KEEP_THRESHOLD,
  VALIDATION_SCORE_SWITCH_THRESHOLD,
} from '../constants/appConstants';
import {
  addSensitivityStep,
  clampSensitivity,
  formatSensitivity,
  getValidationOffset,
  normalizeSensitivity,
} from '../utils/sensitivity';
import type {
  AppSettings,
  RecommendationResult,
  SensitivityLabSummary,
  ValidationCandidateResult,
  ValidationCandidateRole,
  ValidationResult,
} from '../../types/models';

function getSummaryScore(summary: SensitivityLabSummary): number {
  return summary.combinedWeightedScore ?? summary.autoWeightedScore ?? 0;
}

function getRole(base: number, sensitivity: number): ValidationCandidateRole {
  if (sensitivity < base) {
    return 'lower';
  }

  if (sensitivity > base) {
    return 'higher';
  }

  return 'recommended';
}

export function getValidationCandidateSensitivities(
  settings: AppSettings,
  recommendation: RecommendationResult,
  summaries: SensitivityLabSummary[],
): number[] {
  const base = normalizeSensitivity(
    recommendation.preValidationSensitivity ??
      recommendation.bestSensitivity ??
      summaries[0]?.sensitivity ??
      settings.currentSensitivity,
  );
  const validationOffset = getValidationOffset(settings.step);
  const lower = clampSensitivity(addSensitivityStep(base, -validationOffset));
  const higher = clampSensitivity(addSensitivityStep(base, validationOffset));

  // 마지막 확인은 추천 감도 바로 옆 값을 다시 보는 단계입니다.
  return Array.from(new Set([base, lower, higher]))
    .map((value) => clampSensitivity(value));
}

export function evaluateValidationResult(input: {
  validationRuns: SensitivityLabSummary[];
  baselineSensitivity: number | null;
}): ValidationResult {
  const baselineSensitivity = input.baselineSensitivity;
  const ranked = [...input.validationRuns].sort((left, right) => getSummaryScore(right) - getSummaryScore(left));
  const baseline = ranked.find((summary) => summary.sensitivity === baselineSensitivity) ?? null;
  const winner = ranked[0] ?? null;
  const second = ranked[1] ?? null;

  const candidateResults: ValidationCandidateResult[] = ranked.map((summary) => ({
    sensitivity: summary.sensitivity,
    role: baselineSensitivity === null ? 'recommended' : getRole(baselineSensitivity, summary.sensitivity),
    score: getSummaryScore(summary),
    flickScore: summary.flickScore,
    trackingScore: summary.trackingScore,
    turnScore: summary.turnScore,
    overshootPenalty: summary.overshootPenalty,
    interpretationTags: summary.interpretationTags,
  }));

  if (!winner || baselineSensitivity === null) {
    return {
      baselineSensitivity,
      comparedSensitivities: ranked.map((summary) => summary.sensitivity),
      candidateResults,
      passed: null,
      finalSensitivity: winner?.sensitivity ?? baselineSensitivity,
      decisionReason: ['최종 확인에 필요한 비교 결과가 아직 충분하지 않습니다.'],
      validatedAt: null,
    };
  }

  const baselineScore = baseline ? getSummaryScore(baseline) : -Infinity;
  const winnerScore = getSummaryScore(winner);
  const scoreGap = winnerScore - baselineScore;
  const stableBaseline =
    baseline !== null &&
    !baseline.interpretationTags.includes('too_fast') &&
    !baseline.interpretationTags.includes('too_slow');

  let passed: boolean | null = true;
  let finalSensitivity = baselineSensitivity;
  const decisionReason: string[] = [];

  if (winner.sensitivity !== baselineSensitivity && scoreGap >= VALIDATION_SCORE_SWITCH_THRESHOLD) {
    passed = false;
    finalSensitivity = winner.sensitivity;
    decisionReason.push(
      `${formatSensitivity(winner.sensitivity)} 감도가 최종 확인에서 ${scoreGap.toFixed(1)}점 더 높아 최종 추천을 조정했습니다.`,
    );
  } else if (winner.sensitivity === baselineSensitivity || scoreGap <= VALIDATION_SCORE_KEEP_THRESHOLD) {
    passed = true;
    finalSensitivity = baselineSensitivity;
    decisionReason.push(
      `${formatSensitivity(baselineSensitivity)} 감도가 최종 확인에서도 가장 안정적이어서 그대로 유지했습니다.`,
    );
  } else {
    passed = null;
    finalSensitivity = baselineSensitivity;
    decisionReason.push(
      `후보 간 점수 차이가 ${scoreGap.toFixed(1)}점으로 확정 기준에 못 미쳐 추천값을 유지하고 판단을 보류했습니다.`,
    );
  }

  if (!stableBaseline && winner.sensitivity !== baselineSensitivity) {
    passed = false;
    finalSensitivity = winner.sensitivity;
    decisionReason.push(
      `${formatSensitivity(baselineSensitivity)} 감도는 빠르거나 느린 경향이 남아 있어 검증 결과에 따라 조정했습니다.`,
    );
  }

  if (second) {
    decisionReason.push(
      `검증 상위 두 후보의 점수 차이는 ${Math.abs(
        getSummaryScore(winner) - getSummaryScore(second),
      ).toFixed(1)}점입니다.`,
    );
  }

  return {
    baselineSensitivity,
    comparedSensitivities: ranked.map((summary) => summary.sensitivity),
    candidateResults,
    passed,
    finalSensitivity,
    decisionReason,
    validatedAt: new Date().toISOString(),
  };
}
