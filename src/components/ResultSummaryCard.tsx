import { useState } from 'react';
import { formatSensitivity } from '../lib/utils/sensitivity';
import type { StoredSession } from '../types/models';

interface ResultSummaryCardProps {
  session: StoredSession;
  detailOpen: boolean;
  onRetry: () => void;
  onToggleDetails: () => void;
}

export function ResultSummaryCard({
  session,
  detailOpen,
  onRetry,
  onToggleDetails,
}: ResultSummaryCardProps): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const currentSensitivity = session.settings.currentSensitivity;
  const finalSensitivity =
    session.recommendation.finalSensitivity ??
    session.recommendation.bestSensitivity ??
    currentSensitivity;
  const differencePercent =
    currentSensitivity > 0 ? ((finalSensitivity - currentSensitivity) / currentSensitivity) * 100 : 0;
  const comparisonLine =
    Math.abs(differencePercent) < 0.05
      ? `입력한 감도 ${formatSensitivity(currentSensitivity)}와 같은 값을 추천합니다.`
      : `입력한 감도 ${formatSensitivity(currentSensitivity)}보다 ${Math.abs(differencePercent).toFixed(1)}% ${differencePercent < 0 ? '낮은' : '높은'} ${formatSensitivity(finalSensitivity)}을 추천합니다.`;
  const confirmationLine =
    session.recommendation.validationPassed === null
      ? session.validationResult
        ? session.validationResult.decisionReason[0] ?? '최종 확인 근거가 부족해 판단을 보류했습니다.'
        : session.recommendation.safeRange
        ? `${formatSensitivity(session.recommendation.safeRange.min)}~${formatSensitivity(session.recommendation.safeRange.max)} 구간을 함께 확인했습니다.`
        : '안정 범위는 근거가 더 필요해 이번 결과에서 확정하지 않았습니다.'
      : session.recommendation.validationPassed
        ? `최종 확인에서도 ${formatSensitivity(finalSensitivity)}이 유지됐습니다.`
        : `최종 확인 결과를 반영해 추천값을 ${formatSensitivity(finalSensitivity)}으로 조정했습니다.`;
  const explanationLines = [comparisonLine, confirmationLine];

  async function copySensitivity(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('clipboard-unavailable');
      }

      await navigator.clipboard.writeText(formatSensitivity(finalSensitivity));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <article className="panel-card result-summary-card">
      <div className="result-summary-heading">
        <div>
          <p className="eyebrow">테스트 결과</p>
          <h2>추천 감도</h2>
        </div>
        <strong className="result-sensitivity">{formatSensitivity(finalSensitivity)}</strong>
      </div>
      <p className="result-range-text">
        {session.recommendation.safeRange
          ? `안정 범위: ${formatSensitivity(session.recommendation.safeRange.min)} ~ ${formatSensitivity(session.recommendation.safeRange.max)}`
          : '안정 범위는 이번 측정에서 확정하지 못했습니다.'}
      </p>

      <div className="bullet-list">
        {explanationLines.map((line) => (
          <p key={line}>- {line}</p>
        ))}
      </div>

      <div className="result-summary-meta section-space">
        <span>최종 확인</span>
        <strong>
          {session.recommendation.validationPassed === null
            ? session.validationResult
              ? '판단 보류'
              : '대기'
            : session.recommendation.validationPassed
              ? '통과'
              : '조정됨'}
        </strong>
        <p>세부 점수와 후보별 비교 기록은 아래에서 확인할 수 있습니다.</p>
      </div>

      <div className="button-row section-space">
        <button type="button" className="primary-button large-button" onClick={copySensitivity}>
          {copyStatus === 'copied'
            ? '복사했습니다'
            : `감도 ${formatSensitivity(finalSensitivity)} 복사`}
        </button>
        <button type="button" className="secondary-button" onClick={onToggleDetails}>
          {detailOpen ? '세부 결과 숨기기' : '세부 결과 보기'}
        </button>
        <button type="button" className="text-button" onClick={onRetry}>
          다시 측정
        </button>
      </div>
      <p className="muted-text" role="status">
        {copyStatus === 'copied'
          ? '복사한 값을 오버워치의 마우스 감도에 붙여 넣으세요.'
          : copyStatus === 'failed'
            ? '자동 복사가 막혔습니다. 위 추천값을 오버워치에 직접 입력해 주세요.'
            : '복사한 뒤 오버워치 설정의 마우스 감도에 붙여 넣으면 됩니다.'}
      </p>
    </article>
  );
}
