import type {
  AiPrediction,
  AnalysisSummary,
  AppSettings,
  DuelMatch,
  RangeTestEntry,
  RecommendationResult,
  SensitivityLabSummary,
  TopCandidate,
  ValidationResult,
} from '../../types/models';
import {
  TOO_FAST_KEYWORDS,
  TOO_FAST_OVERSHOOT,
  TOO_SLOW_KEYWORDS,
  TOO_SLOW_TRACKING,
} from '../constants/appConstants';
import { buildDuelScoreMap, getDuelProgress } from '../duel-engine/duelEngine';
import { buildAnalysisSummary, buildTrendTexts } from '../experiment/metricsAnalyzer';
import { getCandidateValues } from '../utils/candidateUtils';
import { roundTo } from '../utils/numberUtils';
import {
  addSensitivityStep,
  clampSensitivity,
  compareSensitivity,
  formatSensitivity,
  getValidationOffset,
  isSameSensitivity,
  normalizeSensitivity,
} from '../utils/sensitivity';
import { includesAnyKeyword } from '../utils/textUtils';

interface TrendSummary {
  tooFast: string;
  tooSlow: string;
}

function getSummaryScore(summary: SensitivityLabSummary): number {
  return summary.combinedWeightedScore ?? summary.autoWeightedScore ?? 0;
}

function buildRangeMap(rangeEntries: RangeTestEntry[]): Map<number, RangeTestEntry> {
  return new Map(rangeEntries.map((entry) => [normalizeSensitivity(entry.sensitivity), entry]));
}

function buildSummaryMap(labSummaries: SensitivityLabSummary[]): Map<number, SensitivityLabSummary> {
  return new Map(labSummaries.map((summary) => [normalizeSensitivity(summary.sensitivity), summary]));
}

function buildCandidateUniverse(
  settings: AppSettings,
  rangeEntries: RangeTestEntry[],
  duelMatches: DuelMatch[],
  labSummaries: SensitivityLabSummary[],
): number[] {
  return Array.from(
    new Set([
      ...getCandidateValues(settings),
      ...rangeEntries.map((entry) => entry.sensitivity),
      ...labSummaries.map((summary) => summary.sensitivity),
      ...duelMatches.flatMap((match) => [match.candidateA, match.candidateB]),
    ].map((value) => normalizeSensitivity(value))),
  ).sort((left, right) => compareSensitivity(left, right));
}

function getTestedTopCandidates(
  candidates: number[],
  rangeMap: Map<number, RangeTestEntry>,
  summaryMap: Map<number, SensitivityLabSummary>,
  duelScores: Map<number, number>,
): TopCandidate[] {
  const ranked = candidates
    .filter(
      (candidate) =>
        rangeMap.has(candidate) || summaryMap.has(candidate) || duelScores.has(candidate),
    )
    .map((candidate) => {
      const rangeEntry = rangeMap.get(candidate);
      const summary = summaryMap.get(candidate);
      const duelScore = duelScores.get(candidate) ?? 0;
      const baseScore = summary ? getSummaryScore(summary) : rangeEntry?.weightedScore ?? 0;
      const overshootPenalty =
        summary?.overshootPenalty ??
        (rangeEntry && rangeEntry.overshoot >= TOO_FAST_OVERSHOOT ? 6 : 0);
      const tooSlowPenalty =
        summary?.interpretationTags.includes('too_slow') ||
        (rangeEntry &&
          rangeEntry.trackingComfort <= TOO_SLOW_TRACKING &&
          includesAnyKeyword(rangeEntry.memo, TOO_SLOW_KEYWORDS))
          ? 4
          : 0;

      const score = roundTo(baseScore + duelScore * 5 - overshootPenalty - tooSlowPenalty, 2);

      return {
        sensitivity: candidate,
        score,
        label: summary
          ? `자동 ${summary.autoWeightedScore?.toFixed(1) ?? '-'} / 수동 ${summary.manualWeightedScore?.toFixed(1) ?? '-'} / 비교 우세 ${duelScore.toFixed(2)}`
          : rangeEntry
            ? `수동 ${rangeEntry.weightedScore.toFixed(1)} / 비교 우세 ${duelScore.toFixed(2)}`
            : `비교 우세 ${duelScore.toFixed(2)} / 자동 측정 대기`,
      };
    });

  return ranked.sort((left, right) => right.score - left.score).slice(0, 3);
}

function buildReasonSummary(input: {
  bestSensitivity: number | null;
  rangeEntries: RangeTestEntry[];
  duelMatches: DuelMatch[];
  labSummaries: SensitivityLabSummary[];
  aiPrediction: AiPrediction | null;
  validationResult: ValidationResult | null;
  analysisSummary: AnalysisSummary;
}): string[] {
  const { bestSensitivity, rangeEntries, duelMatches, labSummaries, aiPrediction, validationResult, analysisSummary } =
    input;
  const reasons: string[] = [...analysisSummary.explanationLines];
  const summary =
    bestSensitivity === null
      ? null
      : labSummaries.find((item) => isSameSensitivity(item.sensitivity, bestSensitivity)) ?? null;

  if (summary && summary.flickScore >= 70 && summary.trackingScore >= 70) {
    reasons.push(
      `${formatSensitivity(bestSensitivity)} 감도는 순간 조준 점수와 추적 조준 점수가 모두 안정 구간에 들어 있습니다.`,
    );
  }

  if (summary && summary.turnScore >= 70) {
    reasons.push(`${formatSensitivity(bestSensitivity)} 감도는 회전 반응 시험에서도 크게 느리지 않았습니다.`);
  }

  if (rangeEntries.some((entry) => entry.overshoot >= TOO_FAST_OVERSHOOT)) {
    reasons.push('수동 기록에서도 높은 감도 구간에서 지나침이 반복되었습니다.');
  }

  if (duelMatches.length > 0) {
    reasons.push('비교 시험 결과가 상위 후보를 좁히는 데 함께 반영되었습니다.');
  }

  if (validationResult) {
    reasons.push(...validationResult.decisionReason);
  }

  if (
    aiPrediction &&
    bestSensitivity !== null &&
    Math.abs(aiPrediction.predictedBestSensitivity - bestSensitivity) <= 0.15
  ) {
    reasons.push('불러온 AI 보조 예측도 비슷한 감도 구간을 가리키고 있습니다.');
  }

  return Array.from(new Set(reasons));
}

export function analyzeTrendSummary(
  rangeEntries: RangeTestEntry[],
  labSummaries: SensitivityLabSummary[] = [],
): TrendSummary {
  if (labSummaries.length > 0) {
    const trendTexts = buildTrendTexts(labSummaries);
    return {
      tooFast: trendTexts.tooFastText,
      tooSlow: trendTexts.tooSlowText,
    };
  }

  const tooFastEntries = rangeEntries.filter(
    (entry) =>
      entry.overshoot >= TOO_FAST_OVERSHOOT || includesAnyKeyword(entry.memo, TOO_FAST_KEYWORDS),
  );

  const tooSlowEntries = rangeEntries.filter(
    (entry) =>
      entry.trackingComfort <= TOO_SLOW_TRACKING && includesAnyKeyword(entry.memo, TOO_SLOW_KEYWORDS),
  );

  return {
    tooFast:
      tooFastEntries.length > 0
        ? `${tooFastEntries.map((entry) => formatSensitivity(entry.sensitivity)).join(', ')}에서 지나침이나 과속 느낌이 반복됐습니다.`
        : '아직 뚜렷한 과속 구간은 보이지 않습니다.',
    tooSlow:
      tooSlowEntries.length > 0
        ? `${tooSlowEntries.map((entry) => formatSensitivity(entry.sensitivity)).join(', ')}에서 답답하거나 느린 기록이 있었습니다.`
        : '아직 뚜렷한 저속 구간은 보이지 않습니다.',
  };
}

export function buildRecommendation(
  settings: AppSettings,
  rangeEntries: RangeTestEntry[],
  duelMatches: DuelMatch[],
  labSummaries: SensitivityLabSummary[] = [],
  aiPrediction: AiPrediction | null = null,
  validationResult: ValidationResult | null = null,
  preValidationSensitivityOverride: number | null = null,
): RecommendationResult {
  const candidates = buildCandidateUniverse(settings, rangeEntries, duelMatches, labSummaries);

  if (candidates.length === 0) {
    return {
      bestSensitivity: null,
      preValidationSensitivity: null,
      finalSensitivity: null,
      validationPassed: null,
      safeRange: null,
      slightlyLowerBackup: null,
      slightlyHigherBackup: null,
      topCandidates: [],
      reasonSummary: ['먼저 시험 범위를 확인해 주세요.'],
      nextTestCandidates: [],
    };
  }

  const rangeMap = buildRangeMap(rangeEntries);
  const summaryMap = buildSummaryMap(labSummaries);
  const duelScores = buildDuelScoreMap(duelMatches);
  const topCandidates = getTestedTopCandidates(
    candidates,
    rangeMap,
    summaryMap,
    duelScores,
  );

  const preValidationSensitivity =
    validationResult?.baselineSensitivity ??
    preValidationSensitivityOverride ??
    topCandidates[0]?.sensitivity ??
    aiPrediction?.predictedBestSensitivity ??
    settings.currentSensitivity;
  const bestSensitivity = validationResult?.finalSensitivity ?? preValidationSensitivity;
  const bestIndex = candidates.findIndex((candidate) => isSameSensitivity(candidate, bestSensitivity));
  const duelProgress = getDuelProgress(candidates, duelMatches);

  const closeCandidates = topCandidates
    .filter((candidate) => topCandidates[0] && topCandidates[0].score - candidate.score <= 6)
    .map((candidate) => candidate.sensitivity);

  const similarNeighbors = duelProgress.similarPairs
    .filter(
      ([left, right]) =>
        isSameSensitivity(left, preValidationSensitivity) ||
        isSameSensitivity(right, preValidationSensitivity),
    )
    .flat();

  const finalValidationCandidate = validationResult?.candidateResults.find(
    (candidate) =>
      validationResult.finalSensitivity !== null &&
      isSameSensitivity(candidate.sensitivity, validationResult.finalSensitivity),
  );
  const finalValidationCandidateIsSafe =
    finalValidationCandidate !== undefined &&
    finalValidationCandidate.score !== null &&
    !finalValidationCandidate.interpretationTags.includes('too_fast') &&
    !finalValidationCandidate.interpretationTags.includes('too_slow') &&
    !(
      validationResult?.passed === false &&
      validationResult.baselineSensitivity !== null &&
      isSameSensitivity(finalValidationCandidate.sensitivity, validationResult.baselineSensitivity)
    );
  const finalValidationScore = finalValidationCandidateIsSafe
    ? (finalValidationCandidate?.score ?? null)
    : null;
  const validationNeighbors =
    validationResult && finalValidationScore !== null
      ? validationResult.candidateResults
          .filter(
            (candidate) =>
              candidate.score !== null &&
              !candidate.interpretationTags.includes('too_fast') &&
              !candidate.interpretationTags.includes('too_slow') &&
              !(
                validationResult.passed === false &&
                validationResult.baselineSensitivity !== null &&
                isSameSensitivity(candidate.sensitivity, validationResult.baselineSensitivity)
              ) &&
              finalValidationScore - candidate.score <= 6,
          )
          .map((candidate) => candidate.sensitivity)
      : [];

  const safeCandidates = validationResult
    ? validationNeighbors
    : [preValidationSensitivity, bestSensitivity, ...closeCandidates, ...similarNeighbors];

  const safeNumbers = Array.from(
    new Set(
      safeCandidates
        .filter((value): value is number => value !== undefined && value !== null)
        .map((value) => normalizeSensitivity(value)),
    ),
  ).sort((left, right) => compareSensitivity(left, right));

  const safeRange =
    safeNumbers.length > 0
      ? {
          min: safeNumbers[0],
          max: safeNumbers[safeNumbers.length - 1],
        }
      : validationResult
        ? null
        : {
          min: bestSensitivity,
          max: bestSensitivity,
        };

  const precisionOffset = getValidationOffset(settings.step);
  const slightlyLowerBackup =
    bestIndex > 0
      ? candidates[bestIndex - 1]
      : clampSensitivity(addSensitivityStep(bestSensitivity, -precisionOffset));
  const slightlyHigherBackup =
    bestIndex >= 0 && bestIndex < candidates.length - 1
      ? candidates[bestIndex + 1]
      : clampSensitivity(addSensitivityStep(bestSensitivity, precisionOffset));

  const testedValues = new Set([
    ...rangeEntries.map((entry) => normalizeSensitivity(entry.sensitivity)),
    ...labSummaries.map((summary) => normalizeSensitivity(summary.sensitivity)),
  ]);
  const nextTestCandidates = candidates
    .filter((candidate) => Math.abs(candidate - bestSensitivity) <= Math.max(settings.step * 2.5, 0.2))
    .filter((candidate) => !testedValues.has(candidate) || isSameSensitivity(candidate, bestSensitivity))
    .filter((candidate) => !isSameSensitivity(candidate, bestSensitivity))
    .sort(
      (left, right) =>
        Math.abs(left - bestSensitivity) - Math.abs(right - bestSensitivity) ||
        compareSensitivity(left, right),
    )
    .slice(0, 2);

  const analysisSummary = buildAnalysisSummary({
    currentSensitivity: settings.currentSensitivity,
    summaries: labSummaries,
    bestSensitivity,
    safeRange,
    validationResult,
  });

  const reasonSummary = buildReasonSummary({
    bestSensitivity,
    rangeEntries,
    duelMatches,
    labSummaries,
    aiPrediction,
    validationResult,
    analysisSummary,
  });

  return {
    bestSensitivity,
    preValidationSensitivity,
    finalSensitivity: bestSensitivity,
    validationPassed: validationResult?.passed ?? null,
    safeRange,
    slightlyLowerBackup,
    slightlyHigherBackup,
    topCandidates,
    reasonSummary,
    nextTestCandidates,
  };
}
