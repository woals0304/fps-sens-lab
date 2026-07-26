import { useMemo, useState } from 'react';
import { generateCandidates } from '../../lib/utils/candidateUtils';
import { toNumber } from '../../lib/utils/numberUtils';
import { compareSensitivity, formatSensitivity } from '../../lib/utils/sensitivity';
import { getExperimentStageLabel } from '../../lib/utils/uiText';
import type { RangeTestEntry, StoredSession } from '../../types/models';

interface RangeTestPanelProps {
  session: StoredSession | null;
  onSaveEntry: (entry: {
    sensitivity: number;
    accuracyScore: number;
    trackingComfort: number;
    flickComfort: number;
    overshoot: number;
    overallFeeling: number;
    memo: string;
  }) => void;
  onDeleteEntry: (sensitivity: number) => void;
}

export function RangeTestPanel({
  session,
  onSaveEntry,
  onDeleteEntry,
}: RangeTestPanelProps): JSX.Element {
  const [sortMode, setSortMode] = useState<'default' | 'score'>('default');
  const [jumpValue, setJumpValue] = useState<string>('');

  const candidates = useMemo(() => (session ? generateCandidates(session.settings) : []), [session]);
  const entryMap = useMemo(
    () => new Map(session?.rangeEntries.map((entry) => [entry.sensitivity, entry]) ?? []),
    [session],
  );
  const summaryMap = useMemo(
    () => new Map(session?.labSummaries.map((summary) => [summary.sensitivity, summary]) ?? []),
    [session],
  );

  const orderedCandidates = [...candidates].sort((left, right) => {
    if (sortMode === 'score') {
      const leftScore = entryMap.get(left.value)?.weightedScore ?? -1;
      const rightScore = entryMap.get(right.value)?.weightedScore ?? -1;
      return rightScore - leftScore;
    }

    return compareSensitivity(left.value, right.value);
  });

  const testedEntries = [...(session?.rangeEntries ?? [])].sort((left, right) => right.weightedScore - left.weightedScore);
  const averageOvershoot =
    testedEntries.length > 0
      ? testedEntries.reduce((total, entry) => total + entry.overshoot, 0) / testedEntries.length
      : 0;
  const trackingBias =
    testedEntries.length > 0
      ? testedEntries.reduce((total, entry) => total + entry.trackingComfort - entry.flickComfort, 0) /
        testedEntries.length
      : 0;

  if (!session) {
    return <EmptyMessage title="범위 시험" message="먼저 초기 설정에서 세션을 시작해 주세요." />;
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">2. 범위 시험</p>
          <h2>넓은 구간을 훑으면서 각 감도의 수동 점수를 기록합니다.</h2>
        </div>

        <div className="inline-controls">
          <label className="field compact">
            <span>정렬 방식</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as 'default' | 'score')}>
              <option value="default">감도 순</option>
              <option value="score">수동 점수 순</option>
            </select>
          </label>

          <label className="field compact">
            <span>빠른 이동</span>
            <select
              value={jumpValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setJumpValue(nextValue);

                if (!nextValue) {
                  return;
                }

                document.getElementById(`range-${nextValue}`)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }}
            >
              <option value="">선택</option>
              {candidates.map((candidate) => (
                <option key={candidate.value} value={candidate.value}>
                  {formatSensitivity(candidate.value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="summary-grid">
        <div className="metric-card">
          <span>가장 높은 수동 점수</span>
          <strong>{testedEntries[0] ? formatSensitivity(testedEntries[0].sensitivity) : '-'}</strong>
        </div>
        <div className="metric-card">
          <span>상위 후보 3개</span>
          <strong>{testedEntries.slice(0, 3).map((entry) => formatSensitivity(entry.sensitivity)).join(', ') || '-'}</strong>
        </div>
        <div className="metric-card">
          <span>지나침 평균</span>
          <strong>{averageOvershoot.toFixed(1)}</strong>
        </div>
        <div className="metric-card">
          <span>감각 치우침</span>
          <strong>{trackingBias >= 0 ? '추적 조준 쪽이 더 편함' : '순간 조준 쪽이 더 편함'}</strong>
        </div>
        <div className="metric-card">
          <span>자동 진행 단계</span>
          <strong>{getExperimentStageLabel(session.experimentState.stage)}</strong>
        </div>
      </div>

      <div className="card-grid">
        {orderedCandidates.map((candidate) => {
          const current = entryMap.get(candidate.value);
          const summary = summaryMap.get(candidate.value);

          return (
            <article key={candidate.value} id={`range-${candidate.value}`} className="panel-card range-card">
              <div className="range-card-header">
                <div>
                  <h3>{formatSensitivity(candidate.value)}</h3>
                  <p className="muted-text">
                    {current
                      ? `수동 가중 종합 점수 ${current.weightedScore.toFixed(2)}`
                      : '수동 입력이 아직 없습니다.'}
                  </p>
                  <p className="muted-text">
                    {summary
                      ? `자동 가중 종합 점수 ${summary.autoWeightedScore?.toFixed(2) ?? '-'} / 통합 가중 점수 ${summary.combinedWeightedScore?.toFixed(2) ?? '-'}`
                      : '자동 측정 결과가 아직 없습니다.'}
                  </p>
                </div>
                {current && (
                  <button type="button" className="ghost-button" onClick={() => onDeleteEntry(candidate.value)}>
                    입력 지우기
                  </button>
                )}
              </div>

              {summary && (
                <div className="pill-row">
                  <span className="pill">순간 조준 점수 {summary.flickScore.toFixed(1)}</span>
                  <span className="pill">추적 조준 점수 {summary.trackingScore.toFixed(1)}</span>
                  <span className="pill">회전 반응 점수 {summary.turnScore.toFixed(1)}</span>
                </div>
              )}

              <div className="score-grid">
                <ScoreInput
                  label="정확도 점수"
                  value={current?.accuracyScore ?? 0}
                  onChange={(value) => savePatch(candidate.value, current, onSaveEntry, { accuracyScore: value })}
                />
                <ScoreInput
                  label="추적 조준 편안함"
                  value={current?.trackingComfort ?? 0}
                  onChange={(value) => savePatch(candidate.value, current, onSaveEntry, { trackingComfort: value })}
                />
                <ScoreInput
                  label="순간 조준 편안함"
                  value={current?.flickComfort ?? 0}
                  onChange={(value) => savePatch(candidate.value, current, onSaveEntry, { flickComfort: value })}
                />
                <ScoreInput
                  label="지나침 정도"
                  value={current?.overshoot ?? 0}
                  onChange={(value) => savePatch(candidate.value, current, onSaveEntry, { overshoot: value })}
                />
                <ScoreInput
                  label="전체 느낌"
                  value={current?.overallFeeling ?? 0}
                  onChange={(value) => savePatch(candidate.value, current, onSaveEntry, { overallFeeling: value })}
                />
              </div>

              <label className="field full-width">
                <span>메모</span>
                <textarea
                  rows={3}
                  value={current?.memo ?? ''}
                  placeholder="예: 조금 빠름, 추적 조준은 편한데 순간 조준이 흔들림"
                  onChange={(event) => savePatch(candidate.value, current, onSaveEntry, { memo: event.target.value })}
                />
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function savePatch(
  sensitivity: number,
  current: RangeTestEntry | undefined,
  onSaveEntry: RangeTestPanelProps['onSaveEntry'],
  patch: Partial<{
    accuracyScore: number;
    trackingComfort: number;
    flickComfort: number;
    overshoot: number;
    overallFeeling: number;
    memo: string;
  }>,
): void {
  onSaveEntry({
    sensitivity,
    accuracyScore: patch.accuracyScore ?? current?.accuracyScore ?? 0,
    trackingComfort: patch.trackingComfort ?? current?.trackingComfort ?? 0,
    flickComfort: patch.flickComfort ?? current?.flickComfort ?? 0,
    overshoot: patch.overshoot ?? current?.overshoot ?? 0,
    overallFeeling: patch.overallFeeling ?? current?.overallFeeling ?? 0,
    memo: patch.memo ?? current?.memo ?? '',
  });
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value, value))}
      />
    </label>
  );
}

function EmptyMessage({ title, message }: { title: string; message: string }): JSX.Element {
  return (
    <section className="page-section">
      <div className="panel-card">
        <h2>{title}</h2>
        <p className="muted-text">{message}</p>
      </div>
    </section>
  );
}
