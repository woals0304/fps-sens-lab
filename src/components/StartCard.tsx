import { buildQuickStartSettings } from '../lib/utils/guidedFlow';
import { MAX_ALLOWED_SENSITIVITY, MIN_ALLOWED_SENSITIVITY } from '../lib/constants/appConstants';
import { useId, useRef, useState } from 'react';
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

  const id = useId();
  const [dpiText, setDpiText] = useState(String(draft.dpi));
  const [sensText, setSensText] = useState(formatSensitivity(draft.currentSensitivity));
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ dpi: false, sensitivity: false });
  const dpiInput = useRef<HTMLInputElement>(null);
  const sensInput = useRef<HTMLInputElement>(null);
  const dpiValid = /^\d+$/.test(dpiText) && Number(dpiText) >= 100 && Number(dpiText) <= 32000;
  const sensValid = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(sensText) &&
    Number(sensText) >= MIN_ALLOWED_SENSITIVITY && Number(sensText) <= MAX_ALLOWED_SENSITIVITY;
  const dpiError = !dpiValid && (submitted || touched.dpi);
  const sensError = !sensValid && (submitted || touched.sensitivity);

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

      <form className="diagnostic-console" aria-label="감도 테스트 시작" noValidate onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!dpiValid || !sensValid) {
          (!dpiValid ? dpiInput : sensInput).current?.focus();
          return;
        }
        onStart();
      }}>
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
              ref={dpiInput}
              type="text"
              inputMode="numeric"
              required
              aria-describedby={`${id}-dpi-hint${dpiError ? ` ${id}-dpi-error` : ''}`}
              aria-invalid={dpiError}
              value={dpiText}
              onBlur={() => setTouched((value) => ({ ...value, dpi: true }))}
              onChange={(event) => {
                const value = event.target.value;
                setDpiText(value);
                if (/^\d+$/.test(value)) onDraftChange({ ...draft, dpi: Number(value) });
              }}
            />
            <small id={`${id}-dpi-hint`}>마우스 설정 프로그램에서 확인 · 100~32,000</small>
            {dpiError && <small id={`${id}-dpi-error`} role="alert">DPI를 100~32,000 사이의 정수로 입력해 주세요.</small>}
          </label>

          <label className="field input-tile">
            <span>오버워치 감도</span>
            <input
              ref={sensInput}
              type="text"
              inputMode="decimal"
              required
              aria-describedby={`${id}-sens-hint${sensError ? ` ${id}-sens-error` : ''}`}
              aria-invalid={sensError}
              value={sensText}
              onBlur={() => setTouched((value) => ({ ...value, sensitivity: true }))}
              onChange={(event) => {
                const value = event.target.value;
                setSensText(value);
                if (value.trim() && Number.isFinite(Number(value))) {
                  onDraftChange({ ...draft, currentSensitivity: normalizeSensitivity(Number(value)) });
                }
              }}
            />
            <small id={`${id}-sens-hint`}>게임에서 사용하는 기본 감도 · {MIN_ALLOWED_SENSITIVITY}~{MAX_ALLOWED_SENSITIVITY}</small>
            {sensError && <small id={`${id}-sens-error`} role="alert">감도를 {MIN_ALLOWED_SENSITIVITY}~{MAX_ALLOWED_SENSITIVITY} 사이의 숫자로 입력해 주세요.</small>}
          </label>
        </div>

        <button
          type="submit"
          className="primary-button large-button hero-start-button"
        >
          테스트 시작
        </button>

        <div className="console-footer">
          <button type="button" className="text-button" onClick={onOpenSettings}>
            세부 설정
          </button>
          <span>마우스 가속을 끄고 진행하는 것을 권장합니다.</span>
        </div>

        {currentSession ? (
          <button type="button" className="resume-strip" onClick={onOpenResults}>
            <span>{latestSensitivity === null ? '진행 중인 테스트' : '최근 추천 감도'}</span>
            <strong>{latestSensitivity === null ? '기록 확인' : formatSensitivity(latestSensitivity)}</strong>
            <small>결과 열기</small>
          </button>
        ) : null}
      </form>
    </section>
  );
}
