import { buildTrendTexts } from '../../lib/experiment/metricsAnalyzer';
import { formatSensitivity } from '../../lib/utils/sensitivity';
import { getTrendTagLabel } from '../../lib/utils/uiText';
import type { SensitivityLabSummary, StoredSession } from '../../types/models';

interface LabResultCardsProps {
  session: StoredSession;
  selectedSensitivity: number;
}

function findClosestSummary(summaries: SensitivityLabSummary[], sensitivity: number): SensitivityLabSummary | null {
  if (summaries.length === 0) {
    return null;
  }

  return [...summaries].sort(
    (left, right) => Math.abs(left.sensitivity - sensitivity) - Math.abs(right.sensitivity - sensitivity),
  )[0];
}

export function LabResultCards({ session, selectedSensitivity }: LabResultCardsProps): JSX.Element {
  const summary = findClosestSummary(session.labSummaries, selectedSensitivity);
  const trends = buildTrendTexts(session.labSummaries);

  return (
    <div className="two-column">
      <article className="panel-card">
        <h3>현재 감도 자동 측정</h3>
        {summary ? (
          <>
            <p className="muted-text">가장 가까운 자동 측정 감도: {formatSensitivity(summary.sensitivity)}</p>
            <div className="summary-grid compact-summary">
              <div className="metric-card">
                <span>자동 가중 종합 점수</span>
                <strong>{summary.autoWeightedScore?.toFixed(1) ?? '-'}</strong>
              </div>
              <div className="metric-card">
                <span>통합 가중 점수</span>
                <strong>{summary.combinedWeightedScore?.toFixed(1) ?? '-'}</strong>
              </div>
              <div className="metric-card">
                <span>순간 조준 점수</span>
                <strong>{summary.flickScore.toFixed(1)}</strong>
              </div>
              <div className="metric-card">
                <span>추적 조준 점수</span>
                <strong>{summary.trackingScore.toFixed(1)}</strong>
              </div>
            </div>

            <div className="pill-row">
              {summary.interpretationTags.map((tag) => (
                <span key={tag} className="candidate-badge">
                  {getTrendTagLabel(tag)}
                </span>
              ))}
              <span className="candidate-badge">측정 횟수 {summary.runCount}</span>
            </div>
          </>
        ) : (
          <p className="muted-text">아직 자동 측정 결과가 없습니다. 첫 작업이 끝나면 여기에서 바로 점수를 볼 수 있습니다.</p>
        )}
      </article>

      <article className="panel-card">
        <h3>자동 해석</h3>
        <p>{trends.tooFastText}</p>
        <p>{trends.tooSlowText}</p>
        {trends.reasons.length > 0 && (
          <div className="bullet-list section-space">
            {trends.reasons.map((reason) => (
              <p key={reason}>- {reason}</p>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
