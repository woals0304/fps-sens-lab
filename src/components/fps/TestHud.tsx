import { formatSensitivity } from '../../lib/utils/sensitivity';

interface TestHudProps {
  sensitivity: number;
  calibrationMultiplier: number;
  modeLabel: string;
  stageLabel: string;
  pointerLocked: boolean;
  rawInput: boolean;
  running: boolean;
  progressLabel: string;
  statusText: string;
  remainingLabel?: string;
  etaLabel?: string;
  minimal?: boolean;
}

export function TestHud({
  sensitivity,
  calibrationMultiplier,
  modeLabel,
  stageLabel,
  pointerLocked,
  rawInput,
  running,
  progressLabel,
  statusText,
  remainingLabel = '',
  etaLabel = '',
  minimal = false,
}: TestHudProps): JSX.Element {
  if (minimal) {
    return (
      <div className="fps-hud minimal">
        {running ? (
          <>
            <div className="fps-hud-row minimal-strip">
              <span className="pill hud-sensitivity">감도 {formatSensitivity(sensitivity)}</span>
              <span className="pill hud-live-progress">
                {modeLabel} · {progressLabel}
              </span>
              <span className="pill hud-optional">{etaLabel}</span>
            </div>
            <p className={pointerLocked ? 'fps-live-instruction' : 'fps-status-text minimal'}>
              {statusText}
            </p>
          </>
        ) : null}

        <div className="fps-crosshair" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="fps-hud">
      <div className="fps-hud-row">
        <span className="pill">감도 {formatSensitivity(sensitivity)}</span>
        <span className="pill">보정 x{calibrationMultiplier.toFixed(2)}</span>
        <span className="pill">{modeLabel}</span>
        <span className="pill">{stageLabel}</span>
      </div>

      <div className="fps-hud-row">
        <span className={pointerLocked ? 'pill success' : 'pill'}>
          {pointerLocked ? '포인터 잠금 유지' : '포인터 잠금 해제'}
        </span>
        <span className={rawInput ? 'pill success' : 'pill'}>
          {rawInput ? '원시 입력 사용' : '일반 입력 사용'}
        </span>
        <span className={running ? 'pill success' : 'pill'}>
          {running ? '측정 진행 중' : '대기 중'}
        </span>
        <span className="pill">{remainingLabel || progressLabel}</span>
        <span className="pill hud-optional">{etaLabel}</span>
      </div>

      <p className="fps-status-text">{statusText}</p>
      <div className="fps-crosshair" aria-hidden="true">
        <span />
        <span />
      </div>
    </div>
  );
}
