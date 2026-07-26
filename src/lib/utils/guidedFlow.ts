import {
  DEFAULT_SETTINGS,
  QUICK_MODE_MAX_ESTIMATED_SECONDS,
  QUICK_MODE_MAX_VALIDATION_BUNDLES,
  QUICK_START_TEST_PROTOCOL,
} from '../constants/appConstants';
import type { AppSettings, ExperimentStage, ExperimentTask, TestProtocol } from '../../types/models';
import { formatSensitivity, normalizeSensitivity } from './sensitivity';
import { buildAutoSensitivitySettings } from './autoSensitivityRange';
import { getLabModeLabel } from './uiText';

interface GuidedStageInfo {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
}

export interface GuidedBundleProgress {
  current: number;
  total: number;
  remaining: number;
}

function getTaskBundleKey(task: ExperimentTask): string {
  // 같은 감도 묶음을 한 번의 비교로 세기 위한 열쇠입니다.
  if (task.stage === 'duel_test') {
    return `${task.stage}:${task.pairId ?? 'single'}:${task.pairLabel ?? 'one'}`;
  }

  return `${task.stage}:${task.protocolVariant}:${task.sensitivity}`;
}

function getPendingBundleTasks(tasks: ExperimentTask[]): ExperimentTask[][] {
  const bundles = new Map<string, ExperimentTask[]>();

  for (const task of tasks) {
    if (task.status === 'completed') {
      continue;
    }

    const key = getTaskBundleKey(task);
    const bundleTasks = bundles.get(key) ?? [];
    bundleTasks.push(task);
    bundles.set(key, bundleTasks);
  }

  return Array.from(bundles.values());
}

function getTaskEstimateSeconds(task: ExperimentTask, testProtocol: TestProtocol): number {
  const protocolConfig = task.protocolVariant === 'validation' ? testProtocol.validation : testProtocol.standard;

  if (task.mode === 'flick') {
    return Math.ceil(
      (protocolConfig.flickTargetCount * protocolConfig.flickTargetTimeoutMs) / 1000,
    );
  }

  if (task.mode === 'tracking') {
    return Math.ceil(protocolConfig.trackingDurationMs / 1000);
  }

  return Math.ceil(
    (protocolConfig.turnInstructions.length * protocolConfig.turnTrialTimeoutMs) / 1000,
  );
}

function getBundleEstimateSeconds(tasks: ExperimentTask[], testProtocol: TestProtocol): number {
  if (tasks.length === 0) {
    return 0;
  }

  const taskSeconds = tasks.reduce(
    (total, task) => total + getTaskEstimateSeconds(task, testProtocol),
    0,
  );

  // 아직 남은 묶음마다 안내와 모드 전환에 쓸 짧은 여유만 한 번 더합니다.
  return taskSeconds + 2;
}

function isQuickStartProtocol(testProtocol: TestProtocol): boolean {
  return testProtocol.version === QUICK_START_TEST_PROTOCOL.version;
}

function getReservedQuickModeSeconds(tasks: ExperimentTask[], testProtocol: TestProtocol): number {
  if (!isQuickStartProtocol(testProtocol)) {
    return 0;
  }

  const hasPendingValidationTask = tasks.some(
    (task) => task.status !== 'completed' && task.stage === 'validation',
  );

  if (hasPendingValidationTask) {
    return 0;
  }

  const validationRepresentative: ExperimentTask = {
    ...(tasks[0] ?? {
      id: 'estimate-only',
      title: '',
      description: '',
      stage: 'validation',
      mode: 'flick',
      section: 'flick',
      protocolVariant: 'validation',
      sensitivity: DEFAULT_SETTINGS.currentSensitivity,
      seed: 0,
      pairId: null,
      pairLabel: null,
      compareAgainst: null,
      status: 'pending',
      createdAt: '',
    }),
    stage: 'validation',
    protocolVariant: 'validation',
  };
  const validationBundle = (['flick', 'tracking', 'turn'] as const).map((mode) => ({
    ...validationRepresentative,
    mode,
    section: mode,
  }));

  return getBundleEstimateSeconds(validationBundle, testProtocol) * QUICK_MODE_MAX_VALIDATION_BUNDLES;
}

function getReservedQuickModeComparisonCount(tasks: ExperimentTask[], testProtocol: TestProtocol): number {
  if (!isQuickStartProtocol(testProtocol)) {
    return 0;
  }

  const pendingTasks = tasks.filter((task) => task.status !== 'completed');

  if (pendingTasks.length === 0 || pendingTasks.some((task) => task.stage === 'validation')) {
    return 0;
  }

  return QUICK_MODE_MAX_VALIDATION_BUNDLES;
}

export function getRemainingComparisonCount(
  tasks: ExperimentTask[],
  activeTaskId: string | null,
  testProtocol?: TestProtocol,
): number {
  const progress = getGuidedBundleProgress(tasks, activeTaskId);
  const reservedComparisons = testProtocol
    ? getReservedQuickModeComparisonCount(tasks, testProtocol)
    : 0;

  return progress.remaining + reservedComparisons;
}

export function formatEstimatedTime(seconds: number): string {
  if (seconds <= 10) {
    return '약 10초 이내';
  }

  if (seconds < 60) {
    return `약 ${seconds}초`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;

  if (remainSeconds === 0) {
    return `약 ${minutes}분`;
  }

  return `약 ${minutes}분 ${remainSeconds}초`;
}

export function estimateRemainingTime(
  tasks: ExperimentTask[],
  activeTaskId: string | null,
  testProtocol: TestProtocol,
): string {
  return formatEstimatedTime(estimateRemainingSeconds(tasks, activeTaskId, testProtocol));
}

export function estimateRemainingSeconds(
  tasks: ExperimentTask[],
  _activeTaskId: string | null,
  testProtocol: TestProtocol,
): number {
  const pendingBundles = getPendingBundleTasks(tasks);

  if (pendingBundles.length === 0) {
    return 0;
  }

  const estimatedSeconds = pendingBundles.reduce(
    (total, bundleTasks) => total + getBundleEstimateSeconds(bundleTasks, testProtocol),
    0,
  );
  const reservedSeconds = getReservedQuickModeSeconds(tasks, testProtocol);
  const totalSeconds = estimatedSeconds + reservedSeconds;

  return isQuickStartProtocol(testProtocol)
    ? Math.min(totalSeconds, QUICK_MODE_MAX_ESTIMATED_SECONDS)
    : totalSeconds;
}

export function buildQuickStartSettings(draft: AppSettings): AppSettings {
  // 빠른 시작은 현재 감도만 받고, 범위와 간격은 자동으로 계산합니다.
  return buildAutoSensitivitySettings({
    ...draft,
    currentSensitivity: normalizeSensitivity(
      Number.isFinite(draft.currentSensitivity) ? draft.currentSensitivity : DEFAULT_SETTINGS.currentSensitivity,
    ),
  });
}

export function getGuidedStageInfo(stage: ExperimentStage): GuidedStageInfo {
  if (stage === 'range_test') {
    return {
      stepNumber: 1,
      totalSteps: 3,
      title: '감도 범위 확인',
      description: '현재 감도보다 낮고 높은 값을 비교합니다.',
    };
  }

  if (stage === 'duel_test' || stage === 'fine_tune') {
    return {
      stepNumber: 2,
      totalSteps: 3,
      title: '후보 비교',
      description: '점수가 좋은 감도끼리 비교합니다.',
    };
  }

  if (stage === 'validation') {
    return {
      stepNumber: 3,
      totalSteps: 3,
      title: '최종 확인',
      description: '추천 감도와 주변 값을 한 번 더 측정합니다.',
    };
  }

  if (stage === 'result') {
    return {
      stepNumber: 3,
      totalSteps: 3,
      title: '결과 정리 중',
      description: '추천 감도를 정리하고 있습니다.',
    };
  }

  return {
    stepNumber: 1,
    totalSteps: 3,
    title: '시작 준비',
    description: '짧은 시험을 시작할 준비를 하고 있습니다.',
  };
}

export function getGuidedInstruction(task: ExperimentTask | null): string {
  if (!task) {
    return '다음 안내를 준비하고 있습니다.';
  }

  if (task.stage === 'validation') {
    return `감도 ${formatSensitivity(task.sensitivity)}으로 마지막 측정을 진행하세요.`;
  }

  if (task.stage === 'fine_tune') {
    return `감도 ${formatSensitivity(task.sensitivity)}가 더 자연스러운지 짧게 확인해 보세요.`;
  }

  if (task.stage === 'duel_test' && task.compareAgainst !== null) {
    if (task.pairLabel === 'A') {
      return `먼저 감도 ${formatSensitivity(task.sensitivity)}를 시험한 뒤, 이어서 ${formatSensitivity(task.compareAgainst)}도 같은 방식으로 확인합니다.`;
    }

    return `이제 감도 ${formatSensitivity(task.sensitivity)}를 이어서 시험해 보세요.`;
  }

  return `감도 ${formatSensitivity(task.sensitivity)}으로 짧게 움직여 보세요.`;
}

export function getGuidedModeHint(task: ExperimentTask | null): string {
  if (!task) {
    return '준비가 끝나면 바로 다음 시험으로 이어집니다.';
  }

  if (task.mode === 'flick') {
    return '표적이 보이면 빠르게 맞춰 주세요.';
  }

  if (task.mode === 'tracking') {
    return '움직이는 표적을 끝까지 따라가 보세요.';
  }

  return '지시된 방향으로 빠르게 돌린 뒤 멈춰 주세요.';
}

export function getGuidedTransitionMessage(
  completedTask: ExperimentTask,
  nextTask: ExperimentTask,
): string {
  const completedLabel = getLabModeLabel(completedTask.mode);
  const nextLabel = getLabModeLabel(nextTask.mode);

  if (completedTask.sensitivity !== nextTask.sensitivity) {
    return `${completedLabel} 완료 · 감도 ${formatSensitivity(nextTask.sensitivity)}으로 변경 · ${nextLabel}`;
  }

  return `${completedLabel} 완료 · 다음은 ${nextLabel} · 감도 ${formatSensitivity(nextTask.sensitivity)} 유지`;
}

export function getGuidedBundleProgress(tasks: ExperimentTask[], activeTaskId: string | null): GuidedBundleProgress {
  if (tasks.length === 0) {
    return {
      current: 0,
      total: 0,
      remaining: 0,
    };
  }

  const bundleOrder = Array.from(new Set(tasks.map((task) => getTaskBundleKey(task))));
  const activeTask =
    tasks.find((task) => task.id === activeTaskId && task.status !== 'completed') ??
    tasks.find((task) => task.status !== 'completed') ??
    null;

  if (!activeTask) {
    return {
      current: bundleOrder.length,
      total: bundleOrder.length,
      remaining: 0,
    };
  }

  const currentIndex = bundleOrder.indexOf(getTaskBundleKey(activeTask));
  const remaining = new Set(
    tasks.filter((task) => task.status !== 'completed').map((task) => getTaskBundleKey(task)),
  ).size;

  return {
    current: currentIndex + 1,
    total: bundleOrder.length,
    remaining,
  };
}
