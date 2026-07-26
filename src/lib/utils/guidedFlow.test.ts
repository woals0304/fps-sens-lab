import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  QUICK_MODE_MAX_ESTIMATED_SECONDS,
  QUICK_MODE_MAX_VALIDATION_BUNDLES,
  QUICK_START_TEST_PROTOCOL,
  STANDARD_TEST_PROTOCOL,
} from '../constants/appConstants';
import { initializeExperimentState } from '../experiment/experimentController';
import type { ExperimentTask } from '../../types/models';
import {
  estimateRemainingSeconds,
  getGuidedBundleProgress,
  getGuidedTransitionMessage,
  getRemainingComparisonCount,
} from './guidedFlow';

function getBundleSeconds(protocol: typeof QUICK_START_TEST_PROTOCOL.standard): number {
  return (
    Math.ceil((protocol.flickTargetCount * protocol.flickTargetTimeoutMs) / 1000) +
    Math.ceil(protocol.trackingDurationMs / 1000) +
    Math.ceil((protocol.turnInstructions.length * protocol.turnTrialTimeoutMs) / 1000) +
    2
  );
}

describe('guidedFlow', () => {
  it('quick start eta includes reserved final check time', () => {
    const state = initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    const expectedSeconds =
      getBundleSeconds(QUICK_START_TEST_PROTOCOL.standard) * 5 +
      getBundleSeconds(QUICK_START_TEST_PROTOCOL.validation) * QUICK_MODE_MAX_VALIDATION_BUNDLES;

    expect(
      estimateRemainingSeconds(state.tasks, state.activeTaskId, QUICK_START_TEST_PROTOCOL),
    ).toBe(expectedSeconds);
    expect(
      getRemainingComparisonCount(state.tasks, state.activeTaskId, QUICK_START_TEST_PROTOCOL),
    ).toBe(5 + QUICK_MODE_MAX_VALIDATION_BUNDLES);
  });

  it('removes completed modes from eta without removing the current comparison early', () => {
    const state = initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    const initialSeconds = estimateRemainingSeconds(
      state.tasks,
      state.activeTaskId,
      QUICK_START_TEST_PROTOCOL,
    );
    const [flickTask, trackingTask, turnTask] = state.tasks.slice(0, 3);
    const flickSeconds = Math.ceil(
      (QUICK_START_TEST_PROTOCOL.standard.flickTargetCount *
        QUICK_START_TEST_PROTOCOL.standard.flickTargetTimeoutMs) /
        1000,
    );
    const afterFlick = state.tasks.map((task) =>
      task.id === flickTask.id ? { ...task, status: 'completed' as const } : task,
    );

    expect(
      estimateRemainingSeconds(afterFlick, trackingTask.id, QUICK_START_TEST_PROTOCOL),
    ).toBe(initialSeconds - flickSeconds);
    expect(
      getRemainingComparisonCount(afterFlick, trackingTask.id, QUICK_START_TEST_PROTOCOL),
    ).toBe(5 + QUICK_MODE_MAX_VALIDATION_BUNDLES);

    const afterFirstBundle = afterFlick.map((task) =>
      task.id === trackingTask.id || task.id === turnTask.id
        ? { ...task, status: 'completed' as const }
        : task,
    );
    const firstBundleSeconds = getBundleSeconds(QUICK_START_TEST_PROTOCOL.standard);

    expect(
      estimateRemainingSeconds(afterFirstBundle, flickTask.id, QUICK_START_TEST_PROTOCOL),
    ).toBe(initialSeconds - firstBundleSeconds);
    expect(
      getRemainingComparisonCount(afterFirstBundle, flickTask.id, QUICK_START_TEST_PROTOCOL),
    ).toBe(4 + QUICK_MODE_MAX_VALIDATION_BUNDLES);
    expect(getGuidedBundleProgress(afterFirstBundle, flickTask.id)).toMatchObject({
      current: 2,
      total: 5,
      remaining: 4,
    });
  });

  it('does not reserve final checks again after validation tasks are scheduled', () => {
    const state = initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    const validationTasks: ExperimentTask[] = state.tasks.slice(0, 6).map((task, index) => ({
      ...task,
      id: `validation-${index}`,
      stage: 'validation',
      protocolVariant: 'validation',
    }));
    const validationBundleSeconds = getBundleSeconds(QUICK_START_TEST_PROTOCOL.validation);

    expect(
      estimateRemainingSeconds(validationTasks, validationTasks[0].id, QUICK_START_TEST_PROTOCOL),
    ).toBe(validationBundleSeconds * 2);
    expect(
      getRemainingComparisonCount(
        validationTasks,
        validationTasks[0].id,
        QUICK_START_TEST_PROTOCOL,
      ),
    ).toBe(2);
  });

  it('does not apply the quick-mode eta cap to the standard protocol', () => {
    const state = initializeExperimentState(DEFAULT_SETTINGS, STANDARD_TEST_PROTOCOL);
    const expectedSeconds = getBundleSeconds(STANDARD_TEST_PROTOCOL.standard) * 5;
    const actualSeconds = estimateRemainingSeconds(
      state.tasks,
      state.activeTaskId,
      STANDARD_TEST_PROTOCOL,
    );

    expect(expectedSeconds).toBeGreaterThan(QUICK_MODE_MAX_ESTIMATED_SECONDS);
    expect(actualSeconds).toBe(expectedSeconds);
    expect(
      getRemainingComparisonCount(state.tasks, state.activeTaskId, STANDARD_TEST_PROTOCOL),
    ).toBe(5);
  });

  it('같은 감도와 감도 변경 전환을 짧게 구분해 안내한다', () => {
    const state = initializeExperimentState(DEFAULT_SETTINGS, QUICK_START_TEST_PROTOCOL);
    const [flick, tracking] = state.tasks;
    const changedSensitivityTask = {
      ...tracking,
      sensitivity: tracking.sensitivity + 0.2,
    };

    expect(getGuidedTransitionMessage(flick, tracking)).toContain('감도 2.50 유지');
    expect(getGuidedTransitionMessage(flick, changedSensitivityTask)).toContain('으로 변경');
  });
});
