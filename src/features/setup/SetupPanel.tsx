import { useMemo } from 'react';
import { toNumber } from '../../lib/utils/numberUtils';
import {
  clampFov,
  getDefaultOverwatchFov,
  getEffectiveFov,
} from '../../lib/utils/fov';
import { formatSensitivity } from '../../lib/utils/sensitivity';
import {
  calculateCm180,
  calculateCm360,
  calculateOverwatchCm180,
  calculateOverwatchCm360,
  calculateRotationDifferencePercent,
} from '../../lib/utils/rotationScale';
import {
  buildAutoSensitivitySettings,
  buildInitialSensitivityCandidates,
} from '../../lib/utils/autoSensitivityRange';
import type { AppSettings, StoredSession } from '../../types/models';

interface SetupPanelProps {
  draft: AppSettings;
  currentSession: StoredSession | null;
  onDraftChange: (nextDraft: AppSettings) => void;
  onStartSession: (settings: AppSettings) => void;
}

export function SetupPanel({
  draft,
  currentSession,
  onDraftChange,
  onStartSession,
}: SetupPanelProps): JSX.Element {
  const autoSettings = useMemo(() => buildAutoSensitivitySettings(draft), [draft]);
  const candidates = useMemo(
    () => buildInitialSensitivityCandidates(autoSettings.currentSensitivity),
    [autoSettings.currentSensitivity],
  );
  const effectiveFov = getEffectiveFov(autoSettings);
  const calibrationMultiplier = currentSession?.experimentState.calibrationMultiplier ?? 1;
  const overwatchCm360 = useMemo(
    () => calculateOverwatchCm360(autoSettings.dpi, autoSettings.currentSensitivity),
    [autoSettings.currentSensitivity, autoSettings.dpi],
  );
  const overwatchCm180 = useMemo(
    () => calculateOverwatchCm180(autoSettings.dpi, autoSettings.currentSensitivity),
    [autoSettings.currentSensitivity, autoSettings.dpi],
  );
  const projectCm360 = useMemo(
    () => calculateCm360(autoSettings.dpi, autoSettings.currentSensitivity, calibrationMultiplier),
    [autoSettings.currentSensitivity, autoSettings.dpi, calibrationMultiplier],
  );
  const projectCm180 = useMemo(
    () => calculateCm180(autoSettings.dpi, autoSettings.currentSensitivity, calibrationMultiplier),
    [autoSettings.currentSensitivity, autoSettings.dpi, calibrationMultiplier],
  );
  const rotationDifferencePercent = useMemo(
    () => calculateRotationDifferencePercent(overwatchCm360, projectCm360),
    [overwatchCm360, projectCm360],
  );

  function updateField<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): void {
    onDraftChange({
      ...draft,
      [key]: value,
    });
  }

  function handleCustomFovToggle(enabled: boolean): void {
    const nextFov = enabled
      ? clampFov(draft.customFov ?? draft.effectiveFov ?? getDefaultOverwatchFov())
      : getDefaultOverwatchFov();

    onDraftChange({
      ...draft,
      useCustomFov: enabled,
      customFov: nextFov,
      effectiveFov: enabled ? nextFov : getDefaultOverwatchFov(),
    });
  }

  function handleCustomFovChange(rawValue: string): void {
    const nextFov = clampFov(toNumber(rawValue, draft.customFov ?? getDefaultOverwatchFov()));

    onDraftChange({
      ...draft,
      useCustomFov: true,
      customFov: nextFov,
      effectiveFov: nextFov,
    });
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <p className="muted-text">값을 바꾼 뒤 새 테스트를 시작하세요.</p>
        <button
          type="button"
          className="primary-button"
          disabled={autoSettings.dpi <= 0 || autoSettings.currentSensitivity <= 0}
          onClick={() => onStartSession(autoSettings)}
        >
          {currentSession ? '이 값으로 새 테스트 시작' : '새 테스트 시작'}
        </button>
      </div>

      <div className="two-column">
        <article className="panel-card">
          <h3>입력 정보</h3>
          <p className="muted-text">
            최소·최대 감도와 간격은 자동으로 정합니다. 현재 감도는 탐색 기준으로 사용합니다.
          </p>

          <div className="form-grid">
            <label className="field">
              <span>DPI</span>
              <input
                type="number"
                value={draft.dpi}
                onChange={(event) => updateField('dpi', toNumber(event.target.value, draft.dpi))}
              />
            </label>

            <label className="field">
              <span>현재 게임 감도</span>
              <input
                type="number"
                step="0.01"
                value={formatSensitivity(draft.currentSensitivity)}
                onChange={(event) =>
                  updateField(
                    'currentSensitivity',
                    toNumber(event.target.value, draft.currentSensitivity),
                  )
                }
              />
            </label>
          </div>

          <div className="detail-box section-space">
            <h3>시야각 설정</h3>
            <p className="muted-text">
              기본 가로 시야각은 오버워치 기준 103입니다. 다른 값을 쓰는 경우에만 변경하세요.
            </p>

            <label className="inline-check section-space-sm">
              <input
                type="checkbox"
                checked={draft.useCustomFov}
                onChange={(event) => handleCustomFovToggle(event.target.checked)}
              />
              <span>사용자 지정 시야각 사용</span>
            </label>

            {draft.useCustomFov ? (
              <label className="field section-space-sm">
                <span>시야각</span>
                <input
                  type="number"
                  min="80"
                  max="103"
                  step="1"
                  value={draft.customFov ?? getDefaultOverwatchFov()}
                  onChange={(event) => handleCustomFovChange(event.target.value)}
                />
              </label>
            ) : null}

            <p className="muted-text section-space-sm">
              현재 적용 시야각 {effectiveFov}
              {draft.useCustomFov ? ' (사용자 지정)' : ' (오버워치 기준값)'}
            </p>
          </div>
          <div className="detail-box section-space">
            <h3>회전 거리 확인</h3>
            <p className="muted-text">
              시야각은 화면에 보이는 범위만 바꿉니다. 한 바퀴를 도는 마우스 거리는 회전 배율로 결정됩니다.
            </p>

            <div className="history-list section-space-sm">
              <div className="history-row">
                <strong>오버워치 기준</strong>
                <span>{overwatchCm360.toFixed(2)}cm / 360도, {overwatchCm180.toFixed(2)}cm / 180도</span>
              </div>
              <div className="history-row">
                <strong>이 테스트 기준</strong>
                <span>{projectCm360.toFixed(2)}cm / 360도, {projectCm180.toFixed(2)}cm / 180도</span>
              </div>
              <div className="history-row">
                <strong>차이</strong>
                <span>{rotationDifferencePercent.toFixed(1)}%</span>
              </div>
            </div>

            <p className="muted-text section-space-sm">
              입력 보정 1.00과 원시 입력 사용 시 오버워치와 같은 회전 거리를 적용합니다.
            </p>
          </div>
        </article>

        <article className="panel-card">
          <h3>자동 계산 결과</h3>
          <p className="muted-text">
            현재 감도 주변부터 테스트하고, 결과가 좋은 쪽으로 범위를 옮깁니다.
          </p>

          <div className="pill-row">
            <span className="pill">
              자동 범위 {formatSensitivity(autoSettings.minSensitivity)} ~{' '}
              {formatSensitivity(autoSettings.maxSensitivity)}
            </span>
            <span className="pill">기본 간격 {formatSensitivity(autoSettings.step)}</span>
            <span className="pill">기본 시야각 {effectiveFov}</span>
          </div>

          <div className="candidate-preview">
            {candidates.map((candidate) => (
              <span key={candidate} className="candidate-badge">
                {formatSensitivity(candidate)}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
