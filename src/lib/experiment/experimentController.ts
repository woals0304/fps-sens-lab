import {
  DUEL_STAGE_ADVANCE_COUNT,
  FINE_TUNE_THRESHOLD,
  QUICK_MODE_CONFIDENT_SCORE_GAP,
  QUICK_MODE_MAX_DUEL_PAIRS,
  QUICK_MODE_MAX_FOCUSED_CANDIDATES,
  QUICK_MODE_MAX_TOTAL_BUNDLES,
  QUICK_MODE_MAX_VALIDATION_BUNDLES,
  QUICK_MODE_SAFE_RANGE_WIDTH,
  QUICK_START_TEST_PROTOCOL,
  RANGE_STAGE_ADVANCE_COUNT,
  STANDARD_TEST_PROTOCOL,
  TEST_SEED_OFFSETS,
} from '../constants/appConstants';
import { buildAnalysisSummary, buildLabSummariesFromRuns } from '../experiment/metricsAnalyzer';
import { buildRecommendation } from '../recommendation/recommendationEngine';
import {
  compareSensitivity,
  formatSensitivity,
  normalizeSensitivity,
  roundSensitivity,
} from '../utils/sensitivity';
import {
  buildFineTuneCandidates,
  buildFocusedSensitivityCandidates,
  buildInitialSensitivityCandidates,
} from '../utils/autoSensitivityRange';
import { touchSession } from '../utils/sessionUtils';
import { generateDuelPairs } from './duelPairGenerator';
import {
  detectDirectionTrend,
  recenterSearchWindow,
  shouldRecenterSearch,
} from './searchStrategy';
import {
  evaluateValidationResult,
  getValidationCandidateSensitivities,
} from './validationEngine';
import type {
  AppSettings,
  DuelChoice,
  DuelMatch,
  ExperimentDecisionRecord,
  ExperimentState,
  ExperimentTask,
  ExperimentTaskStatus,
  LabMetrics,
  LabMode,
  LabRun,
  LabRunQuality,
  ProtocolVariant,
  RecommendationResult,
  SensitivityLabSummary,
  StoredSession,
  TestProtocol,
  ValidationResult,
} from '../../types/models';

function createTaskStatus(status: ExperimentTaskStatus = 'pending'): ExperimentTaskStatus {
  return status;
}

function isQuickStartProtocol(testProtocol: TestProtocol): boolean {
  return testProtocol.version === QUICK_START_TEST_PROTOCOL.version;
}

function getModeTaskTitle(mode: LabMode): string {
  if (mode === 'flick') {
    return '순간 조준';
  }

  if (mode === 'tracking') {
    return '추적 조준';
  }

  return '회전 반응';
}

function getSummaryScore(summary: SensitivityLabSummary): number {
  return summary.combinedWeightedScore ?? summary.autoWeightedScore ?? 0;
}

function rankSummaries(summaries: SensitivityLabSummary[]): SensitivityLabSummary[] {
  return [...summaries].sort((left, right) => getSummaryScore(right) - getSummaryScore(left));
}

function getProtocolConfig(testProtocol: TestProtocol, variant: ProtocolVariant) {
  return variant === 'validation' ? testProtocol.validation : testProtocol.standard;
}

function getTaskSeed(
  stage: 'range_test' | 'duel_test' | 'fine_tune' | 'validation',
  mode: LabMode,
  offset = 0,
): number {
  return TEST_SEED_OFFSETS[stage][mode] + offset;
}

function createDecisionRecord(
  stage: ExperimentState['stage'],
  sensitivity: number,
  action: ExperimentDecisionRecord['action'],
  reason: string,
  score: number | null,
): ExperimentDecisionRecord {
  return {
    id: crypto.randomUUID(),
    stage,
    sensitivity: roundSensitivity(sensitivity),
    action,
    reason,
    score,
    createdAt: new Date().toISOString(),
  };
}

function createTask(input: {
  title: string;
  description: string;
  stage: ExperimentState['stage'];
  mode: LabMode;
  sensitivity: number;
  seed: number;
  protocolVariant: ProtocolVariant;
  pairId?: string | null;
  pairLabel?: 'A' | 'B' | null;
  compareAgainst?: number | null;
}): ExperimentTask {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    stage: input.stage,
    mode: input.mode,
    section: input.mode,
    protocolVariant: input.protocolVariant,
    sensitivity: roundSensitivity(input.sensitivity),
    seed: input.seed,
    pairId: input.pairId ?? null,
    pairLabel: input.pairLabel ?? null,
    compareAgainst:
      input.compareAgainst === null || typeof input.compareAgainst === 'undefined'
        ? null
        : roundSensitivity(input.compareAgainst),
    status: createTaskStatus(),
    createdAt: new Date().toISOString(),
  };
}

function createBundleTasks(
  sensitivities: number[],
  stage: 'range_test' | 'fine_tune' | 'validation',
  descriptionPrefix: string,
  testProtocol: TestProtocol,
  protocolVariant: ProtocolVariant,
): ExperimentTask[] {
  const protocolConfig = getProtocolConfig(testProtocol, protocolVariant);

  return sensitivities.flatMap((sensitivity) =>
    (['flick', 'tracking', 'turn'] as LabMode[]).map((mode) =>
      createTask({
        title: `${formatSensitivity(sensitivity)} ${getModeTaskTitle(mode)} 시험`,
        description: `${descriptionPrefix} ${protocolConfig.label} 규약으로 ${getModeTaskTitle(mode)} 반응을 자동 측정합니다.`,
        stage,
        mode,
        sensitivity,
        seed: getTaskSeed(stage, mode),
        protocolVariant,
      }),
    ),
  );
}

export function orderCandidatesAroundCenter(candidates: number[], center: number): number[] {
  const normalizedCenter = roundSensitivity(center);
  const uniqueCandidates = Array.from(
    new Set(candidates.map((candidate) => roundSensitivity(candidate))),
  );

  return uniqueCandidates.sort((left, right) => {
    const distanceDelta =
      Math.abs(left - normalizedCenter) - Math.abs(right - normalizedCenter);

    if (Math.abs(distanceDelta) > 1e-9) {
      return distanceDelta;
    }

    // 같은 거리라면 낮은 감도를 먼저 두어 순서를 항상 재현할 수 있게 합니다.
    return compareSensitivity(left, right);
  });
}

function createDuelTasks(pairs: Array<[number, number]>, testProtocol: TestProtocol): ExperimentTask[] {
  return pairs.flatMap(([left, right], index) => {
    const pairId = `duel-${index}-${left}-${right}`;

    return (['flick', 'tracking', 'turn'] as LabMode[]).flatMap((mode) => {
      const seed = getTaskSeed('duel_test', mode, index * 20);
      const title = getModeTaskTitle(mode);

      return [
        createTask({
          title: `후보 A ${formatSensitivity(left)} ${title} 시험`,
          description: `${testProtocol.standard.label} 규약으로 후보 A의 ${title} 결과를 자동 측정합니다.`,
          stage: 'duel_test',
          mode,
          sensitivity: left,
          seed,
          pairId,
          pairLabel: 'A',
          compareAgainst: right,
          protocolVariant: 'standard',
        }),
        createTask({
          title: `후보 B ${formatSensitivity(right)} ${title} 시험`,
          description: `${testProtocol.standard.label} 규약으로 후보 B의 ${title} 결과를 자동 측정합니다.`,
          stage: 'duel_test',
          mode,
          sensitivity: right,
          seed,
          pairId,
          pairLabel: 'B',
          compareAgainst: left,
          protocolVariant: 'standard',
        }),
      ];
    });
  });
}

function createFineTuneSensitivities(
  settings: AppSettings,
  recommendation: RecommendationResult,
  summaries: SensitivityLabSummary[],
): number[] {
  const base =
    recommendation.preValidationSensitivity ??
    recommendation.bestSensitivity ??
    summaries[0]?.sensitivity ??
    settings.currentSensitivity;
  const normalizedBase = roundSensitivity(base);
  const tested = new Set(summaries.map((summary) => roundSensitivity(summary.sensitivity)));

  return [normalizedBase, ...buildFineTuneCandidates(base, settings.step)]
    .filter((value) => value > 0)
    .filter((value, index, array) => array.indexOf(value) === index)
    .filter((value) => value === normalizedBase || !tested.has(value));
}

function getFirstPendingTask(tasks: ExperimentTask[]): ExperimentTask | null {
  return tasks.find((task) => task.status === 'pending') ?? null;
}

function isSensitivityBundleCompleted(
  tasks: ExperimentTask[],
  sensitivity: number,
): boolean {
  const normalizedSensitivity = roundSensitivity(sensitivity);
  const bundleTasks = tasks.filter(
    (task) => roundSensitivity(task.sensitivity) === normalizedSensitivity,
  );

  return (
    bundleTasks.length > 0 &&
    bundleTasks.every((task) => task.status === 'completed')
  );
}

function createStateFromTasks(
  stage: ExperimentState['stage'],
  tasks: ExperimentTask[],
  previous: ExperimentState,
  recommendedPairs: Array<[number, number]> = previous.recommendedPairs,
  stopReason: string | null = previous.stopReason,
): ExperimentState {
  const activeTask = getFirstPendingTask(tasks);

  return {
    ...previous,
    stage,
    tasks,
    activeTaskId: activeTask?.id ?? null,
    lastLabSection: activeTask?.section ?? 'results',
    recommendedPairs,
    stopReason,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function getRecommendedSensitivity(
  recommendation: RecommendationResult,
  fallback: number | null,
): number | null {
  const value =
    recommendation.finalSensitivity ??
    recommendation.bestSensitivity ??
    recommendation.preValidationSensitivity ??
    fallback;

  return typeof value === 'number' ? normalizeSensitivity(value) : null;
}

function withRecommendedSensitivity(
  state: ExperimentState,
  recommendation: RecommendationResult,
  fallback: number | null,
): ExperimentState {
  const recommendedSensitivity = getRecommendedSensitivity(recommendation, fallback);

  if (recommendedSensitivity === null) {
    return state;
  }

  return {
    ...state,
    manualSensitivityOverride: recommendedSensitivity,
  };
}

function trimCandidatesAroundCenter(candidates: number[], center: number, limit: number): number[] {
  return orderCandidatesAroundCenter(candidates, center).slice(0, limit);
}

function getRangeBundleLimit(testProtocol: TestProtocol): number {
  if (!isQuickStartProtocol(testProtocol)) {
    return Number.POSITIVE_INFINITY;
  }

  return QUICK_MODE_MAX_TOTAL_BUNDLES - QUICK_MODE_MAX_VALIDATION_BUNDLES;
}

function getCompletedBundleSummaries(
  currentState: ExperimentState,
  summaries: SensitivityLabSummary[],
): SensitivityLabSummary[] {
  const completedSensitivities = new Set(
    getTaskSensitivityValues(currentState.tasks).filter((sensitivity) => {
      const bundleTasks = currentState.tasks.filter(
        (task) => roundSensitivity(task.sensitivity) === sensitivity,
      );

      return (
        bundleTasks.length > 0 &&
        bundleTasks.every((task) => task.status === 'completed')
      );
    }),
  );

  return summaries.filter((summary) =>
    completedSensitivities.has(roundSensitivity(summary.sensitivity)),
  );
}

function getQuickConfidenceStopReason(
  currentState: ExperimentState,
  recommendation: RecommendationResult,
  summaries: SensitivityLabSummary[],
): string | null {
  const center = roundSensitivity(currentState.searchCenter);
  const completedSummaries = getCompletedBundleSummaries(currentState, summaries);
  const completedSensitivities = completedSummaries.map((summary) =>
    roundSensitivity(summary.sensitivity),
  );
  const hasCenter = completedSensitivities.includes(center);
  const hasLower = completedSensitivities.some((sensitivity) => sensitivity < center);
  const hasHigher = completedSensitivities.some((sensitivity) => sensitivity > center);

  // 현재값과 양쪽 후보를 모두 본 뒤에만 일부 후보를 생략할 수 있습니다.
  if (completedSummaries.length < 3 || !hasCenter || !hasLower || !hasHigher) {
    return null;
  }

  const ranked = rankSummaries(completedSummaries);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;

  if (!best || !second) {
    return null;
  }

  const orderedSensitivities = [...completedSensitivities].sort(compareSensitivity);
  const bestSensitivity = roundSensitivity(best.sensitivity);
  const bestIsInterior =
    bestSensitivity > orderedSensitivities[0] &&
    bestSensitivity < orderedSensitivities[orderedSensitivities.length - 1];
  const stableEnough =
    !best.interpretationTags.includes('too_fast') &&
    !best.interpretationTags.includes('too_slow');

  // 현재까지 본 범위의 끝점이 1위라면 아직 같은 방향의 미측정 후보가 남아 있을 수 있습니다.
  if (!bestIsInterior || !stableEnough) {
    return null;
  }

  const safeRangeWidth = recommendation.safeRange
    ? recommendation.safeRange.max - recommendation.safeRange.min
    : Number.POSITIVE_INFINITY;
  const hasMeasuredSafeSpan = safeRangeWidth > 1e-9;

  if (hasMeasuredSafeSpan && safeRangeWidth <= QUICK_MODE_SAFE_RANGE_WIDTH) {
    return '양쪽 후보를 확인했고 안정 후보가 충분히 좁혀져 최종 확인으로 넘어갑니다.';
  }

  const scoreGap = getSummaryScore(best) - getSummaryScore(second);

  return scoreGap >= QUICK_MODE_CONFIDENT_SCORE_GAP
    ? '양쪽 후보를 확인했고 점수 차이가 충분히 뚜렷해 최종 확인으로 넘어갑니다.'
    : null;
}

function getQuickRangeStopReason(input: {
  currentState: ExperimentState;
  recommendation: RecommendationResult;
  summaries: SensitivityLabSummary[];
  testProtocol: TestProtocol;
  rangeBundleCount: number;
}): string | null {
  const { currentState, recommendation, summaries, testProtocol, rangeBundleCount } = input;

  if (!isQuickStartProtocol(testProtocol)) {
    return null;
  }

  if (rangeBundleCount >= getRangeBundleLimit(testProtocol)) {
    return '빠른 진단의 측정 상한에 도달해 최종 확인으로 넘어갑니다.';
  }

  if (currentState.searchPhase === 'focused_probe') {
    return '추가 후보 확인을 마쳐 최종 확인으로 넘어갑니다.';
  }

  return getQuickConfidenceStopReason(currentState, recommendation, summaries);
}

function getInitialRangeSensitivities(settings: AppSettings): number[] {
  return orderCandidatesAroundCenter(
    buildInitialSensitivityCandidates(settings.currentSensitivity),
    settings.currentSensitivity,
  );
}

function buildRangeStageDecisions(summaries: SensitivityLabSummary[]): ExperimentDecisionRecord[] {
  const ranked = rankSummaries(summaries);
  const promoted = new Set(ranked.slice(0, RANGE_STAGE_ADVANCE_COUNT).map((summary) => summary.sensitivity));

  return ranked.map((summary, index) =>
    createDecisionRecord(
      'range_test',
      summary.sensitivity,
      promoted.has(summary.sensitivity) ? 'advanced' : 'eliminated',
      promoted.has(summary.sensitivity)
        ? `넓게 확인한 결과 ${getSummaryScore(summary).toFixed(1)}점으로 상위 후보가 되어 다음 단계로 올라갑니다.`
        : `${index + 1}순위로 밀려 이번 비교 후보에서는 제외됩니다.`,
      getSummaryScore(summary),
    ),
  );
}

function buildDuelStageDecisions(summaries: SensitivityLabSummary[]): ExperimentDecisionRecord[] {
  const ranked = rankSummaries(summaries);
  const promoted = new Set(ranked.slice(0, DUEL_STAGE_ADVANCE_COUNT).map((summary) => summary.sensitivity));

  return ranked.map((summary, index) =>
    createDecisionRecord(
      'duel_test',
      summary.sensitivity,
      promoted.has(summary.sensitivity) ? 'advanced' : 'eliminated',
      promoted.has(summary.sensitivity)
        ? `비교 진행 결과 ${index + 1}순위로 유지되어 미세 조정 단계로 올라갑니다.`
        : '비교 결과와 자동 측정 점수를 함께 보면 상위 후보보다 안정감이 낮아 이번 단계에서 제외됩니다.',
      getSummaryScore(summary),
    ),
  );
}

function buildFineTuneDecisions(
  validationCandidates: number[],
  summaries: SensitivityLabSummary[],
): ExperimentDecisionRecord[] {
  const validationSet = new Set(validationCandidates);
  const ranked = rankSummaries(summaries);

  return ranked.map((summary) =>
    createDecisionRecord(
      'fine_tune',
      summary.sensitivity,
      validationSet.has(summary.sensitivity) ? 'validation_target' : 'eliminated',
      validationSet.has(summary.sensitivity)
        ? '추천 감도 주변 값을 다시 확인하기 위해 최종 확인 대상으로 올립니다.'
        : '미세 조정 결과를 비교했을 때 최종 확인 후보 범위에서 벗어나 제외됐습니다.',
      getSummaryScore(summary),
    ),
  );
}

function buildValidationDecisions(validationResult: ValidationResult): ExperimentDecisionRecord[] {
  return validationResult.candidateResults.map((candidate) =>
    createDecisionRecord(
      'validation',
      candidate.sensitivity,
      candidate.sensitivity === validationResult.finalSensitivity
        ? validationResult.passed
          ? 'confirmed'
          : 'adjusted'
        : 'eliminated',
      candidate.sensitivity === validationResult.finalSensitivity
        ? validationResult.passed
          ? '최종 확인에서도 가장 안정적이라 최종 추천으로 확정했습니다.'
          : '최종 확인에서 더 안정적인 값이 보여 최종 추천을 조정했습니다.'
        : '최종 확인에서 추천 후보보다 점수가 낮아 제외됐습니다.',
      candidate.score,
    ),
  );
}

function getValidationRuns(sessionRuns: LabRun[]): LabRun[] {
  return sessionRuns.filter((run) => run.stage === 'validation');
}

function getRangeRuns(sessionRuns: LabRun[]): LabRun[] {
  return sessionRuns.filter((run) => run.stage === 'range_test');
}

function getTaskSensitivityValues(tasks: ExperimentTask[]): number[] {
  return Array.from(new Set(tasks.map((task) => roundSensitivity(task.sensitivity))));
}

function getSummariesForTaskSet(
  summaries: SensitivityLabSummary[],
  tasks: ExperimentTask[],
): SensitivityLabSummary[] {
  const sensitivitySet = new Set(getTaskSensitivityValues(tasks));
  return summaries.filter((summary) => sensitivitySet.has(roundSensitivity(summary.sensitivity)));
}

function filterFreshCandidates(candidates: number[], testedValues: number[], minimumCount = 5): number[] {
  const testedSet = new Set(testedValues.map((value) => roundSensitivity(value)));
  const fresh = candidates.filter((value) => !testedSet.has(roundSensitivity(value)));

  return fresh.length >= minimumCount ? fresh : candidates;
}

function buildRecenterDecisionRecord(
  currentCenter: number,
  nextCenter: number,
  reason: string,
): ExperimentDecisionRecord {
  return createDecisionRecord(
    'range_test',
    nextCenter,
    'recentered',
    `${formatSensitivity(currentCenter)} 부근보다 ${formatSensitivity(nextCenter)} 부근에서 더 좋은 반응이 보여 탐색 중심을 옮깁니다. ${reason}`,
    null,
  );
}

export function initializeExperimentState(
  settings: AppSettings,
  testProtocol: TestProtocol = STANDARD_TEST_PROTOCOL,
): ExperimentState {
  const initialCenter = normalizeSensitivity(settings.currentSensitivity);
  const tasks = createBundleTasks(
    getInitialRangeSensitivities(settings),
    'range_test',
    '기준 확인 단계에서',
    testProtocol,
    'standard',
  );

  return createStateFromTasks(
    'range_test',
    tasks,
    {
      stage: 'setup',
      tasks: [],
      activeTaskId: null,
      initialCenter,
      searchCenter: initialCenter,
      searchPhase: 'wide_probe',
      recenterCount: 0,
      lastDirectionTrend: 'unclear',
      lastResumeTab: 'finder',
      lastLabSection: 'setup',
      calibrationMultiplier: 1,
      manualSensitivityOverride: initialCenter,
      recommendedPairs: [],
      stopReason: null,
      lastUpdatedAt: new Date().toISOString(),
    },
    [],
    null,
  );
}

export function ensureExperimentState(session: StoredSession): StoredSession {
  if (session.experimentState.tasks.length > 0 || session.experimentState.stage !== 'setup') {
    return session;
  }

  return touchSession({
    ...session,
    experimentState: initializeExperimentState(session.settings, session.testProtocol),
  });
}

export function getActiveExperimentTask(state: ExperimentState): ExperimentTask | null {
  if (!state.activeTaskId) {
    return null;
  }

  return state.tasks.find((task) => task.id === state.activeTaskId) ?? null;
}

export function updateExperimentPreferences(
  session: StoredSession,
  patch: Partial<
    Pick<
      ExperimentState,
      'calibrationMultiplier' | 'manualSensitivityOverride' | 'lastLabSection' | 'lastResumeTab'
    >
  >,
): StoredSession {
  return touchSession({
    ...session,
    experimentState: {
      ...session.experimentState,
      ...patch,
      lastUpdatedAt: new Date().toISOString(),
    },
  });
}

function appendAutoDuelMatches(
  session: StoredSession,
  tasks: ExperimentTask[],
  labRuns: LabRun[],
): DuelMatch[] {
  const pairIds = Array.from(
    new Set(tasks.map((task) => task.pairId).filter((pairId): pairId is string => Boolean(pairId))),
  );
  const existing = new Set(
    session.duelMatches.map((match) => match.pairId).filter((pairId): pairId is string => Boolean(pairId)),
  );
  const nextMatches = [...session.duelMatches];

  for (const pairId of pairIds) {
    const pairTasks = tasks.filter((task) => task.pairId === pairId);

    if (existing.has(pairId) || pairTasks.some((task) => task.status !== 'completed')) {
      continue;
    }

    const pairRuns = labRuns.filter((run) => run.pairId === pairId);
    const pairSummaries = buildLabSummariesFromRuns(pairRuns, []);
    const sensitivityA = pairTasks.find((task) => task.pairLabel === 'A')?.sensitivity ?? null;
    const sensitivityB = pairTasks.find((task) => task.pairLabel === 'B')?.sensitivity ?? null;
    const summaryA = pairSummaries.find((summary) => summary.sensitivity === sensitivityA);
    const summaryB = pairSummaries.find((summary) => summary.sensitivity === sensitivityB);

    if (!summaryA || !summaryB) {
      continue;
    }

    const scoreA = summaryA.autoWeightedScore ?? summaryA.combinedWeightedScore ?? 0;
    const scoreB = summaryB.autoWeightedScore ?? summaryB.combinedWeightedScore ?? 0;
    const diff = scoreA - scoreB;
    const choice: DuelChoice = diff > 2 ? 'A' : diff < -2 ? 'B' : 'SIMILAR';

    nextMatches.push({
      candidateA: summaryA.sensitivity,
      candidateB: summaryB.sensitivity,
      choice,
      note: `자동 측정 비교 결과 (${scoreA.toFixed(1)} 대 ${scoreB.toFixed(1)})`,
      playedAt: new Date().toISOString(),
      source: 'auto_lab',
      pairId,
    });
  }

  return nextMatches;
}

function buildNextStageTransition(input: {
  session: StoredSession;
  summaries: SensitivityLabSummary[];
  recommendation: RecommendationResult;
  duelMatches: DuelMatch[];
  currentState: ExperimentState;
  nextRuns: LabRun[];
  validationResult: ValidationResult | null;
  quickEarlyStopReason?: string | null;
}): {
  nextState: ExperimentState;
  decisionRecords: ExperimentDecisionRecord[];
  validationResult: ValidationResult | null;
} {
  const {
    session,
    summaries,
    duelMatches,
    recommendation,
    currentState,
    nextRuns,
    validationResult,
    quickEarlyStopReason = null,
  } = input;
  const rangeSummaries = buildLabSummariesFromRuns(getRangeRuns(nextRuns), session.rangeEntries);
  const currentTaskSummaries = getSummariesForTaskSet(summaries, currentState.tasks);
  const quickMode = isQuickStartProtocol(session.testProtocol);

  if (currentState.stage === 'range_test') {
    const trendResult = detectDirectionTrend(currentState.searchCenter, currentTaskSummaries);
    const rankedCurrentPhase = rankSummaries(currentTaskSummaries);
    const bestCurrentPhase = rankedCurrentPhase[0] ?? null;
    const rangeBundleCount = rangeSummaries.length;
    const remainingRangeBudget = Math.max(
      0,
      getRangeBundleLimit(session.testProtocol) - rangeBundleCount,
    );
    const canUseFocusedProbe = remainingRangeBudget > 0;
    const shouldFollowTrend = shouldRecenterSearch(trendResult, currentState.recenterCount);
    const shouldRunFallbackProbe =
      !shouldFollowTrend &&
      currentState.searchPhase === 'wide_probe' &&
      currentState.recenterCount === 0 &&
      canUseFocusedProbe &&
      bestCurrentPhase !== null &&
      Math.abs(bestCurrentPhase.sensitivity - currentState.searchCenter) >= Math.max(session.settings.step * 1.5, 0.15);

    if (
      !quickEarlyStopReason &&
      (shouldFollowTrend || shouldRunFallbackProbe) &&
      canUseFocusedProbe
    ) {
      const nextCenter = normalizeSensitivity(
        shouldFollowTrend
          ? recenterSearchWindow(currentState.searchCenter, trendResult.trend, trendResult.winningSensitivity)
          : bestCurrentPhase.sensitivity,
      );
      const focusStep = Math.max(
        session.settings.step,
        normalizeSensitivity(Math.abs(nextCenter - currentState.searchCenter) / 2),
      );
      const focusedCandidatePool = buildFocusedSensitivityCandidates(nextCenter, focusStep);
      const testedSensitivitySet = new Set(
        rangeSummaries.map((summary) => roundSensitivity(summary.sensitivity)),
      );
      const rawFocusedCandidates = quickMode
        ? focusedCandidatePool.filter(
            (candidate) => !testedSensitivitySet.has(roundSensitivity(candidate)),
          )
        : filterFreshCandidates(
            focusedCandidatePool,
            rangeSummaries.map((summary) => summary.sensitivity),
          );
      const focusedCandidateLimit = quickMode
        ? Math.min(QUICK_MODE_MAX_FOCUSED_CANDIDATES, remainingRangeBudget)
        : Number.MAX_SAFE_INTEGER;
      const focusedCandidates = quickMode
        ? trimCandidatesAroundCenter(rawFocusedCandidates, nextCenter, focusedCandidateLimit)
        : orderCandidatesAroundCenter(rawFocusedCandidates, nextCenter);

      if (focusedCandidates.length > 0) {
        const reason = shouldFollowTrend
          ? trendResult.reason
          : '초기 확인에서 현재 감도와 조금 떨어진 구간이 더 좋아 보여 같은 방향을 한 번 더 확인합니다.';
        const nextState = createStateFromTasks(
          'range_test',
          createBundleTasks(
            focusedCandidates,
            'range_test',
            '더 좋은 구간을 다시 좁혀 보기 위해',
            session.testProtocol,
            'standard',
          ),
          {
            ...currentState,
            searchCenter: nextCenter,
            searchPhase: 'focused_probe',
            recenterCount: currentState.recenterCount + 1,
            lastDirectionTrend: shouldFollowTrend
              ? trendResult.trend
              : bestCurrentPhase.sensitivity < currentState.searchCenter
                ? 'lower'
                : 'higher',
          },
          [],
          null,
        );

        return {
          nextState: withRecommendedSensitivity(nextState, recommendation, nextCenter),
          decisionRecords: [buildRecenterDecisionRecord(currentState.searchCenter, nextCenter, reason)],
          validationResult,
        };
      }
    }

    const decisionRecords = buildRangeStageDecisions(rangeSummaries);
    const validationCandidates = getValidationCandidateSensitivities(
      session.settings,
      recommendation,
      rangeSummaries,
    );
    const quickRangeStopReason = quickMode
      ? (quickEarlyStopReason ??
        getQuickRangeStopReason({
          currentState,
          recommendation,
          summaries: rangeSummaries,
          testProtocol: session.testProtocol,
          rangeBundleCount,
        }))
      : null;

    if (quickRangeStopReason) {
      const nextState = createStateFromTasks(
        'validation',
        createBundleTasks(
          validationCandidates,
          'validation',
          '추천 감도를 짧게 다시 확인하기 위해',
          session.testProtocol,
          'validation',
        ),
        {
          ...currentState,
          searchPhase: 'ready_for_duel',
          lastDirectionTrend: trendResult.trend,
        },
        [],
        quickRangeStopReason,
      );

      return {
        nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
        decisionRecords: [...decisionRecords, ...buildFineTuneDecisions(validationCandidates, rangeSummaries)],
        validationResult,
      };
    }

    const promotedSummaries = rankSummaries(rangeSummaries).slice(0, RANGE_STAGE_ADVANCE_COUNT);
    const duelPairs = generateDuelPairs(promotedSummaries, duelMatches).slice(
      0,
      quickMode ? QUICK_MODE_MAX_DUEL_PAIRS : Number.MAX_SAFE_INTEGER,
    );

    if (!quickMode && duelPairs.length > 0) {
      const nextState = createStateFromTasks(
        'duel_test',
        createDuelTasks(duelPairs, session.testProtocol),
        {
          ...currentState,
          searchPhase: 'ready_for_duel',
          lastDirectionTrend: trendResult.trend,
        },
        duelPairs,
        null,
      );

      return {
        nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
        decisionRecords,
        validationResult,
      };
    }

    const fineTuneValues = createFineTuneSensitivities(session.settings, recommendation, rangeSummaries);

    if (!quickMode && fineTuneValues.length > 0) {
      const nextState = createStateFromTasks(
        'fine_tune',
        createBundleTasks(fineTuneValues, 'fine_tune', '상위 후보 주변에서', session.testProtocol, 'standard'),
        {
          ...currentState,
          searchPhase: 'ready_for_duel',
          lastDirectionTrend: trendResult.trend,
        },
        [],
        null,
      );

      return {
        nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
        decisionRecords,
        validationResult,
      };
    }

    const nextState = createStateFromTasks(
      'validation',
      createBundleTasks(
        validationCandidates,
        'validation',
        '최종 추천 후보를 다시 확인하기 위해',
        session.testProtocol,
        'validation',
      ),
      {
        ...currentState,
        searchPhase: 'ready_for_duel',
        lastDirectionTrend: trendResult.trend,
      },
      [],
      null,
    );

    return {
      nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
      decisionRecords: [...decisionRecords, ...buildFineTuneDecisions(validationCandidates, rangeSummaries)],
      validationResult,
    };
  }

  if (currentState.stage === 'duel_test') {
    const decisionRecords = buildDuelStageDecisions(summaries);
    const fineTuneValues = createFineTuneSensitivities(session.settings, recommendation, summaries);

    if (fineTuneValues.length > 0 && summaries.length > FINE_TUNE_THRESHOLD) {
      const nextState = createStateFromTasks(
        'fine_tune',
        createBundleTasks(fineTuneValues, 'fine_tune', '미세 조정 단계에서', session.testProtocol, 'standard'),
        currentState,
        [],
        null,
      );

      return {
        nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
        decisionRecords,
        validationResult,
      };
    }

    const validationCandidates = getValidationCandidateSensitivities(
      session.settings,
      recommendation,
      summaries,
    );
    const nextState = createStateFromTasks(
      'validation',
      createBundleTasks(
        validationCandidates,
        'validation',
        '최종 추천 후보를 다시 확인하기 위해',
        session.testProtocol,
        'validation',
      ),
      currentState,
      [],
      null,
    );

    return {
      nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
      decisionRecords: [...decisionRecords, ...buildFineTuneDecisions(validationCandidates, summaries)],
      validationResult,
    };
  }

  if (currentState.stage === 'fine_tune') {
    const validationCandidates = getValidationCandidateSensitivities(
      session.settings,
      recommendation,
      summaries,
    );
    const nextState = createStateFromTasks(
      'validation',
      createBundleTasks(
        validationCandidates,
        'validation',
        '최종 추천 후보를 다시 확인하기 위해',
        session.testProtocol,
        'validation',
      ),
      currentState,
      [],
      null,
    );

    return {
      nextState: withRecommendedSensitivity(nextState, recommendation, recommendation.preValidationSensitivity),
      decisionRecords: buildFineTuneDecisions(validationCandidates, summaries),
      validationResult,
    };
  }

  if (currentState.stage === 'validation') {
    const validationSummaries = buildLabSummariesFromRuns(getValidationRuns(nextRuns), session.rangeEntries);
    const nextValidationResult = evaluateValidationResult({
      validationRuns: validationSummaries,
      baselineSensitivity: recommendation.preValidationSensitivity,
    });

    return {
      nextState: withRecommendedSensitivity(
        createStateFromTasks(
          'result',
          [],
          currentState,
          [],
          nextValidationResult.passed === null
            ? nextValidationResult.decisionReason[0] ?? '최종 확인 근거가 부족해 판단을 보류했습니다.'
            : nextValidationResult.passed
              ? '최종 확인까지 통과해 추천 감도를 확정했습니다.'
              : '최종 확인 결과를 반영해 추천 감도를 조정했습니다.',
        ),
        recommendation,
        nextValidationResult.finalSensitivity,
      ),
      decisionRecords: buildValidationDecisions(nextValidationResult),
      validationResult: nextValidationResult,
    };
  }

  return {
    nextState: withRecommendedSensitivity(
      createStateFromTasks('result', [], currentState, [], '모든 자동 시험이 끝났습니다.'),
      recommendation,
      recommendation.finalSensitivity,
    ),
    decisionRecords: [],
    validationResult,
  };
}

export function recordLabRun(
  session: StoredSession,
  taskId: string,
  metrics: LabMetrics,
  quality?: LabRunQuality,
): StoredSession {
  const task = session.experimentState.tasks.find((item) => item.id === taskId);

  if (!task || task.status === 'completed' || session.labRuns.some((run) => run.taskId === taskId)) {
    return session;
  }

  const nextTasks = session.experimentState.tasks.map((item) =>
    item.id === taskId ? { ...item, status: 'completed' as const } : item,
  );

  const nextRuns = [
    ...session.labRuns,
    {
      id: crypto.randomUUID(),
      taskId,
      pairId: task.pairId,
      pairLabel: task.pairLabel,
      stage: task.stage,
      mode: task.mode,
      protocolVariant: task.protocolVariant,
      sensitivity: task.sensitivity,
      seed: task.seed,
      createdAt: new Date().toISOString(),
      metrics,
      ...(quality ? { quality } : {}),
    },
  ];

  const provisionalSession = {
    ...session,
    labRuns: nextRuns,
    experimentState: {
      ...session.experimentState,
      tasks: nextTasks,
      lastResumeTab: session.experimentState.lastResumeTab,
      lastLabSection: task.section,
      lastUpdatedAt: new Date().toISOString(),
    },
  };

  const duelMatches = appendAutoDuelMatches(provisionalSession, nextTasks, nextRuns);
  const labSummaries = buildLabSummariesFromRuns(nextRuns, session.rangeEntries);
  const frozenValidationBaseline =
    session.experimentState.stage === 'validation'
      ? session.recommendation.preValidationSensitivity ??
        session.recommendation.bestSensitivity ??
        session.settings.currentSensitivity
      : null;
  let nextValidationResult = session.validationResult;

  let recommendation = buildRecommendation(
    session.settings,
    session.rangeEntries,
    duelMatches,
    labSummaries,
    session.aiPrediction,
    nextValidationResult,
    frozenValidationBaseline,
  );

  let analysisSummary = buildAnalysisSummary({
    currentSensitivity: session.settings.currentSensitivity,
    summaries: labSummaries,
    bestSensitivity: recommendation.bestSensitivity,
    safeRange: recommendation.safeRange,
    validationResult: nextValidationResult,
  });

  let nextState: ExperimentState = withRecommendedSensitivity(
    {
      ...provisionalSession.experimentState,
      activeTaskId: getFirstPendingTask(nextTasks)?.id ?? null,
    },
    recommendation,
    session.settings.currentSensitivity,
  );
  let nextDecisionLog = session.decisionLog;
  const firstPendingTask = getFirstPendingTask(nextTasks);
  const quickEarlyStopReason =
    firstPendingTask &&
    task.stage === 'range_test' &&
    isQuickStartProtocol(session.testProtocol) &&
    isSensitivityBundleCompleted(nextTasks, task.sensitivity)
      ? getQuickConfidenceStopReason(nextState, recommendation, labSummaries)
      : null;

  if (!firstPendingTask || quickEarlyStopReason) {
    const transition = buildNextStageTransition({
      session,
      summaries: labSummaries,
      recommendation,
      duelMatches,
      currentState: nextState,
      nextRuns,
      validationResult: nextValidationResult,
      quickEarlyStopReason,
    });

    nextState = transition.nextState;
    nextValidationResult = transition.validationResult;
    nextDecisionLog = [...session.decisionLog, ...transition.decisionRecords];
    recommendation = buildRecommendation(
      session.settings,
      session.rangeEntries,
      duelMatches,
      labSummaries,
      session.aiPrediction,
      nextValidationResult,
      frozenValidationBaseline,
    );
    nextState = withRecommendedSensitivity(
      nextState,
      recommendation,
      nextValidationResult?.finalSensitivity ?? session.settings.currentSensitivity,
    );
    analysisSummary = buildAnalysisSummary({
      currentSensitivity: session.settings.currentSensitivity,
      summaries: labSummaries,
      bestSensitivity: recommendation.bestSensitivity,
      safeRange: recommendation.safeRange,
      validationResult: nextValidationResult,
    });
  } else {
    nextState = withRecommendedSensitivity(
      {
        ...nextState,
        lastLabSection: firstPendingTask.section,
      },
      recommendation,
      session.settings.currentSensitivity,
    );
  }

  return touchSession({
    ...session,
    duelMatches,
    labRuns: nextRuns,
    labSummaries,
    analysisSummary,
    decisionLog: nextDecisionLog,
    validationResult: nextValidationResult,
    recommendation,
    experimentState: nextState,
  });
}
