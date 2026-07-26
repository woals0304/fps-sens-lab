import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDefaultOverwatchFov, isCustomFovEnabled } from '../../lib/utils/fov';
import { formatDateTime } from '../../lib/utils/numberUtils';
import {
  calculateCm360,
  calculateOverwatchCm360,
  calculateRotationDifferencePercent,
} from '../../lib/utils/rotationScale';
import { formatSensitivity } from '../../lib/utils/sensitivity';
import {
  getDecisionActionLabel,
  getDuelChoiceLabel,
  getDuelSourceLabel,
  getExperimentStageLabel,
  getHeroCategoryLabel,
  getPlayStyleLabel,
  getTrendTagLabel,
  getValidationRoleLabel,
} from '../../lib/utils/uiText';
import type { StoredSession } from '../../types/models';

interface ResultsDashboardProps {
  session: StoredSession | null;
}

type ResultDetailView = 'summary' | 'charts' | 'validation' | 'records';

const RESULT_DETAIL_VIEWS: Array<{ id: ResultDetailView; label: string }> = [
  { id: 'summary', label: '요약' },
  { id: 'charts', label: '그래프' },
  { id: 'validation', label: '검증' },
  { id: 'records', label: '측정 기록' },
];

export function ResultsDashboard({ session }: ResultsDashboardProps): JSX.Element {
  const [activeView, setActiveView] = useState<ResultDetailView>('summary');

  if (!session) {
    return (
      <section className="page-section">
        <div className="panel-card">
          <h2>세부 결과</h2>
          <p className="muted-text">먼저 테스트를 시작해 주세요.</p>
        </div>
      </section>
    );
  }

  const recommendation = session.recommendation;
  const chartData = session.labSummaries.map((summary) => ({
    sensitivity: formatSensitivity(summary.sensitivity),
    autoWeightedScore: summary.autoWeightedScore,
    combinedWeightedScore: summary.combinedWeightedScore,
    flickScore: summary.flickScore,
    trackingScore: summary.trackingScore,
    turnScore: summary.turnScore,
    overshootPenalty: summary.overshootPenalty,
  }));
  const effectiveSensitivity =
    recommendation.finalSensitivity ?? recommendation.bestSensitivity ?? session.settings.currentSensitivity;
  const overwatchCm360 = calculateOverwatchCm360(session.settings.dpi, effectiveSensitivity);
  const projectCm360 = calculateCm360(
    session.settings.dpi,
    effectiveSensitivity,
    session.experimentState.calibrationMultiplier,
  );
  const rotationDifferencePercent = calculateRotationDifferencePercent(overwatchCm360, projectCm360);

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">세부 결과</p>
          <h2>측정 점수와 감도별 비교 기록입니다.</h2>
        </div>

      </div>

      <div className="segmented-control" role="tablist" aria-label="결과 상세 보기">
        {RESULT_DETAIL_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={activeView === view.id}
            className={activeView === view.id ? 'tab-button active compact-tab' : 'tab-button compact-tab'}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === 'summary' ? (
        <>
      <div className="two-column">
        <article className="panel-card">
          <h3>왜 이 감도인가</h3>
          <div className="bullet-list">
            {recommendation.reasonSummary.slice(0, 2).map((reason) => (
              <p key={reason}>- {reason}</p>
            ))}
          </div>

          <h3 className="section-space">추가로 확인할 감도</h3>
          <div className="pill-row">
            {recommendation.nextTestCandidates.length > 0 ? (
              recommendation.nextTestCandidates.map((candidate) => (
                <span key={candidate} className="candidate-badge">
                  {formatSensitivity(candidate)}
                </span>
              ))
            ) : (
              <span className="muted-text">현재 기준으로는 추가 시험이 꼭 필요한 상태는 아닙니다.</span>
            )}
          </div>

          <h3 className="section-space">상위 후보</h3>
          <div className="history-list">
            {recommendation.topCandidates.map((candidate) => (
              <div key={candidate.sensitivity} className="history-row stacked">
                <div>
                  <strong>{formatSensitivity(candidate.sensitivity)}</strong>
                  <p className="muted-text">{candidate.label}</p>
                </div>
                <span>{candidate.score.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-card">
          <h3>테스트 조건</h3>
          <p className="muted-text">{session.testProtocol.description}</p>
          <div className="history-list">
            <div className="history-row">
              <strong>기본 테스트</strong>
              <span>
                순간 조준 {session.testProtocol.standard.flickTargetCount}개 / 추적 조준{' '}
                {Math.round(session.testProtocol.standard.trackingDurationMs / 1000)}초 / 회전 반응{' '}
                {session.testProtocol.standard.turnInstructions.length}회
              </span>
            </div>
            <div className="history-row">
              <strong>최종 확인</strong>
              <span>
                순간 조준 {session.testProtocol.validation.flickTargetCount}개 / 추적 조준{' '}
                {Math.round(session.testProtocol.validation.trackingDurationMs / 1000)}초 / 회전 반응{' '}
                {session.testProtocol.validation.turnInstructions.length}회
              </span>
            </div>
            <div className="history-row">
              <strong>진행 순서</strong>
              <span>범위 확인 → 후보 비교 → 미세 조정 → 최종 확인 → 결과</span>
            </div>
          </div>
        </article>
      </div>

        </>
      ) : null}

      {activeView === 'charts' ? (
        <>
      <div className="two-column">
        <article className="panel-card">
          <h3>감도별 종합 점수</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="sensitivity" stroke="#98a2b3" />
                <YAxis stroke="#98a2b3" domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="autoWeightedScore"
                  name="자동 가중 종합 점수"
                  stroke="#22d3ee"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="combinedWeightedScore"
                  name="통합 가중 점수"
                  stroke="#f97316"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <h3>항목별 점수</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="sensitivity" stroke="#98a2b3" />
                <YAxis stroke="#98a2b3" domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="flickScore" name="순간 조준 점수" stroke="#fb7185" strokeWidth={2} />
                <Line
                  type="monotone"
                  dataKey="trackingScore"
                  name="추적 조준 점수"
                  stroke="#60a5fa"
                  strokeWidth={2}
                />
                <Line type="monotone" dataKey="turnScore" name="회전 반응 점수" stroke="#34d399" strokeWidth={2} />
                <Line
                  type="monotone"
                  dataKey="overshootPenalty"
                  name="지나침 감점"
                  stroke="#facc15"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
        </>
      ) : null}

      {activeView === 'validation' ? (
        <>
      <div>
        <article className="panel-card">
          <h3>최종 검증 결과</h3>
          {session.validationResult ? (
            <div className="history-list">
              <div className="history-row">
                <strong>검증 전 추천 감도</strong>
                <span>{formatSensitivity(session.validationResult.baselineSensitivity)}</span>
              </div>
              <div className="history-row">
                <strong>검증 후 최종 감도</strong>
                <span>{formatSensitivity(session.validationResult.finalSensitivity)}</span>
              </div>
              <div className="history-row">
                <strong>검증 통과 여부</strong>
                <span>
                  {session.validationResult.passed === null
                    ? '판단 보류'
                    : session.validationResult.passed
                      ? '통과'
                      : '검증 후 조정'}
                </span>
              </div>
              <div className="history-row">
                <strong>검증 시각</strong>
                <span>{session.validationResult.validatedAt ? formatDateTime(session.validationResult.validatedAt) : '-'}</span>
              </div>
              {session.validationResult.decisionReason.map((line) => (
                <p key={line} className="muted-text">
                  - {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="muted-text">아직 최종 검증 단계 전입니다.</p>
          )}
        </article>

      </div>

      <div className="panel-card section-space">
        <h3>감도별 측정 결과</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>감도</th>
                <th>자동 가중 종합 점수</th>
                <th>통합 가중 점수</th>
                <th>순간 조준 점수</th>
                <th>추적 조준 점수</th>
                <th>회전 반응 점수</th>
                <th>지나침 감점</th>
                <th>판정 태그</th>
              </tr>
            </thead>
            <tbody>
              {session.labSummaries.length > 0 ? (
                session.labSummaries.map((summary) => (
                  <tr key={summary.sensitivity}>
                    <td>{formatSensitivity(summary.sensitivity)}</td>
                    <td>{summary.autoWeightedScore?.toFixed(2) ?? '-'}</td>
                    <td>{summary.combinedWeightedScore?.toFixed(2) ?? '-'}</td>
                    <td>{summary.flickScore.toFixed(1)}</td>
                    <td>{summary.trackingScore.toFixed(1)}</td>
                    <td>{summary.turnScore.toFixed(1)}</td>
                    <td>{summary.overshootPenalty.toFixed(2)}</td>
                    <td>{summary.interpretationTags.map((tag) => getTrendTagLabel(tag)).join(', ')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>아직 자동 측정 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card section-space">
        <h3>후보 압축 기록</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>단계</th>
                <th>감도</th>
                <th>판정</th>
                <th>점수</th>
                <th>이유</th>
              </tr>
            </thead>
            <tbody>
              {session.decisionLog.length > 0 ? (
                session.decisionLog.map((record) => (
                  <tr key={record.id}>
                    <td>{getExperimentStageLabel(record.stage)}</td>
                    <td>{formatSensitivity(record.sensitivity)}</td>
                    <td>{getDecisionActionLabel(record.action)}</td>
                    <td>{record.score?.toFixed(2) ?? '-'}</td>
                    <td>{record.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>아직 후보 압축 기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card section-space">
        <h3>최종 검증 비교 표</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>역할</th>
                <th>감도</th>
                <th>가중 종합 점수</th>
                <th>순간 조준</th>
                <th>추적 조준</th>
                <th>회전 반응</th>
                <th>지나침 감점</th>
              </tr>
            </thead>
            <tbody>
              {session.validationResult && session.validationResult.candidateResults.length > 0 ? (
                session.validationResult.candidateResults.map((candidate) => (
                  <tr key={`${candidate.role}-${candidate.sensitivity}`}>
                    <td>{getValidationRoleLabel(candidate.role)}</td>
                    <td>{formatSensitivity(candidate.sensitivity)}</td>
                    <td>{candidate.score?.toFixed(2) ?? '-'}</td>
                    <td>{candidate.flickScore.toFixed(1)}</td>
                    <td>{candidate.trackingScore.toFixed(1)}</td>
                    <td>{candidate.turnScore.toFixed(1)}</td>
                    <td>{candidate.overshootPenalty.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>아직 최종 검증 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : null}

      {activeView === 'records' ? (
        <>
      <div className="two-column">
        <article className="panel-card">
          <h3>수동 범위 시험 기록</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>감도</th>
                  <th>정확도 점수</th>
                  <th>추적 조준 편안함</th>
                  <th>순간 조준 편안함</th>
                  <th>지나침 정도</th>
                  <th>전체 느낌</th>
                  <th>가중 종합 점수</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {session.rangeEntries.length > 0 ? (
                  session.rangeEntries.map((entry) => (
                    <tr key={entry.sensitivity}>
                      <td>{formatSensitivity(entry.sensitivity)}</td>
                      <td>{entry.accuracyScore}</td>
                      <td>{entry.trackingComfort}</td>
                      <td>{entry.flickComfort}</td>
                      <td>{entry.overshoot}</td>
                      <td>{entry.overallFeeling}</td>
                      <td>{entry.weightedScore.toFixed(2)}</td>
                      <td>{entry.memo || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>아직 범위 시험 기록이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <h3>비교 시험 기록</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>A</th>
                  <th>B</th>
                  <th>선택 결과</th>
                  <th>기록 방식</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {session.duelMatches.length > 0 ? (
                  session.duelMatches.map((match) => (
                    <tr key={`${match.playedAt}-${match.candidateA}-${match.candidateB}`}>
                      <td>{formatDateTime(match.playedAt)}</td>
                      <td>{formatSensitivity(match.candidateA)}</td>
                      <td>{formatSensitivity(match.candidateB)}</td>
                      <td>{getDuelChoiceLabel(match.choice)}</td>
                      <td>{getDuelSourceLabel(match.source)}</td>
                      <td>{match.note || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>아직 비교 시험 기록이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="panel-card section-space">
        <h3>세션 정보</h3>
        <div className="history-list">
          <div className="history-row">
            <strong>마지막 저장 시각</strong>
            <span>{formatDateTime(session.updatedAt)}</span>
          </div>
          <div className="history-row">
            <strong>기본 설정</strong>
            <span>
              DPI {session.settings.dpi} / 영웅 분류{' '}
              {getHeroCategoryLabel(session.settings.heroCategory, session.settings.customHeroCategory)} / 플레이 성향{' '}
              {getPlayStyleLabel(session.settings.playStyle)}
            </span>
          </div>
          <div className="history-row">
            <strong>회전 거리 확인</strong>
            <span>
              오버워치 {overwatchCm360.toFixed(2)}cm / 360도 / 시험실 {projectCm360.toFixed(2)}cm / 360도 /
              차이 {rotationDifferencePercent.toFixed(1)}%
            </span>
          </div>
          <div className="history-row">
            <strong>시야각</strong>
            <span>
              {isCustomFovEnabled(session.settings)
                ? `사용자 지정 ${session.settings.effectiveFov}`
                : `오버워치 기준값 ${getDefaultOverwatchFov()}`}
            </span>
          </div>
          <div className="history-row">
            <strong>자동 측정 기록 수</strong>
            <span>{session.labRuns.length}회</span>
          </div>
          <div className="history-row">
            <strong>현재 자동 단계</strong>
            <span>{getExperimentStageLabel(session.experimentState.stage)}</span>
          </div>
        </div>
      </div>
        </>
      ) : null}
    </section>
  );
}
