import { useState } from 'react';
import { calculateOverwatchCm360 } from '../lib/utils/rotationScale';
import { formatSensitivity } from '../lib/utils/sensitivity';
import type { SensitivityLabSummary, StoredSession } from '../types/models';

interface AppliedReportCardProps {
  session: StoredSession;
}

function getMeasuredSummary(session: StoredSession, sensitivity: number): SensitivityLabSummary | null {
  return (
    session.labSummaries.find((summary) => Math.abs(summary.sensitivity - sensitivity) < 0.001) ??
    null
  );
}

function formatCm360(value: number): string {
  return value > 0 ? `${value.toFixed(1)}cm` : '-';
}

export function AppliedReportCard({ session }: AppliedReportCardProps): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const currentSensitivity = session.settings.currentSensitivity;
  const finalSensitivity =
    session.recommendation.finalSensitivity ??
    session.recommendation.bestSensitivity ??
    currentSensitivity;
  const differencePercent =
    currentSensitivity > 0 ? ((finalSensitivity - currentSensitivity) / currentSensitivity) * 100 : 0;
  const currentCm360 = calculateOverwatchCm360(session.settings.dpi, currentSensitivity);
  const finalCm360 = calculateOverwatchCm360(session.settings.dpi, finalSensitivity);
  const bestSummary = getMeasuredSummary(session, finalSensitivity);
  const validationStatus =
    session.recommendation.validationPassed === true
      ? '최종 확인 완료'
      : session.recommendation.validationPassed === false
        ? '최종 확인에서 조정'
        : '최종 확인 보류';
  const changeText =
    Math.abs(differencePercent) < 0.05
      ? '현재 감도 유지'
      : `${Math.abs(differencePercent).toFixed(1)}% ${differencePercent < 0 ? '낮춤' : '높임'}`;
  const scoreText = bestSummary
    ? `순간 ${bestSummary.flickScore.toFixed(0)} · 추적 ${bestSummary.trackingScore.toFixed(0)} · 회전 ${bestSummary.turnScore.toFixed(0)}`
    : '아직 비교 점수가 충분하지 않음';
  const reportText = [
    'FPS Sens Lab 실전 적용 리포트',
    `추천 감도: ${formatSensitivity(finalSensitivity)}`,
    `DPI: ${session.settings.dpi}`,
    `360도 회전 거리: ${formatCm360(finalCm360)}`,
    `현재 감도 대비: ${changeText}`,
    `이번 측정의 판정: ${validationStatus}`,
    `측정 점수: ${scoreText}`,
    '',
    '적용 순서',
    `1. 오버워치 감도를 ${formatSensitivity(finalSensitivity)}으로 입력합니다.`,
    `2. DPI ${session.settings.dpi}와 시야각 설정을 그대로 유지합니다.`,
    '3. 다음 플레이에서는 지나침과 멈춤감만 기록하고, 한 판마다 감도를 바꾸지 않습니다.',
  ].join('\n');

  async function copyReport(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error('clipboard-unavailable');
      }

      await navigator.clipboard.writeText(reportText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <article className="panel-card applied-report-card">
      <div className="applied-report-header">
        <div>
          <p className="eyebrow">실전 적용 리포트</p>
          <h2>오버워치에서 확인할 감도 후보</h2>
          <p className="muted-text">
            결과 숫자와 함께, 같은 조건에서 다음 플레이를 검증할 수 있게 정리했습니다.
          </p>
        </div>
        <span className="report-badge">베타 공개</span>
      </div>

      <div className="report-stat-grid">
        <div className="report-stat report-stat-feature">
          <span>게임에 넣을 값</span>
          <strong>{formatSensitivity(finalSensitivity)}</strong>
          <small>DPI {session.settings.dpi}</small>
        </div>
        <div className="report-stat">
          <span>체감 변화</span>
          <strong>{changeText}</strong>
          <small>
            {formatCm360(currentCm360)} → {formatCm360(finalCm360)} / 360°
          </small>
        </div>
        <div className="report-stat">
          <span>이번 측정의 판정</span>
          <strong>{validationStatus}</strong>
          <small>{scoreText}</small>
        </div>
      </div>

      <p className="muted-text section-space">
        브라우저 과제에서 찾은 후보이며 오버워치 실전 성능은 아직 확인하지 않았습니다.
        점수는 자체 계산값으로, 성공 확률이나 통계적 신뢰도를 뜻하지 않습니다.
      </p>
      {session.validationResult?.decisionReason.map((reason) => (
        <p className="muted-text" key={reason}>{reason}</p>
      ))}
      <details>
        <summary>추천 방법과 연구 근거</summary>
        <p className="muted-text section-space">
          감도에 따른 속도와 정밀도의 균형을 순간 조준·추적·회전으로 나누어 비교합니다.
          논문에서 얻은 집단 평균을 개인의 정답으로 사용하지 않습니다.
          영웅별 최적값, 조준경 배율과 실전 승률은 이 시험으로 검증하지 않습니다.
        </p>
        <a href="https://research.nvidia.com/publication/2023-07_mouse-sensitivity-first-person-targeting-tasks">감도와 속도·정밀도 연구 (2023)</a>
        <p><a href="https://doi.org/10.3389/fnhum.2022.979293">과제별 조준 성능 연구 (2022)</a></p>
      </details>
      <div className="report-checklist">
        <div className="report-check-item">
          <span className="report-step-number">01</span>
          <div>
            <strong>값 적용</strong>
            <p>오버워치 감도를 {formatSensitivity(finalSensitivity)}으로 입력하고 DPI {session.settings.dpi}를 유지합니다.</p>
          </div>
        </div>
        <div className="report-check-item">
          <span className="report-step-number">02</span>
          <div>
            <strong>같은 조건으로 확인</strong>
            <p>시야각과 마우스 설정을 바꾸지 않은 채 순간 조준, 추적, 회전 감각을 비교합니다.</p>
          </div>
        </div>
        <div className="report-check-item">
          <span className="report-step-number">03</span>
          <div>
            <strong>다음 변경 기준 남기기</strong>
            <p>지나침과 멈춤감 중 하나가 반복될 때만 다음 측정을 시작해 기록이 쌓이게 합니다.</p>
          </div>
        </div>
      </div>

      <div className="applied-report-footer">
        <p className="muted-text">이 리포트는 브라우저 안에서만 만들어지며, 결과와 적용 순서를 한 번에 저장할 수 있습니다.</p>
        <button type="button" className="secondary-button" onClick={copyReport}>
          {copyStatus === 'copied' ? '리포트를 복사했습니다' : '리포트 전체 복사'}
        </button>
      </div>
      <p className="muted-text report-copy-status" role="status">
        {copyStatus === 'failed' ? '자동 복사가 막혔습니다. 결과 화면의 값을 직접 입력해 주세요.' : ''}
      </p>
    </article>
  );
}
