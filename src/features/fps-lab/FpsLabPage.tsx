import { useEffect, useMemo, useRef, useState } from 'react';
import { LabControlPanel } from '../../components/fps/LabControlPanel';
import { FpsTestCanvas, type FpsTestCanvasHandle } from '../../components/fps/FpsTestCanvas';
import { LabResultCards } from '../../components/fps/LabResultCards';
import { LAB_SECTIONS } from '../../lib/constants/appConstants';
import { getActiveExperimentTask } from '../../lib/experiment/experimentController';
import { getEffectiveFov } from '../../lib/utils/fov';
import type {
  ExperimentTask,
  LabMetrics,
  LabMode,
  LabRunQuality,
  LabSection,
  StoredSession,
} from '../../types/models';

interface FpsLabPageProps {
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
}

function getSectionMode(section: LabSection): LabMode | null {
  if (section === 'flick' || section === 'tracking' || section === 'turn') {
    return section;
  }

  return null;
}

export function FpsLabPage({
  session,
  onRecordLabTask,
  onUpdateLabPreferences,
}: FpsLabPageProps): JSX.Element {
  const canvasRef = useRef<FpsTestCanvasHandle | null>(null);
  const [selectedSection, setSelectedSection] = useState<LabSection>('setup');
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [continuousRun, setContinuousRun] = useState(false);
  const [resumeNeeded, setResumeNeeded] = useState(false);
  const [resumeReason, setResumeReason] = useState('');

  const activeTask = useMemo<ExperimentTask | null>(
    () => (session ? getActiveExperimentTask(session.experimentState) : null),
    [session],
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!activeTask) {
      setSelectedSection('results');
      setRunningTaskId(null);
      setContinuousRun(false);
      setResumeNeeded(false);
      setResumeReason('');
      return;
    }

    if (continuousRun && runningTaskId === null) {
      setSelectedSection(activeTask.section);
      setRunningTaskId(activeTask.id);
      return;
    }

    setSelectedSection(session.experimentState.lastLabSection);
  }, [activeTask, continuousRun, runningTaskId, session]);

  if (!session) {
    return (
      <section className="page-section">
        <div className="panel-card">
          <h2>조준 실험실</h2>
          <p className="muted-text">먼저 세션을 시작해야 FPS 실험을 돌릴 수 있습니다.</p>
        </div>
      </section>
    );
  }

  const selectedSensitivity =
    activeTask?.sensitivity ??
    session.recommendation.finalSensitivity ??
    session.recommendation.bestSensitivity ??
    session.settings.currentSensitivity;
  const effectiveFov = getEffectiveFov(session.settings);

  function switchSection(section: LabSection): void {
    setSelectedSection(section);
    onUpdateLabPreferences({
      lastLabSection: section,
      lastResumeTab: 'settings',
    });
  }

  async function handleStart(): Promise<void> {
    if (!activeTask) {
      return;
    }

    switchSection(activeTask.section);
    const locked = await canvasRef.current?.requestPointerLock();

    if (!locked) {
      setContinuousRun(false);
      setRunningTaskId(null);
      setResumeNeeded(true);
      setResumeReason('시점 고정 연결에 실패해 측정을 시작하지 않았습니다. 같은 단계를 다시 시작해 주세요.');
      return;
    }

    setResumeNeeded(false);
    setResumeReason('');
    setContinuousRun(true);
    setRunningTaskId(activeTask.id);
  }

  function handleStop(): void {
    setContinuousRun(false);
    setRunningTaskId(null);
    setResumeNeeded(false);
    setResumeReason('');
  }

  function handleTaskComplete(taskId: string, metrics: LabMetrics, quality: LabRunQuality): void {
    if (!onRecordLabTask(taskId, metrics, quality)) {
      handleMeasurementInterrupted(
        '측정은 끝났지만 브라우저 저장소에 기록하지 못했습니다. 저장 공간과 비공개 모드 설정을 확인한 뒤 같은 단계를 다시 시작해 주세요.',
      );
      return;
    }

    setRunningTaskId(null);
    setResumeNeeded(false);
    setResumeReason('');
  }

  function handleMeasurementInterrupted(reason: string): void {
    setContinuousRun(false);
    setRunningTaskId(null);
    setResumeNeeded(true);
    setResumeReason(reason);
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">조준 실험실</p>
          <h2>브라우저 안에서 순간 조준, 추적 조준, 회전 반응을 연속 측정합니다.</h2>
        </div>
      </div>

      <div className="pill-row">
        {LAB_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={selectedSection === section.id ? 'tab-button active compact-tab' : 'tab-button compact-tab'}
            onClick={() => switchSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="two-column fps-layout">
        <div className="fps-left-column">
          <LabControlPanel
            session={session}
            activeTask={activeTask}
            selectedSensitivity={selectedSensitivity}
            running={runningTaskId !== null}
            continuousRun={continuousRun}
            resumeNeeded={resumeNeeded}
            resumeReason={resumeReason}
            onStart={handleStart}
            onStop={handleStop}
            onCalibrationChange={(value) =>
              onUpdateLabPreferences({
                calibrationMultiplier: value,
              })
            }
          />

          <LabResultCards session={session} selectedSensitivity={selectedSensitivity} />
        </div>

        <div className="fps-right-column">
          <article className="panel-card">
            <h3>실험 화면</h3>
            <p className="muted-text">
              시작 버튼을 누르면 시점 고정이 함께 켜집니다. ESC로 중단한 뒤 다시 시작하면 같은 작업을 처음부터 다시 측정합니다.
            </p>

            <FpsTestCanvas
              ref={canvasRef}
              task={runningTaskId ? activeTask : null}
              selectedMode={getSectionMode(selectedSection)}
              sensitivity={selectedSensitivity}
              fieldOfView={effectiveFov}
              calibrationMultiplier={session.experimentState.calibrationMultiplier}
              testProtocol={session.testProtocol}
              running={runningTaskId !== null}
              onComplete={handleTaskComplete}
              onPointerLockLost={handleMeasurementInterrupted}
              onMeasurementInvalidated={handleMeasurementInterrupted}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
