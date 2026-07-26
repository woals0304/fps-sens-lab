import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureExperimentState,
  initializeExperimentState,
  recordLabRun,
  updateExperimentPreferences,
} from '../lib/experiment/experimentController';
import { calculateWeightedScore } from '../lib/scoring/calculateWeightedScore';
import { deriveSession } from '../lib/session/deriveSession';
import { createLocalStorageAdapter } from '../lib/storage/localStorageAdapter';
import { createSession, touchSession } from '../lib/utils/sessionUtils';
import { DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL } from '../lib/constants/appConstants';
import { normalizeVisibleTab } from '../lib/utils/appTabs';
import { compareSensitivity, normalizeSensitivity } from '../lib/utils/sensitivity';
import { buildQuickStartSettings } from '../lib/utils/guidedFlow';
import type {
  AiPrediction,
  AppSettings,
  AppTab,
  DuelChoice,
  LabMetrics,
  LabRunQuality,
  RangeTestEntry,
  StoredSession,
} from '../types/models';
import { resolveCurrentSession } from './sessionControllerUtils';

interface RangeEntryDraft {
  sensitivity: number;
  accuracyScore: number;
  trackingComfort: number;
  flickComfort: number;
  overshoot: number;
  overallFeeling: number;
  memo: string;
}

function upsertRangeEntry(entries: RangeTestEntry[], nextEntry: RangeTestEntry): RangeTestEntry[] {
  const index = entries.findIndex((entry) => entry.sensitivity === nextEntry.sensitivity);

  if (index === -1) {
    return [...entries, nextEntry].sort((left, right) => compareSensitivity(left.sensitivity, right.sensitivity));
  }

  const nextEntries = [...entries];
  nextEntries[index] = nextEntry;
  return nextEntries.sort((left, right) => compareSensitivity(left.sensitivity, right.sensitivity));
}

function rebuildDerivedSession(session: StoredSession): StoredSession {
  return touchSession(deriveSession(session));
}

export function useSessionController() {
  const storage = useMemo(() => createLocalStorageAdapter(), []);
  const initialSessions = useMemo(() => storage.listSessions(), [storage]);
  const [sessions, setSessions] = useState<StoredSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessions[0]?.id ?? null);
  const [setupDraft, setSetupDraft] = useState<AppSettings>(initialSessions[0]?.settings ?? DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<AppTab>(
    normalizeVisibleTab(initialSessions[0]?.experimentState.lastResumeTab),
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const draftSessionIdRef = useRef<string | null>(currentSessionId);

  const currentSession = useMemo(
    () => resolveCurrentSession(sessions, currentSessionId),
    [currentSessionId, sessions],
  );

  useEffect(() => {
    // 같은 세션의 탭/진행 상태 저장은 사용자가 편집 중인 설정 초안을 덮지 않습니다.
    if (draftSessionIdRef.current === currentSessionId) {
      return;
    }

    draftSessionIdRef.current = currentSessionId;
    setSetupDraft(currentSession?.settings ?? DEFAULT_SETTINGS);
  }, [currentSession, currentSessionId]);

  function refreshSessions(nextCurrentId?: string | null): void {
    const nextSessions = storage.listSessions();
    setSessions(nextSessions);

    if (typeof nextCurrentId !== 'undefined') {
      setCurrentSessionId(nextCurrentId);
      return;
    }

    if (nextSessions.length === 0) {
      setCurrentSessionId(null);
      return;
    }

    if (!nextSessions.some((session) => session.id === currentSessionId)) {
      setCurrentSessionId(nextSessions[0].id);
    }
  }

  function persistSession(session: StoredSession, nextTab?: AppTab): boolean {
    if (!storage.saveSession(session)) {
      setStorageError('브라우저 저장소에 기록하지 못했습니다. 저장 공간과 비공개 모드 설정을 확인해 주세요.');
      return false;
    }

    setStorageError(null);
    refreshSessions(session.id);

    if (nextTab) {
      setActiveTab(normalizeVisibleTab(nextTab));
    }

    return true;
  }

  function handleSwitchTab(nextTab: AppTab): void {
    setActiveTab(nextTab);

    if (!currentSession) {
      return;
    }

    persistSession(
      updateExperimentPreferences(currentSession, {
        lastResumeTab: nextTab,
      }),
    );
  }

  function handleStartSession(settings: AppSettings): void {
    const created = createSession(settings);
    const session = rebuildDerivedSession({
      ...created,
      experimentState: initializeExperimentState(created.settings, created.testProtocol),
    });

    persistSession(session, 'finder');
  }

  function handleStartQuickSession(settings: AppSettings): void {
    const quickSettings = buildQuickStartSettings(settings);
    const created = createSession(quickSettings, QUICK_START_TEST_PROTOCOL);
    const session = rebuildDerivedSession({
      ...created,
      experimentState: initializeExperimentState(created.settings, created.testProtocol),
    });

    persistSession(session, 'finder');
  }

  function handleSaveRangeEntry(draft: RangeEntryDraft): void {
    if (!currentSession) {
      return;
    }

    const weightedScore = calculateWeightedScore({
      accuracyScore: draft.accuracyScore,
      trackingComfort: draft.trackingComfort,
      flickComfort: draft.flickComfort,
      overshoot: draft.overshoot,
      overallFeeling: draft.overallFeeling,
    });

    const nextEntry: RangeTestEntry = {
      ...draft,
      sensitivity: normalizeSensitivity(draft.sensitivity),
      weightedScore,
      testedAt: new Date().toISOString(),
    };

    persistSession(
      rebuildDerivedSession({
        ...currentSession,
        rangeEntries: upsertRangeEntry(currentSession.rangeEntries, nextEntry),
      }),
    );
  }

  function handleDeleteRangeEntry(sensitivity: number): void {
    if (!currentSession) {
      return;
    }

    const normalizedSensitivity = normalizeSensitivity(sensitivity);

    persistSession(
      rebuildDerivedSession({
        ...currentSession,
        rangeEntries: currentSession.rangeEntries.filter((entry) => entry.sensitivity !== normalizedSensitivity),
      }),
    );
  }

  function handleRecordDuel(choice: DuelChoice, note: string, pair?: { candidateA: number; candidateB: number }): void {
    if (!currentSession || !pair) {
      return;
    }

    persistSession(
      rebuildDerivedSession({
        ...currentSession,
        duelMatches: [
          ...currentSession.duelMatches,
          {
            candidateA: normalizeSensitivity(pair.candidateA),
            candidateB: normalizeSensitivity(pair.candidateB),
            choice,
            note,
            playedAt: new Date().toISOString(),
            source: 'manual',
            pairId: null,
          },
        ],
      }),
    );
  }

  function handleRecordLabTask(taskId: string, metrics: LabMetrics, quality?: LabRunQuality): boolean {
    if (!currentSession) {
      return false;
    }

    const nextSession = recordLabRun(currentSession, taskId, metrics, quality);
    const nextTab =
      nextSession.experimentState.stage === 'result'
        ? 'results'
        : activeTab === 'settings'
          ? 'settings'
          : 'finder';

    return persistSession(nextSession, nextTab);
  }

  function handleUpdateLabPreferences(
    patch: Partial<Pick<StoredSession['experimentState'], 'calibrationMultiplier' | 'manualSensitivityOverride' | 'lastLabSection' | 'lastResumeTab'>>,
  ): void {
    if (!currentSession) {
      return;
    }

    persistSession(
      updateExperimentPreferences(currentSession, {
        ...patch,
        manualSensitivityOverride:
          typeof patch.manualSensitivityOverride === 'number'
            ? normalizeSensitivity(patch.manualSensitivityOverride)
            : patch.manualSensitivityOverride,
      }),
    );
  }

  function handleLoadSession(sessionId: string, tab: AppTab = 'results'): void {
    const session = sessions.find((item) => item.id === sessionId);

    setCurrentSessionId(sessionId);
    setActiveTab(tab);

    if (session) {
      persistSession(
        updateExperimentPreferences(session, {
          lastResumeTab: tab,
        }),
      );
    }
  }

  function handleDeleteSession(sessionId: string): void {
    if (!storage.deleteSession(sessionId)) {
      setStorageError('기록을 삭제하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.');
      return;
    }

    setStorageError(null);
    const remaining = storage.listSessions();
    setSessions(remaining);

    if (currentSessionId === sessionId) {
      setCurrentSessionId(remaining[0]?.id ?? null);
      setActiveTab(normalizeVisibleTab(remaining[0]?.experimentState.lastResumeTab));
    }
  }

  function handleLoadSample(): void {
    const sample = storage.loadSampleSession();

    if (!storage.saveSession(sample)) {
      setStorageError('샘플 기록을 저장하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.');
      return;
    }

    setStorageError(null);
    refreshSessions(sample.id);
    setActiveTab('results');
  }

  function handleImportAiPrediction(prediction: AiPrediction): void {
    if (!currentSession) {
      return;
    }

    persistSession(
      rebuildDerivedSession({
        ...currentSession,
        aiPrediction: prediction,
      }),
    );
  }

  return {
    sessions,
    currentSession,
    currentSessionId,
    activeTab,
    storageError,
    setupDraft,
    setSetupDraft,
    switchTab: handleSwitchTab,
    startSession: handleStartSession,
    startQuickSession: handleStartQuickSession,
    saveRangeEntry: handleSaveRangeEntry,
    deleteRangeEntry: handleDeleteRangeEntry,
    recordDuel: handleRecordDuel,
    recordLabTask: handleRecordLabTask,
    updateLabPreferences: handleUpdateLabPreferences,
    loadSession: handleLoadSession,
    deleteSession: handleDeleteSession,
    loadSample: handleLoadSample,
    importAiPrediction: handleImportAiPrediction,
  };
}
