import { formatSensitivity } from '../lib/utils/sensitivity';

interface GuidedStepCardProps {
  compact?: boolean;
  stepLabel: string;
  stepOrder: number;
  totalSteps: number;
  progressText: string;
  instruction: string;
  hint: string;
  currentSensitivity: number | null;
  compareAgainst?: number | null;
  remainingComparisons: number;
  estimatedTimeText: string;
  progressRatio: number;
  running: boolean;
  onStart: () => void | Promise<void>;
  onStop: () => void;
}

export function GuidedStepCard({
  compact = false,
  stepLabel,
  stepOrder,
  totalSteps,
  progressText,
  instruction,
  hint,
  currentSensitivity,
  compareAgainst = null,
  remainingComparisons,
  estimatedTimeText,
  progressRatio,
  running,
  onStart,
  onStop,
}: GuidedStepCardProps): JSX.Element {
  if (compact) {
    return (
      <article className="panel-card guided-step-card compact">
        <div className="guided-compact-header">
          <span className="step-chip">현재 단계 {stepOrder}/{totalSteps}</span>
          <span className="guided-compact-meta">
            예정 {remainingComparisons}회 · {estimatedTimeText}
          </span>
        </div>

        <h2>{stepLabel}</h2>
        <strong className="guided-compact-instruction">{instruction}</strong>

        {compareAgainst !== null ? (
          <p className="muted-text section-space-sm">
            비교 감도 {formatSensitivity(compareAgainst)}와 같은 방식으로 확인합니다.
          </p>
        ) : (
          <p className="muted-text section-space-sm">{hint}</p>
        )}

        <div className="guided-progress-bar compact-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(8, Math.min(progressRatio, 1) * 100)}%` }} />
        </div>

        <div className="guided-step-meta">
          <span>감도 {formatSensitivity(currentSensitivity)}</span>
          <span>{progressText}</span>
        </div>

        <div className="button-row section-space">
          <button
            type="button"
            className="primary-button"
            onClick={() => void onStart()}
            disabled={running}
          >
            {running ? '진행 중입니다' : '시험 시작'}
          </button>
          {running ? (
            <button type="button" className="text-button" onClick={onStop}>
              잠깐 멈추기
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="panel-card guided-step-card">
      <div className="step-chip">현재 단계 {stepOrder}/{totalSteps}</div>
      <h2>{stepLabel}</h2>
      <p className="muted-text">{progressText}</p>

      <div className="guided-progress-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(8, Math.min(progressRatio, 1) * 100)}%` }} />
      </div>

      <div className="guided-main-callout">
        <strong>{instruction}</strong>
        <p className="muted-text">{hint}</p>
      </div>

      <div className="pill-row">
        <span className="pill">현재 감도 {formatSensitivity(currentSensitivity)}</span>
        {compareAgainst !== null ? (
          <span className="pill">비교 감도 {formatSensitivity(compareAgainst)}</span>
        ) : null}
        <span className="pill">예정된 비교 {remainingComparisons}회</span>
        <span className="pill">예상 남은 시간 {estimatedTimeText}</span>
      </div>

      <div className="button-row section-space">
        <button
          type="button"
          className="primary-button large-button"
          onClick={() => void onStart()}
          disabled={running}
        >
          {running ? '지금 진행 중입니다' : '시험 시작'}
        </button>
        {running ? (
          <button type="button" className="text-button" onClick={onStop}>
            잠깐 멈추기
          </button>
        ) : null}
      </div>
    </article>
  );
}
