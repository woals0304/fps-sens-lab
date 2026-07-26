import {
  DEFAULT_CALIBRATION_MULTIPLIER,
  DEFAULT_LAST_RESUME_TAB,
  STANDARD_TEST_PROTOCOL,
  STORAGE_VERSION,
} from '../constants/appConstants';
import { buildAutoSensitivitySettings } from './autoSensitivityRange';
import { normalizeFovSettings } from './fov';
import type {
  AnalysisSummary,
  AppSettings,
  ExperimentState,
  RecommendationResult,
  TestProtocol,
  StoredSession,
} from '../../types/models';

export function createEmptyRecommendation(): RecommendationResult {
  return {
    bestSensitivity: null,
    preValidationSensitivity: null,
    finalSensitivity: null,
    validationPassed: null,
    safeRange: null,
    slightlyLowerBackup: null,
    slightlyHigherBackup: null,
    topCandidates: [],
    reasonSummary: ['아직 테스트 데이터가 없습니다.'],
    nextTestCandidates: [],
  };
}

export function createEmptyAnalysisSummary(): AnalysisSummary {
  return {
    currentPaceText: '아직 자동 측정 결과가 부족합니다.',
    stableRangeText: '자동 측정을 진행하면 안정 구간을 계산합니다.',
    overshootText: '지나침 경향은 측정 데이터가 더 쌓이면 자동 해석됩니다.',
    turnSlowText: '회전 반응이 느려지는 구간은 측정 뒤 자동 해석됩니다.',
    balanceText: '순간 조준과 추적 조준의 균형 구간은 측정 뒤 자동 해석됩니다.',
    recommendationText: '시험을 시작하면 추천 근거 문장이 채워집니다.',
    explanationLines: ['시험을 시작하면 추천 근거 문장이 채워집니다.'],
  };
}

export function createEmptyExperimentState(): ExperimentState {
  return {
    stage: 'setup',
    tasks: [],
    activeTaskId: null,
    initialCenter: 0,
    searchCenter: 0,
    searchPhase: 'wide_probe',
    recenterCount: 0,
    lastDirectionTrend: 'unclear',
    lastResumeTab: DEFAULT_LAST_RESUME_TAB,
    lastLabSection: 'setup',
    calibrationMultiplier: DEFAULT_CALIBRATION_MULTIPLIER,
    manualSensitivityOverride: null,
    recommendedPairs: [],
    stopReason: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function createSession(
  settings: AppSettings,
  testProtocol: TestProtocol = STANDARD_TEST_PROTOCOL,
): StoredSession {
  const now = new Date().toISOString();
  const normalizedSettings = {
    ...buildAutoSensitivitySettings(settings),
    ...normalizeFovSettings(settings),
  };
  const experimentState = createEmptyExperimentState();
  experimentState.initialCenter = normalizedSettings.currentSensitivity;
  experimentState.searchCenter = normalizedSettings.currentSensitivity;

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    storageVersion: STORAGE_VERSION,
    settings: normalizedSettings,
    testProtocol,
    rangeEntries: [],
    duelMatches: [],
    labRuns: [],
    labSummaries: [],
    analysisSummary: createEmptyAnalysisSummary(),
    decisionLog: [],
    validationResult: null,
    experimentState,
    recommendation: createEmptyRecommendation(),
    aiPrediction: null,
  };
}

export function touchSession(session: StoredSession): StoredSession {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
  };
}
