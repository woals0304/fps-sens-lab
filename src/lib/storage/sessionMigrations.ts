import { DEFAULT_SETTINGS, STANDARD_TEST_PROTOCOL, STORAGE_VERSION } from '../constants/appConstants';
import { deriveSession } from '../session/deriveSession';
import { normalizeVisibleTab } from '../utils/appTabs';
import { normalizeFovSettings } from '../utils/fov';
import { normalizeSensitivity } from '../utils/sensitivity';
import {
  createEmptyAnalysisSummary,
  createEmptyExperimentState,
  createEmptyRecommendation,
} from '../utils/sessionUtils';
import type {
  LabRunQuality,
  ProtocolVariantConfig,
  StoredSession,
  TestProtocol,
  TurnInstruction,
} from '../../types/models';

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function normalizeProtocolString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function normalizeProtocolNumber(value: unknown, fallback: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return integer && !Number.isInteger(value) ? fallback : value;
}

function normalizeTurnInstructions(value: unknown, fallback: TurnInstruction[]): TurnInstruction[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback.map((instruction) => ({ ...instruction }));
  }

  const normalized = value.flatMap((item): TurnInstruction[] => {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      item.id.trim().length === 0 ||
      typeof item.label !== 'string' ||
      item.label.trim().length === 0 ||
      typeof item.angleDeg !== 'number' ||
      !Number.isFinite(item.angleDeg) ||
      item.angleDeg === 0
    ) {
      return [];
    }

    return [{ id: item.id, label: item.label, angleDeg: item.angleDeg }];
  });

  return normalized.length === value.length
    ? normalized
    : fallback.map((instruction) => ({ ...instruction }));
}

function normalizeProtocolVariant(
  value: unknown,
  fallback: ProtocolVariantConfig,
): ProtocolVariantConfig {
  const raw = isObject(value) ? value : {};

  return {
    label: normalizeProtocolString(raw.label, fallback.label),
    flickTargetCount: normalizeProtocolNumber(raw.flickTargetCount, fallback.flickTargetCount, true),
    flickTargetTimeoutMs: normalizeProtocolNumber(
      raw.flickTargetTimeoutMs,
      fallback.flickTargetTimeoutMs,
    ),
    trackingDurationMs: normalizeProtocolNumber(raw.trackingDurationMs, fallback.trackingDurationMs),
    trackingTargetSpeedScale: normalizeProtocolNumber(
      raw.trackingTargetSpeedScale,
      fallback.trackingTargetSpeedScale,
    ),
    turnTrialTimeoutMs: normalizeProtocolNumber(raw.turnTrialTimeoutMs, fallback.turnTrialTimeoutMs),
    turnInstructions: normalizeTurnInstructions(raw.turnInstructions, fallback.turnInstructions),
  };
}

function normalizeTestProtocol(value: unknown): TestProtocol {
  const raw = isObject(value) ? value : {};

  return {
    version: normalizeProtocolString(raw.version, STANDARD_TEST_PROTOCOL.version),
    label: normalizeProtocolString(raw.label, STANDARD_TEST_PROTOCOL.label),
    description: normalizeProtocolString(raw.description, STANDARD_TEST_PROTOCOL.description),
    standard: normalizeProtocolVariant(raw.standard, STANDARD_TEST_PROTOCOL.standard),
    validation: normalizeProtocolVariant(raw.validation, STANDARD_TEST_PROTOCOL.validation),
  };
}

function normalizeSettings(raw: StoredSession['settings']): StoredSession['settings'] {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...raw,
  };
  const normalizedFov = normalizeFovSettings({
    useCustomFov: settings.useCustomFov,
    customFov: settings.customFov,
    effectiveFov: settings.effectiveFov,
  });

  return {
    ...settings,
    dpi: Number.isFinite(settings.dpi) && settings.dpi > 0 ? settings.dpi : DEFAULT_SETTINGS.dpi,
    currentSensitivity: normalizeSensitivity(
      Number.isFinite(settings.currentSensitivity)
        ? settings.currentSensitivity
        : DEFAULT_SETTINGS.currentSensitivity,
    ),
    minSensitivity: normalizeSensitivity(
      Number.isFinite(settings.minSensitivity) ? settings.minSensitivity : DEFAULT_SETTINGS.minSensitivity,
    ),
    maxSensitivity: normalizeSensitivity(
      Number.isFinite(settings.maxSensitivity) ? settings.maxSensitivity : DEFAULT_SETTINGS.maxSensitivity,
    ),
    step: normalizeSensitivity(Number.isFinite(settings.step) ? settings.step : DEFAULT_SETTINGS.step),
    ...normalizedFov,
  };
}

function normalizeRangeEntries(entries: StoredSession['rangeEntries']): StoredSession['rangeEntries'] {
  return entries.map((entry) => ({
    ...entry,
    sensitivity: normalizeSensitivity(entry.sensitivity),
  }));
}

function normalizeDuelMatches(matches: StoredSession['duelMatches']): StoredSession['duelMatches'] {
  return matches.map((match) => ({
    ...match,
    candidateA: normalizeSensitivity(match.candidateA),
    candidateB: normalizeSensitivity(match.candidateB),
  }));
}

function normalizeLabRunQuality(value: unknown): LabRunQuality | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const finiteNumbers = [
    value.maxFrameGapMs,
    value.longFrameRatio,
    value.frameSampleCount,
    value.viewportWidth,
    value.viewportHeight,
    value.aspectRatio,
    value.horizontalFieldOfView,
    value.verticalFieldOfView,
    value.calibrationMultiplier,
  ];

  if (
    value.schemaVersion !== 1 ||
    typeof value.rawInput !== 'boolean' ||
    typeof value.referenceAspect !== 'boolean' ||
    finiteNumbers.some((item) => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    rawInput: value.rawInput,
    maxFrameGapMs: Math.max(0, value.maxFrameGapMs as number),
    longFrameRatio: Math.min(1, Math.max(0, value.longFrameRatio as number)),
    frameSampleCount: Math.max(0, Math.round(value.frameSampleCount as number)),
    viewportWidth: Math.max(0, Math.round(value.viewportWidth as number)),
    viewportHeight: Math.max(0, Math.round(value.viewportHeight as number)),
    aspectRatio: Math.max(0, value.aspectRatio as number),
    referenceAspect: value.referenceAspect,
    horizontalFieldOfView: value.horizontalFieldOfView as number,
    verticalFieldOfView: value.verticalFieldOfView as number,
    calibrationMultiplier: value.calibrationMultiplier as number,
  };
}

function normalizeLabRuns(runs: StoredSession['labRuns']): StoredSession['labRuns'] {
  return runs.map((run) => {
    const normalizedRun = {
      ...run,
      sensitivity: normalizeSensitivity(run.sensitivity),
    };
    const quality = normalizeLabRunQuality((run as { quality?: unknown }).quality);

    if (quality) {
      normalizedRun.quality = quality;
    } else {
      delete normalizedRun.quality;
    }

    return normalizedRun;
  });
}

function normalizeDecisionLog(records: StoredSession['decisionLog']): StoredSession['decisionLog'] {
  return records.map((record) => ({
    ...record,
    sensitivity: normalizeSensitivity(record.sensitivity),
  }));
}

function normalizeValidationResult(
  result: StoredSession['validationResult'],
): StoredSession['validationResult'] {
  if (!result) {
    return null;
  }

  return {
    ...result,
    baselineSensitivity:
      result.baselineSensitivity === null ? null : normalizeSensitivity(result.baselineSensitivity),
    comparedSensitivities: result.comparedSensitivities.map((value) => normalizeSensitivity(value)),
    candidateResults: result.candidateResults.map((candidate) => ({
      ...candidate,
      sensitivity: normalizeSensitivity(candidate.sensitivity),
    })),
    finalSensitivity: result.finalSensitivity === null ? null : normalizeSensitivity(result.finalSensitivity),
  };
}

function normalizeExperimentState(
  state: StoredSession['experimentState'],
  settings: StoredSession['settings'],
): StoredSession['experimentState'] {
  const initialCenter = normalizeSensitivity(
    Number.isFinite(state.initialCenter) && state.initialCenter > 0
      ? state.initialCenter
      : settings.currentSensitivity,
  );
  const searchCenter = normalizeSensitivity(
    Number.isFinite(state.searchCenter) && state.searchCenter > 0 ? state.searchCenter : initialCenter,
  );

  return {
    ...state,
    initialCenter,
    searchCenter,
    recenterCount: Number.isFinite(state.recenterCount) ? state.recenterCount : 0,
    searchPhase: state.searchPhase ?? 'wide_probe',
    lastDirectionTrend: state.lastDirectionTrend ?? 'unclear',
    lastResumeTab: normalizeVisibleTab(state.lastResumeTab),
    manualSensitivityOverride:
      state.manualSensitivityOverride === null ? null : normalizeSensitivity(state.manualSensitivityOverride),
    recommendedPairs: state.recommendedPairs.map(([left, right]) => [
      normalizeSensitivity(left),
      normalizeSensitivity(right),
    ]),
    tasks: state.tasks.map((task) => ({
      ...task,
      sensitivity: normalizeSensitivity(task.sensitivity),
      compareAgainst: task.compareAgainst === null ? null : normalizeSensitivity(task.compareAgainst),
    })),
  };
}

function normalizeAiPrediction(
  prediction: StoredSession['aiPrediction'],
): StoredSession['aiPrediction'] {
  if (!prediction) {
    return null;
  }

  return {
    ...prediction,
    predictedBestSensitivity: normalizeSensitivity(prediction.predictedBestSensitivity),
    recommendedNextPair: prediction.recommendedNextPair
      ? [
          normalizeSensitivity(prediction.recommendedNextPair[0]),
          normalizeSensitivity(prediction.recommendedNextPair[1]),
        ]
      : null,
  };
}

export function migrateStoredSession(raw: unknown): StoredSession | null {
  if (!isObject(raw) || !isObject(raw.settings)) {
    return null;
  }

  if (typeof raw.storageVersion === 'number' && raw.storageVersion > STORAGE_VERSION) {
    return null;
  }

  const rangeEntries = Array.isArray(raw.rangeEntries) ? raw.rangeEntries : [];
  const duelMatches = Array.isArray(raw.duelMatches) ? raw.duelMatches : [];
  const labRuns = Array.isArray(raw.labRuns) ? raw.labRuns : [];
  const experimentState = isObject(raw.experimentState)
    ? {
        ...createEmptyExperimentState(),
        ...raw.experimentState,
      }
    : createEmptyExperimentState();
  const normalizedSettings = normalizeSettings(raw.settings as unknown as StoredSession['settings']);

  const aiPrediction = isObject(raw.aiPrediction)
    ? normalizeAiPrediction(raw.aiPrediction as unknown as StoredSession['aiPrediction'])
    : null;
  const validationResult = isObject(raw.validationResult)
    ? (raw.validationResult as unknown as StoredSession['validationResult'])
    : null;
  const decisionLog = Array.isArray(raw.decisionLog)
    ? (raw.decisionLog as StoredSession['decisionLog'])
    : [];
  const normalizedExperimentState = normalizeExperimentState(experimentState, normalizedSettings);
  const preservedValidationBaseline =
    normalizedExperimentState.stage === 'validation' &&
    isObject(raw.recommendation) &&
    typeof raw.recommendation.preValidationSensitivity === 'number' &&
    Number.isFinite(raw.recommendation.preValidationSensitivity)
      ? normalizeSensitivity(raw.recommendation.preValidationSensitivity)
      : null;

  const migrated: StoredSession = {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    storageVersion: STORAGE_VERSION,
    settings: normalizedSettings,
    testProtocol: normalizeTestProtocol(raw.testProtocol),
    rangeEntries: normalizeRangeEntries(rangeEntries as StoredSession['rangeEntries']),
    duelMatches: normalizeDuelMatches(duelMatches as StoredSession['duelMatches']),
    labRuns: normalizeLabRuns(labRuns as StoredSession['labRuns']),
    labSummaries: [],
    analysisSummary: createEmptyAnalysisSummary(),
    decisionLog: normalizeDecisionLog(decisionLog),
    validationResult: normalizeValidationResult(validationResult),
    experimentState: normalizedExperimentState,
    recommendation: {
      ...createEmptyRecommendation(),
      preValidationSensitivity: preservedValidationBaseline,
    },
    aiPrediction,
  };

  return deriveSession(migrated);
}
