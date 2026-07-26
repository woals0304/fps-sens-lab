import { lazy, Suspense, useState } from 'react';
import { ExpandableDetailSection } from '../components/ExpandableDetailSection';
import { ResultSummaryCard } from '../components/ResultSummaryCard';
import type { AppSettings, StoredSession } from '../types/models';

const ResultsDashboard = lazy(() =>
  import('../features/results/ResultsDashboard').then((module) => ({
    default: module.ResultsDashboard,
  })),
);

interface ResultPageProps {
  session: StoredSession | null;
  retrySettings: AppSettings;
  onRetry: (settings: AppSettings) => void;
  onResume: () => void;
}

export function ResultPage({
  session,
  retrySettings,
  onRetry,
  onResume,
}: ResultPageProps): JSX.Element {
  const [detailOpen, setDetailOpen] = useState(false);

  if (!session) {
    return (
      <section className="page-section simple-page">
        <article className="panel-card">
          <h2>아직 추천 결과가 없습니다.</h2>
          <p className="muted-text">감도 찾기에서 테스트를 시작해 주세요.</p>
        </article>
      </section>
    );
  }

  if (session.experimentState.stage !== 'result') {
    return (
      <section className="page-section simple-page">
        <article className="panel-card">
          <p className="eyebrow">진단 진행 중</p>
          <h2>테스트가 아직 끝나지 않았습니다.</h2>
          <p className="muted-text">
            남은 테스트를 마치면 추천 감도와 안정 범위를 확인할 수 있습니다.
          </p>
          <button type="button" className="primary-button" onClick={onResume}>
            시험 이어가기
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="page-section simple-page">
      <ResultSummaryCard
        session={session}
        detailOpen={detailOpen}
        onRetry={() => onRetry(retrySettings)}
        onToggleDetails={() => setDetailOpen((current) => !current)}
      />

      <ExpandableDetailSection
        title="세부 결과 보기"
        description="점수, 그래프, 후보별 비교 기록을 확인합니다."
        open={detailOpen}
        onToggle={() => setDetailOpen((current) => !current)}
      >
        <Suspense fallback={<p role="status">세부 결과를 불러오는 중입니다.</p>}>
          <ResultsDashboard session={session} />
        </Suspense>
      </ExpandableDetailSection>
    </section>
  );
}
