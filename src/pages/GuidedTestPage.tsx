import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { GuidedStepCard } from '../components/GuidedStepCard';
import { FpsTestCanvas, type FpsTestCanvasHandle } from '../components/fps/FpsTestCanvas';
import { getActiveExperimentTask } from '../lib/experiment/experimentController';
import {
  estimateRemainingTime,
  getGuidedBundleProgress,
  getGuidedInstruction,
  getGuidedModeHint,
  getGuidedStageInfo,
  getGuidedTransitionMessage,
  getRemainingComparisonCount,
} from '../lib/utils/guidedFlow';
import { getEffectiveFov } from '../lib/utils/fov';
import { formatSensitivity } from '../lib/utils/sensitivity';
import type { ExperimentTask, LabMetrics, LabRunQuality, StoredSession } from '../types/models';

interface GuidedTestPageProps {
  session: StoredSession | null;
  onRecordLabTask: (taskId: string, metrics: LabMetrics, quality?: LabRunQuality) => boolean;
  onUpdateLabPreferences: (
    patch: Partial<
      Pick<
        StoredSession['experimentState'],
        'calibrationMultiplier' | 'manualSensitivityOverride' | 'lastLabSection' | 'lastResumeTab'
      >
    >,
  ) => void;
  onOpenResults: () => void;
  onExit: () => void;
}

export function GuidedTestPage({
  session,
  onRecordLabTask,
  onUpdateLabPreferences,
  onOpenResults,
  onExit,
}: GuidedTestPageProps): JSX.Element {
  const canvasRef = useRef<FpsTestCanvasHandle | null>(null);
  const resumePanelRef = useRef<HTMLDivElement | null>(null);
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [continuousRun, setContinuousRun] = useState(false);
  const [resumeNeeded, setResumeNeeded] = useState(false);
  const [completedTask, setCompletedTask] = useState<ExperimentTask | null>(null);
  const [restartReason, setRestartReason] = useState(
    '시험 진행이 끊겨 현재 측정을 저장하지 않았습니다. 같은 단계를 처음부터 다시 측정해 주세요.',
  );

  const activeTask = useMemo<ExperimentTask | null>(
    () => (session ? getActiveExperimentTask(session.experimentState) : null),
    [session],
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!activeTask) {
      setRunningTaskId(null);
      setContinuousRun(false);
      setResumeNeeded(false);
      setCompletedTask(null);
      return;
    }

    if (continuousRun && runningTaskId === null && !resumeNeeded && !completedTask) {
      setRunningTaskId(activeTask.id);
    }
  }, [activeTask, completedTask, continuousRun, resumeNeeded, runningTaskId, session]);

  useEffect(() => {
    if (
      !continuousRun ||
      resumeNeeded ||
      runningTaskId !== null ||
      !completedTask ||
      !activeTask ||
      activeTask.id === completedTask.id
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (!canvasRef.current?.isPointerLocked()) {
        requireTaskRestart(
          '다음 측정을 시작하기 전에 시점 고정이 풀렸습니다. 같은 단계를 다시 시작해 주세요.',
        );
        return;
      }

      setCompletedTask(null);
      setRunningTaskId(activeTask.id);
    }, 800);

    return () => window.clearTimeout(timerId);
  }, [activeTask, completedTask, continuousRun, resumeNeeded, runningTaskId]);

  useEffect(() => {
    if (!resumeNeeded) {
      return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => resumeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frameId);

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [resumeNeeded]);

  if (!session) {
    return (
      <section className="page-section simple-page">
        <article className="panel-card">
          <h2>아직 시작 전입니다.</h2>
          <p className="muted-text">
            먼저 감도 찾기 화면에서 기본 정보만 넣고 바로 시작하기를 눌러 주세요.
          </p>
        </article>
      </section>
    );
  }

  if (!activeTask || session.experimentState.stage === 'result') {
    return (
      <section className="page-section simple-page">
        <article className="panel-card finished-box">
          <h2>추천 감도를 정리했습니다.</h2>
          <p className="muted-text">
            추천 감도는{' '}
            {formatSensitivity(
              session.recommendation.finalSensitivity ?? session.recommendation.bestSensitivity,
            )}
            입니다. 아래 버튼을 누르면 바로 결과를 볼 수 있습니다.
          </p>
          <button type="button" className="primary-button large-button" onClick={onOpenResults}>
            결과 보기
          </button>
        </article>
      </section>
    );
  }

  const currentTask = activeTask;
  const selectedSensitivity =
    currentTask.sensitivity ??
    session.experimentState.manualSensitivityOverride ??
    session.recommendation.finalSensitivity ??
    session.recommendation.bestSensitivity ??
    session.settings.currentSensitivity;
  const stageInfo = getGuidedStageInfo(session.experimentState.stage);
  const progress = getGuidedBundleProgress(session.experimentState.tasks, currentTask.id);
  const remainingComparisons = getRemainingComparisonCount(
    session.experimentState.tasks,
    currentTask.id,
    session.testProtocol,
  );
  const estimatedTimeText = estimateRemainingTime(
    session.experimentState.tasks,
    currentTask.id,
    session.testProtocol,
  );
  const progressRatio = progress.total > 0 ? progress.current / progress.total : 0;
  const effectiveFov = getEffectiveFov(session.settings);
  const showPreStartCard = !continuousRun && !resumeNeeded;
  const transitionMessage =
    completedTask && activeTask && completedTask.id !== activeTask.id
      ? getGuidedTransitionMessage(completedTask, activeTask)
      : '';
  const progressText =
    progress.total > 0
      ? `현재 단계 ${progress.current}/${progress.total} · 예정된 비교는 ${remainingComparisons}회 남았습니다.`
      : '다음 안내를 준비하고 있습니다.';

  function requireTaskRestart(reason: string): void {
    setContinuousRun(false);
    setRunningTaskId(null);
    setResumeNeeded(true);
    setCompletedTask(null);
    setRestartReason(reason);
  }

  async function handleStart(): Promise<void> {
    onUpdateLabPreferences({
      lastLabSection: currentTask.section,
      lastResumeTab: 'finder',
      manualSensitivityOverride: selectedSensitivity,
    });

    let locked = false;

    try {
      locked = (await canvasRef.current?.requestPointerLock()) ?? false;
    } catch {
      locked = false;
    }

    if (!locked) {
      requireTaskRestart(
        '시점 고정 연결에 실패해 측정을 시작하지 않았습니다. 같은 단계를 다시 시작해 주세요.',
      );
      return;
    }

    setResumeNeeded(false);
    setCompletedTask(null);
    setContinuousRun(true);
    setRunningTaskId(currentTask.id);
  }

  function handleStop(): void {
    setContinuousRun(false);
    setRunningTaskId(null);
    setResumeNeeded(false);
    setCompletedTask(null);
  }

  function handleTaskComplete(taskId: string, metrics: LabMetrics, quality: LabRunQuality): void {
    const saved = onRecordLabTask(taskId, metrics, quality);

    if (!saved) {
      requireTaskRestart(
        '측정은 끝났지만 브라우저 저장소에 기록하지 못했습니다. 저장 공간과 비공개 모드 설정을 확인한 뒤 같은 단계를 다시 시작해 주세요.',
      );
      return;
    }

    setRunningTaskId(null);
    setResumeNeeded(false);
    setCompletedTask(currentTask);
  }

  function handlePointerLockLost(reason: string): void {
    requireTaskRestart(reason);
  }

  function handleResumeDialogKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Tab') {
      return;
    }

    const buttons = resumePanelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');

    if (!buttons || buttons.length === 0) {
      event.preventDefault();
      return;
    }

    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  }

  return (
    <section className="guided-immersive-page">
      <FpsTestCanvas
        ref={canvasRef}
        task={runningTaskId ? currentTask : null}
        selectedMode={currentTask.mode}
        stageLabelOverride={stageInfo.title}
        sensitivity={selectedSensitivity}
        fieldOfView={effectiveFov}
        calibrationMultiplier={session.experimentState.calibrationMultiplier}
        testProtocol={session.testProtocol}
        running={runningTaskId !== null}
        remainingLabel={`예정 ${remainingComparisons}회`}
        etaLabel={`예상 ${estimatedTimeText}`}
        onComplete={handleTaskComplete}
        onPointerLockLost={handlePointerLockLost}
        onMeasurementInvalidated={requireTaskRestart}
        immersive
        minimalHud
      />

      {!resumeNeeded ? (
        <div className="guided-immersive-top">
          <button type="button" className="secondary-button overlay-exit-button" onClick={onExit}>
            시험 나가기
          </button>
        </div>
      ) : null}

      {resumeNeeded ? (
        <div className="guided-resume-overlay">
          <div
            ref={resumePanelRef}
            className="guided-resume-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-restart-title"
            aria-describedby="guided-restart-description"
            onKeyDown={handleResumeDialogKeyDown}
          >
            <h2 id="guided-restart-title">시험이 중단됐습니다.</h2>
            <p id="guided-restart-description" className="muted-text">
              {restartReason}
            </p>
            <div className="button-row guided-resume-actions">
              <button
                ref={resumeButtonRef}
                type="button"
                className="primary-button large-button"
                onClick={() => void handleStart()}
              >
                현재 단계 다시 시작
              </button>
              <button type="button" className="secondary-button large-button" onClick={onExit}>
                시험 나가기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={transitionMessage ? 'guided-transition-overlay visible' : 'guided-transition-overlay'}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {transitionMessage}
      </div>

      {showPreStartCard ? (
        <div className="guided-immersive-bottom">
          <GuidedStepCard
            compact
            stepLabel={stageInfo.title}
            stepOrder={stageInfo.stepNumber}
            totalSteps={stageInfo.totalSteps}
            progressText={progressText}
            instruction={getGuidedInstruction(currentTask)}
            hint={getGuidedModeHint(currentTask)}
            currentSensitivity={selectedSensitivity}
            compareAgainst={currentTask.compareAgainst}
            remainingComparisons={remainingComparisons}
            estimatedTimeText={estimatedTimeText}
            progressRatio={progressRatio}
            running={runningTaskId !== null}
            onStart={handleStart}
            onStop={handleStop}
          />
        </div>
      ) : null}
    </section>
  );
}
