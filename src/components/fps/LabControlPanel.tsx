import { getExperimentStageLabel, getProtocolVariantLabel } from '../../lib/utils/uiText';
import {
  calculateCm360,
  calculateOverwatchCm360,
  calculateRotationDifferencePercent,
} from '../../lib/utils/rotationScale';
import { formatSensitivity } from '../../lib/utils/sensitivity';
import type { ExperimentTask, StoredSession } from '../../types/models';

interface LabControlPanelProps {
  session: StoredSession;
  activeTask: ExperimentTask | null;
  selectedSensitivity: number;
  running: boolean;
  continuousRun: boolean;
  resumeNeeded: boolean;
  resumeReason?: string;
  onStart: () => void | Promise<void>;
  onStop: () => void;
  onCalibrationChange: (value: number) => void;
}

export function LabControlPanel({
  session,
  activeTask,
  selectedSensitivity,
  running,
  continuousRun,
  resumeNeeded,
  resumeReason = '',
  onStart,
  onStop,
  onCalibrationChange,
}: LabControlPanelProps): JSX.Element {
  const completedCount = session.experimentState.tasks.filter((task) => task.status === 'completed').length;
  const pendingCount = session.experimentState.tasks.filter((task) => task.status === 'pending').length;
  const overwatchCm360 = calculateOverwatchCm360(session.settings.dpi, selectedSensitivity);
  const projectCm360 = calculateCm360(
    session.settings.dpi,
    selectedSensitivity,
    session.experimentState.calibrationMultiplier,
  );
  const rotationDifferencePercent = calculateRotationDifferencePercent(overwatchCm360, projectCm360);
  const calibrationLocked = running || session.labRuns.length > 0;

  const startButtonLabel = resumeNeeded
    ? '같은 단계 다시 시작'
    : continuousRun
      ? '다시 시작'
      : '계속 실행 시작';

  return (
    <article className="panel-card">
      <h3>자동 시험 진행기</h3>
      <p className="muted-text">
        현재 단계: {getExperimentStageLabel(session.experimentState.stage)} / 완료 {completedCount}개 / 남은 작업{' '}
        {pendingCount}개 / 감도 요약 {session.labSummaries.length}개
      </p>

      {activeTask ? (
        <div className="lab-task-box">
          <strong>{activeTask.title}</strong>
          <p className="muted-text">{activeTask.description}</p>
          <p className="muted-text">
            현재 감도 {formatSensitivity(activeTask.sensitivity)}
            {activeTask.compareAgainst !== null
              ? ` / 비교 상대 ${formatSensitivity(activeTask.compareAgainst)}`
              : ''}
          </p>
          <p className="muted-text">적용 규약: {getProtocolVariantLabel(activeTask.protocolVariant)}</p>
        </div>
      ) : (
        <div className="lab-task-box">
          <strong>현재 자동 작업이 없습니다.</strong>
          <p className="muted-text">
            시험이 끝났거나 아직 시작하지 않았습니다. 아래 결과 카드에서 자동 측정 결과를 확인할 수 있습니다.
          </p>
        </div>
      )}

      <div className="form-grid">
        <label className="field">
          <span>입력 보정 배율</span>
          <input
            type="range"
            min="0.6"
            max="1.6"
            step="0.05"
            value={session.experimentState.calibrationMultiplier}
            onChange={(event) => onCalibrationChange(Number(event.target.value))}
            aria-describedby="calibration-lock-help"
            disabled={calibrationLocked}
          />
          <small id="calibration-lock-help" className="muted-text">
            {session.labRuns.length > 0
              ? '비교 조건을 같게 유지하기 위해 첫 측정 뒤에는 고정됩니다. 바꾸려면 새 진단을 시작해 주세요.'
              : '측정을 시작하면 이 값은 결과 비교를 위해 고정됩니다.'}
          </small>
        </label>

        <label className="field">
          <span>자동 적용 감도</span>
          <input
            type="number"
            step="0.01"
            value={formatSensitivity(selectedSensitivity)}
            aria-describedby="automatic-sensitivity-help"
            disabled
          />
          <small id="automatic-sensitivity-help" className="muted-text">
            시험 계획에 정해진 감도를 그대로 측정하고 기록합니다.
          </small>
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => void onStart()} disabled={!activeTask || running}>
          {startButtonLabel}
        </button>
        <button type="button" className="secondary-button" onClick={onStop} disabled={!running}>
          일시정지
        </button>
      </div>

      {resumeNeeded ? (
        <p className="muted-text section-space-sm">
          {resumeReason || '시험이 잠깐 멈췄습니다. 다시 시작을 누르면 같은 단계를 처음부터 측정합니다.'}
        </p>
      ) : null}

      <p className="muted-text section-space">
        시작 버튼을 한 번 누르면 현재 작업을 바로 시작합니다. 작업이 끝나면 다음 작업으로 자동으로 이어집니다.
        ESC를 누르면 일시정지됩니다.
      </p>

      <div className="lab-task-box section-space">
        <strong>고정 시험 규약</strong>
        <p className="muted-text">
          기본 시험: 순간 조준 {session.testProtocol.standard.flickTargetCount}개 / 추적 조준{' '}
          {Math.round(session.testProtocol.standard.trackingDurationMs / 1000)}초 / 회전 반응{' '}
          {session.testProtocol.standard.turnInstructions.length}회
        </p>
        <p className="muted-text">
          최종 검증: 순간 조준 {session.testProtocol.validation.flickTargetCount}개 / 추적 조준{' '}
          {Math.round(session.testProtocol.validation.trackingDurationMs / 1000)}초 / 회전 반응{' '}
          {session.testProtocol.validation.turnInstructions.length}회
        </p>
        <p className="muted-text">
          회전 거리 확인: 오버워치 {overwatchCm360.toFixed(2)}cm / 360도, 현재 시험실{' '}
          {projectCm360.toFixed(2)}cm / 360도, 차이 {rotationDifferencePercent.toFixed(1)}%
        </p>
      </div>

      <div className="pill-row section-space">
        <span className="pill">추천 감도 {formatSensitivity(session.recommendation.bestSensitivity)}</span>
        <span className="pill">현재 감도 {formatSensitivity(session.settings.currentSensitivity)}</span>
        <span className="pill">
          검증 {session.validationResult ? (session.validationResult.passed ? '통과' : '조정됨') : '대기'}
        </span>
        <span className="pill">{running ? '현재 측정 중' : '현재 대기 중'}</span>
      </div>
    </article>
  );
}
