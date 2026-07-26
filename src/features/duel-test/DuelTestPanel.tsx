import { useMemo, useState } from 'react';
import { buildDuelScoreMap, getDuelProgress } from '../../lib/duel-engine/duelEngine';
import { getCandidateValues } from '../../lib/utils/candidateUtils';
import { formatDateTime } from '../../lib/utils/numberUtils';
import { formatSensitivity } from '../../lib/utils/sensitivity';
import { getDuelChoiceLabel, getDuelSourceLabel } from '../../lib/utils/uiText';
import type { DuelChoice, StoredSession } from '../../types/models';

interface DuelTestPanelProps {
  session: StoredSession | null;
  onRecordMatch: (choice: DuelChoice, note: string) => void;
}

export function DuelTestPanel({ session, onRecordMatch }: DuelTestPanelProps): JSX.Element {
  const [note, setNote] = useState('');

  const candidateValues = useMemo(() => (session ? getCandidateValues(session.settings) : []), [session]);
  const progress = useMemo(
    () => getDuelProgress(candidateValues, session?.duelMatches ?? []),
    [candidateValues, session],
  );
  const duelScoreRows = useMemo(() => {
    const scoreMap = buildDuelScoreMap(session?.duelMatches ?? []);
    return Array.from(scoreMap.entries()).sort((left, right) => right[1] - left[1]);
  }, [session]);
  const summaryMap = useMemo(
    () => new Map(session?.labSummaries.map((summary) => [summary.sensitivity, summary]) ?? []),
    [session],
  );

  if (!session) {
    return (
      <section className="page-section">
        <div className="panel-card">
          <h2>비교 시험</h2>
          <p className="muted-text">먼저 초기 설정에서 세션을 시작해 주세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">3. 비교 시험</p>
          <h2>두 감도를 직접 비교해서 유력한 구간을 더 좁힙니다.</h2>
        </div>
      </div>

      <div className="two-column">
        <article className="panel-card">
          <div className="pill-row">
            <span className="pill">
              {progress.phase === 'coarse'
                ? '넓게 비교하는 단계'
                : progress.phase === 'fine'
                  ? '가까운 감도 비교 단계'
                  : '비교 완료'}
            </span>
            <span className="pill">
              현재 후보 범위 {formatSensitivity(progress.remainingCandidates[0] ?? null)} ~{' '}
              {formatSensitivity(progress.remainingCandidates[progress.remainingCandidates.length - 1] ?? null)}
            </span>
          </div>

          {progress.currentPair ? (
            <>
              <div className="duel-board">
                <div className="duel-card">
                  <span>후보 A</span>
                  <strong>{formatSensitivity(progress.currentPair.candidateA)}</strong>
                  <p className="muted-text">
                    통합 가중 점수{' '}
                    {summaryMap.get(progress.currentPair.candidateA)?.combinedWeightedScore?.toFixed(1) ?? '-'}
                  </p>
                </div>
                <div className="duel-versus">비교</div>
                <div className="duel-card">
                  <span>후보 B</span>
                  <strong>{formatSensitivity(progress.currentPair.candidateB)}</strong>
                  <p className="muted-text">
                    통합 가중 점수{' '}
                    {summaryMap.get(progress.currentPair.candidateB)?.combinedWeightedScore?.toFixed(1) ?? '-'}
                  </p>
                </div>
              </div>

              <p className="muted-text">
                현재 중심 감도: {formatSensitivity(progress.focusSensitivity)}. 자동 측정 결과와 직접 체감 비교를 함께 반영합니다.
              </p>

              <label className="field full-width">
                <span>비교 메모</span>
                <textarea
                  rows={3}
                  value={note}
                  placeholder="예: A는 안정적이고 B는 빠르지만 지나침이 있음"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    onRecordMatch('A', note);
                    setNote('');
                  }}
                >
                  A가 더 좋음
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    onRecordMatch('B', note);
                    setNote('');
                  }}
                >
                  B가 더 좋음
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    onRecordMatch('SIMILAR', note);
                    setNote('');
                  }}
                >
                  거의 비슷함
                </button>
              </div>
            </>
          ) : (
            <div className="finished-box">
              <h3>비교 시험이 끝났습니다.</h3>
              <p className="muted-text">
                현재 유력 감도는 {formatSensitivity(progress.focusSensitivity)} 근처입니다. 이제 결과 분석판에서 추천 근거를 확인해 보세요.
              </p>
            </div>
          )}
        </article>

        <article className="panel-card">
          <h3>비교 우세 점수</h3>
          <p className="muted-text">비교에서 더 자주 좋은 쪽으로 선택된 감도가 위로 올라옵니다.</p>
          <p className="muted-text">자동 측정으로 만든 비교 기록도 함께 반영됩니다.</p>

          <div className="history-list compact-list">
            {duelScoreRows.length > 0 ? (
              duelScoreRows.map(([sensitivity, score]) => (
                <div key={sensitivity} className="history-row">
                  <strong>{formatSensitivity(sensitivity)}</strong>
                  <span>{score.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="muted-text">아직 비교 기록이 없습니다.</p>
            )}
          </div>

          <h3 className="section-space">비교 기록</h3>
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
                    <td colSpan={6}>아직 비교 기록이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
