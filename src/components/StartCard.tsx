import { buildQuickStartSettings } from '../lib/utils/guidedFlow';
import { MAX_ALLOWED_SENSITIVITY, MIN_ALLOWED_SENSITIVITY } from '../lib/constants/appConstants';
import { toNumber } from '../lib/utils/numberUtils';
import { formatSensitivity, normalizeSensitivity } from '../lib/utils/sensitivity';
import type { AppSettings, StoredSession } from '../types/models';

interface StartCardProps {
  draft: AppSettings;
  currentSession: StoredSession | null;
  onDraftChange: (nextDraft: AppSettings) => void;
  onStart: () => void;
  onOpenSettings: () => void;
  onOpenResults: () => void;
}

function isValidDraft(draft: AppSettings): boolean {
  return (
    draft.dpi >= 100 &&
    draft.dpi <= 32000 &&
    draft.currentSensitivity >= MIN_ALLOWED_SENSITIVITY &&
    draft.currentSensitivity <= MAX_ALLOWED_SENSITIVITY
  );
}

export function StartCard({
  draft,
  currentSession,
  onDraftChange,
  onStart,
  onOpenSettings,
  onOpenResults,
}: StartCardProps): JSX.Element {
  const quickSettings = buildQuickStartSettings(draft);
  const latestSensitivity =
    currentSession?.recommendation.finalSensitivity ?? currentSession?.recommendation.bestSensitivity ?? null;

  function updateField<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): void {
    const normalizedValue =
      typeof value === 'number' && key !== 'dpi' ? normalizeSensitivity(value) : value;

    onDraftChange({
      ...draft,
      [key]: normalizedValue,
    });
  }

  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-copy">
        <p className="hero-kicker">오버워치 2 기준</p>
        <h1 id="home-title">내 마우스 감도 찾기</h1>
        <p className="hero-lead">
          현재 DPI와 게임 감도를 입력하고 세 가지 조준 테스트를 진행합니다.
          <br /> 결과는 오버워치 회전값을 기준으로 계산합니다.
        </p>
        <p className="home-meta" aria-label="진단 방식 요약">
          보통 2~4분 <span aria-hidden="true">·</span> 설치 없음{' '}
          <span aria-hidden="true">·</span> 결과는 이 브라우저에 저장
        </p>
      </div>

      <div className="diagnostic-console" aria-label="감도 테스트 시작">
        <div className="console-header">
          <div>
            <span>빠른 진단</span>
            <h2>현재 설정부터 시작</h2>
            <p>
              감도 {formatSensitivity(quickSettings.minSensitivity)}–
              {formatSensitivity(quickSettings.maxSensitivity)} 범위를 확인합니다.
            </p>
          </div>
        </div>

        <div className="home-input-grid">
          <label className="field input-tile">
            <span>마우스 DPI</span>
            <input
              type="number"
              min="100"
              max="32000"
              step="50"
              value={draft.dpi}
              onChange={(event) => updateField('dpi', toNumber(event.target.value, draft.dpi))}
            />
          </label>

          <label className="field input-tile">
            <span>오버워치 감도</span>
            <input
              type="number"
              min={MIN_ALLOWED_SENSITIVITY}
              max={MAX_ALLOWED_SENSITIVITY}
              step="0.01"
              value={formatSensitivity(draft.currentSensitivity)}
              onChange={(event) =>
                updateField('currentSensitivity', toNumber(event.target.value, draft.currentSensitivity))
              }
            />
          </label>
        </div>

        <button
          type="button"
          className="primary-button large-button hero-start-button"
          onClick={onStart}
          disabled={!isValidDraft(draft)}
        >
          테스트 시작
        </button>

        {!isValidDraft(draft) ? (
          <p className="inline-alert" role="alert">
            DPI는 100~32,000, 오버워치 감도는 {MIN_ALLOWED_SENSITIVITY}~{MAX_ALLOWED_SENSITIVITY} 사이로 입력해 주세요.
          </p>
        ) : null}

        <div className="console-footer">
          <button type="button" className="text-button" onClick={onOpenSettings}>
            세부 설정
          </button>
          <span>마우스 가속을 끄고 진행하는 것을 권장합니다.</span>
        </div>

        {currentSession ? (
          <button type="button" className="resume-strip" onClick={onOpenResults}>
            <span>최근 추천 감도</span>
            <strong>{formatSensitivity(latestSensitivity)}</strong>
            <small>결과 열기</small>
          </button>
        ) : null}
      </div>
    </section>
  );
}
