import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  QUICK_MODE_MAX_TOTAL_BUNDLES,
  QUICK_START_TEST_PROTOCOL,
} from '../constants/appConstants';
import {
  initializeExperimentState,
  orderCandidatesAroundCenter,
  recordLabRun,
} from './experimentController';
import { createSession } from '../utils/sessionUtils';

function createMetrics(mode: 'flick' | 'tracking' | 'turn', sensitivity: number) {
  const distanceFromBest = Math.abs(sensitivity - 2.3);
  const speedPenalty = distanceFromBest * 120;
  const trackingPenalty = distanceFromBest * 0.8;
  const overshootPenalty = distanceFromBest * 8;

  if (mode === 'flick') {
    return {
      shotCount: 20,
      hits: Math.max(12, Math.round(18 - distanceFromBest * 10)),
      misses: Math.min(8, Math.round(2 + distanceFromBest * 10)),
      hitRate: Math.max(0.6, 0.92 - distanceFromBest * 0.2),
      oneShotHitRate: Math.max(0.45, 0.8 - distanceFromBest * 0.18),
      averageTimeToHitMs: 520 + speedPenalty,
      averageCorrectionTimeMs: 160 + distanceFromBest * 80,
      overshootEvents: 1 + overshootPenalty,
      overshootReturnCount: 1 + distanceFromBest * 4,
      reacquireCount: 1 + distanceFromBest * 4,
      firstEnterDelayMs: 220 + distanceFromBest * 50,
      preClickJitter: 0.01 + distanceFromBest * 0.01,
      averageOvershootAmount: 2.1 + distanceFromBest * 6,
    };
  }

  if (mode === 'tracking') {
    return {
      durationMs: 15000,
      averageCrosshairDistanceDeg: 2 + distanceFromBest * 3,
      timeOnTargetRatio: Math.max(0.55, 0.84 - trackingPenalty * 0.1),
      followStability: Math.max(55, 86 - distanceFromBest * 24),
      movementSmoothness: Math.max(55, 84 - distanceFromBest * 20),
      trackingLossCount: 2 + distanceFromBest * 8,
      averageCorrectionFrequency: 1 + distanceFromBest * 2,
    };
  }

  return {
    instructionCount: 10,
    completionRate: 1,
    completionTimeMs: 940 + speedPenalty * 1.4,
    angularErrorDeg: 2.2 + distanceFromBest * 8,
    overshootAngleDeg: 6 + overshootPenalty * 2,
    correctionCount: 1 + distanceFromBest * 6,
    stabilizationTimeMs: 170 + distanceFromBest * 200,
  };
}

function createConfidentMetrics(
  mode: 'flick' | 'tracking' | 'turn',
  preferred: boolean,
) {
  if (!preferred) {
    return createMetrics(mode, 8);
  }

  if (mode === 'tracking') {
    return {
      durationMs: 15000,
      averageCrosshairDistanceDeg: 1,
      timeOnTargetRatio: 0.95,
      followStability: 95,
      movementSmoothness: 95,
      trackingLossCount: 0,
      averageCorrectionFrequency: 0.5,
    };
  }

  if (mode === 'flick') {
    return {
      ...createMetrics(mode, 2.3),
      overshootEvents: 0,
      overshootReturnCount: 0,
      averageOvershootAmount: 0,
    };
  }

  return {
    ...createMetrics(mode, 2.3),
    overshootAngleDeg: 0,
    correctionCount: 0,
  };
}

describe('experimentController', () => {
  it('후보를 현재 감도부터 낮은 값과 높은 값이 번갈아 오도록 정렬한다', () => {
    expect(orderCandidatesAroundCenter([1.8, 2.2, 2.5, 2.8, 3.2], 2.5)).toEqual([
      2.5,
      2.2,
      2.8,
      1.8,
      3.2,
    ]);

    const firstState = initializeExperimentState(DEFAULT_SETTINGS);
    const secondState = initializeExperimentState(DEFAULT_SETTINGS);
    const firstOrder = Array.from(
      new Set(firstState.tasks.map((task) => task.sensitivity)),
    );
    const secondOrder = Array.from(
      new Set(secondState.tasks.map((task) => task.sensitivity)),
    );

    expect(firstOrder).toEqual([2.5, 2.2, 2.8, 1.8, 3.2]);
    expect(secondOrder).toEqual(firstOrder);
  });

  it('초기 실험 상태에서 넓은 기준 확인 작업을 만든다', () => {
    const state = initializeExperimentState(DEFAULT_SETTINGS);

    expect(state.stage).toBe('range_test');
    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.activeTaskId).not.toBeNull();
    expect(state.searchPhase).toBe('wide_probe');
    expect(state.searchCenter).toBe(DEFAULT_SETTINGS.currentSensitivity);
  });

  it('범위 확인 작업이 끝나면 다음 단계로 넘어간다', () => {
    let session = createSession(DEFAULT_SETTINGS);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, session.testProtocol),
    };

    while (session.experimentState.stage === 'range_test' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    expect(session.labRuns.length).toBeGreaterThan(0);
    expect(session.experimentState.stage).not.toBe('range_test');
    expect(session.decisionLog.length).toBeGreaterThan(0);
  });

  it('자동 측정 결과를 넣어도 마지막에 보이는 탭 값은 유지된다', () => {
    let session = createSession(DEFAULT_SETTINGS);
    session = {
      ...session,
      experimentState: {
        ...initializeExperimentState(DEFAULT_SETTINGS, session.testProtocol),
        lastResumeTab: 'settings',
      },
    };

    const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

    expect(task).toBeTruthy();

    session = recordLabRun(session, task!.id, createMetrics(task!.mode, task!.sensitivity));

    expect(session.experimentState.lastResumeTab).toBe('settings');
  });

  it('이미 완료한 작업 결과가 다시 들어와도 중복 저장하지 않는다', () => {
    let session = createSession(DEFAULT_SETTINGS);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, session.testProtocol),
    };

    const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

    expect(task).toBeTruthy();

    session = recordLabRun(session, task!.id, createMetrics(task!.mode, task!.sensitivity));

    const afterFirstRun = session;
    const duplicateResult = recordLabRun(session, task!.id, createMetrics(task!.mode, task!.sensitivity));

    expect(duplicateResult).toBe(afterFirstRun);
    expect(duplicateResult.labRuns).toHaveLength(1);
    expect(duplicateResult.labRuns.filter((run) => run.taskId === task!.id)).toHaveLength(1);
  });

  it('실행 품질 스냅샷을 측정 기록과 함께 보존한다', () => {
    let session = createSession(DEFAULT_SETTINGS);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, session.testProtocol),
    };
    const task = session.experimentState.tasks.find(
      (item) => item.id === session.experimentState.activeTaskId,
    );
    const quality = {
      schemaVersion: 1 as const,
      rawInput: true,
      maxFrameGapMs: 18.2,
      longFrameRatio: 0,
      frameSampleCount: 120,
      viewportWidth: 1600,
      viewportHeight: 900,
      aspectRatio: 1.7778,
      referenceAspect: true,
      horizontalFieldOfView: 103,
      verticalFieldOfView: 70.5328,
      calibrationMultiplier: 1,
    };

    expect(task).toBeTruthy();
    session = recordLabRun(
      session,
      task!.id,
      createMetrics(task!.mode, task!.sensitivity),
      quality,
    );

    expect(session.labRuns[0].quality).toEqual(quality);
  });

  it('현재 감도와 잘 맞는 감도가 멀면 탐색 중심을 다시 옮긴다', () => {
    let session = createSession({
      ...DEFAULT_SETTINGS,
      currentSensitivity: 4,
    });
    session = {
      ...session,
      experimentState: initializeExperimentState(session.settings, session.testProtocol),
    };

    while (session.experimentState.stage === 'range_test' && session.experimentState.searchPhase === 'wide_probe') {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    expect(session.experimentState.searchPhase).toBe('focused_probe');
    expect(session.experimentState.recenterCount).toBeGreaterThan(0);
    expect(session.experimentState.searchCenter).toBeLessThan(4);
    expect(session.decisionLog.some((record) => record.action === 'recentered')).toBe(true);
  });

  it('전체 자동 흐름은 최종 확인을 거쳐 결과까지 간다', () => {
    let session = createSession(DEFAULT_SETTINGS);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, session.testProtocol),
    };

    while (session.experimentState.stage !== 'result' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    expect(session.experimentState.stage).toBe('result');
    expect(session.validationResult).not.toBeNull();
    expect(session.recommendation.finalSensitivity).not.toBeNull();
    expect(session.decisionLog.some((record) => record.stage === 'validation')).toBe(true);
  });

  it('빠른 시작 모드에서는 비교가 길어지기 전에 최종 확인으로 넘어간다', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (session.experimentState.stage === 'range_test' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    expect(session.experimentState.recenterCount).toBeLessThanOrEqual(1);
    expect(['validation', 'result']).toContain(session.experimentState.stage);
  });

  it('빠른 시작은 양쪽 후보의 묶음을 끝낸 뒤에만 높은 확신으로 조기 종료한다', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (
      session.experimentState.stage === 'range_test' &&
      new Set(
        session.labRuns
          .filter((run) => run.stage === 'range_test')
          .map((run) => run.sensitivity),
      ).size < 2
    ) {
      const task = session.experimentState.tasks.find(
        (item) => item.id === session.experimentState.activeTaskId,
      );

      expect(task).toBeTruthy();
      session = recordLabRun(
        session,
        task!.id,
        createConfidentMetrics(
          task!.mode,
          task!.sensitivity === DEFAULT_SETTINGS.currentSensitivity,
        ),
      );
    }

    expect(session.experimentState.stage).toBe('range_test');

    while (session.experimentState.stage === 'range_test' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find(
        (item) => item.id === session.experimentState.activeTaskId,
      );

      expect(task).toBeTruthy();
      session = recordLabRun(
        session,
        task!.id,
        createConfidentMetrics(
          task!.mode,
          task!.sensitivity === DEFAULT_SETTINGS.currentSensitivity,
        ),
      );
    }

    const rangeBundles = new Set(
      session.labRuns
        .filter((run) => run.stage === 'range_test')
        .map((run) => run.sensitivity),
    );

    expect(session.experimentState.stage).toBe('validation');
    expect(rangeBundles.size).toBe(3);
    expect(session.experimentState.stopReason).toContain('양쪽 후보');
    expect(session.experimentState.stopReason).not.toContain('측정 상한');
  });

  it('양쪽을 확인했어도 최고점이 탐색 가장자리면 조기 종료하지 않는다', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (
      session.experimentState.stage === 'range_test' &&
      new Set(
        session.labRuns
          .filter((run) => run.stage === 'range_test')
          .map((run) => run.sensitivity),
      ).size < 3
    ) {
      const task = session.experimentState.tasks.find(
        (item) => item.id === session.experimentState.activeTaskId,
      );

      expect(task).toBeTruthy();
      session = recordLabRun(
        session,
        task!.id,
        createMetrics(task!.mode, task!.sensitivity),
      );
    }

    const ranked = [...session.labSummaries].sort(
      (left, right) =>
        (right.combinedWeightedScore ?? 0) - (left.combinedWeightedScore ?? 0),
    );
    const testedSensitivities = session.labSummaries.map((summary) => summary.sensitivity);

    expect(ranked[0]?.sensitivity).toBe(Math.min(...testedSensitivities));
    expect(session.experimentState.stage).toBe('range_test');
    expect(session.experimentState.stopReason).toBeNull();
  });

  it('추천 감도가 잡히면 다음 시험 기준값도 같은 감도로 맞춰진다', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (session.experimentState.stage === 'range_test' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    expect(session.experimentState.manualSensitivityOverride).toBe(
      session.recommendation.preValidationSensitivity ?? session.recommendation.bestSensitivity,
    );
  });

  it('최종 확인 중에는 진입 시점의 기준 감도를 바꾸지 않는다', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (session.experimentState.stage !== 'validation' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find(
        (item) => item.id === session.experimentState.activeTaskId,
      );
      if (!task) {
        break;
      }
      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    const frozenBaseline = session.recommendation.preValidationSensitivity;
    expect(frozenBaseline).not.toBeNull();

    while (session.experimentState.stage === 'validation' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find(
        (item) => item.id === session.experimentState.activeTaskId,
      );
      if (!task) {
        break;
      }
      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
      if (session.experimentState.stage === 'validation') {
        expect(session.recommendation.preValidationSensitivity).toBe(frozenBaseline);
      }
    }

    expect(session.validationResult?.baselineSensitivity).toBe(frozenBaseline);
  });

  it('quick mode finishes within the configured bundle cap', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (session.experimentState.stage !== 'result' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    const bundleCount = new Set(
      session.labRuns.map((run) =>
        run.stage === 'duel_test'
          ? `${run.stage}:${run.pairId ?? 'single'}`
          : `${run.stage}:${run.protocolVariant}:${run.sensitivity}`,
      ),
    ).size;

    expect(session.experimentState.stage).toBe('result');
    expect(bundleCount).toBeLessThanOrEqual(QUICK_MODE_MAX_TOTAL_BUNDLES);
  });

  it.each([0.5, 8])('quick mode completes from boundary sensitivity %s within the total bundle cap', (currentSensitivity) => {
    const settings = {
      ...DEFAULT_SETTINGS,
      currentSensitivity,
    };
    let session = createSession(settings, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(settings, QUICK_START_TEST_PROTOCOL),
    };

    while (session.experimentState.stage !== 'result' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find((item) => item.id === session.experimentState.activeTaskId);

      if (!task) {
        break;
      }

      session = recordLabRun(session, task.id, createMetrics(task.mode, task.sensitivity));
    }

    const rangeBundles = new Set(
      session.labRuns
        .filter((run) => run.stage === 'range_test')
        .map((run) => run.sensitivity),
    );
    const totalBundles = new Set(
      session.labRuns.map((run) =>
        run.stage === 'duel_test'
          ? `${run.stage}:${run.pairId ?? 'single'}`
          : `${run.stage}:${run.protocolVariant}:${run.sensitivity}`,
      ),
    ).size;

    expect(session.experimentState.stage).toBe('result');
    expect(rangeBundles.size).toBe(5);
    expect(totalBundles).toBeLessThanOrEqual(QUICK_MODE_MAX_TOTAL_BUNDLES);
  });

  it('quick mode describes a bundle cap as a cap instead of confidence', () => {
    let session = createSession(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    session = {
      ...session,
      experimentState: initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL),
    };

    while (session.experimentState.stage === 'range_test' && session.experimentState.activeTaskId) {
      const task = session.experimentState.tasks.find(
        (item) => item.id === session.experimentState.activeTaskId,
      );

      if (!task) {
        break;
      }

      // 모든 감도에 같은 측정값을 넣어 신뢰도 종료가 아닌 예산 상한 경로를 확인합니다.
      session = recordLabRun(session, task.id, createMetrics(task.mode, 2.3));
    }

    expect(session.experimentState.stage).toBe('validation');
    expect(session.experimentState.stopReason).toContain('측정 상한');
    expect(session.experimentState.stopReason).not.toContain('충분히 경향');
  });
});
