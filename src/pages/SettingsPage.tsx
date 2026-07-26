import { lazy, Suspense, useState } from 'react';
import { ExpandableDetailSection } from '../components/ExpandableDetailSection';
import { HistoryPanel } from '../features/history/HistoryPanel';
import { SetupPanel } from '../features/setup/SetupPanel';
import type {
  AppSettings,
  AppTab,
  LabMetrics,
  LabRunQuality,
  StoredSession,
} from '../types/models';

const FpsLabPage = lazy(() =>
  import('../features/fps-lab/FpsLabPage').then((module) => ({ default: module.FpsLabPage })),
);

interface SettingsPageProps {
  draft: AppSettings;
  currentSession: StoredSession | null;
  sessions: StoredSession[];
  currentSessionId: string | null;
  onDraftChange: (nextDraft: AppSettings) => void;
  onStartAdvancedSession: (settings: AppSettings) => void;
  onRecordLabTask: (taskId: string, metrics: LabMetrics, quality?: LabRunQuality) => boolean;
  onUpdateLabPreferences: (
    patch: Partial<
      Pick<
        StoredSession['experimentState'],
        'calibrationMultiplier' | 'manualSensitivityOverride' | 'lastLabSection' | 'lastResumeTab'
      >
    >,
  ) => void;
  onLoadSession: (sessionId: string, tab?: AppTab) => void;
  onDeleteSession: (sessionId: string) => void;
  onLoadSample: () => void;
}

export function SettingsPage({
  draft,
  currentSession,
  sessions,
  currentSessionId,
  onDraftChange,
  onStartAdvancedSession,
  onRecordLabTask,
  onUpdateLabPreferences,
  onLoadSession,
  onDeleteSession,
  onLoadSample,
}: SettingsPageProps): JSX.Element {
  const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);

  return (
    <section className="page-section simple-page">
      <article className="panel-card settings-intro">
        <p className="eyebrow">설정</p>
        <h2>테스트 설정과 저장 기록</h2>
        <p className="muted-text">
          기본 테스트에는 DPI와 현재 감도만 필요합니다. 필요하면 시야각과 세부 조건을 바꿀 수 있습니다.
        </p>
      </article>

      <ExpandableDetailSection
        title="테스트 조건"
        description="탐색 범위와 시야각을 확인하거나 변경합니다."
        open={advancedSetupOpen}
        onToggle={() => setAdvancedSetupOpen((current) => !current)}
      >
        <SetupPanel
          draft={draft}
          currentSession={currentSession}
          onDraftChange={onDraftChange}
          onStartSession={onStartAdvancedSession}
        />
      </ExpandableDetailSection>

      <ExpandableDetailSection
        title="저장된 기록"
        description="이전 테스트를 이어서 진행하거나 결과를 확인합니다."
        open={historyOpen}
        onToggle={() => setHistoryOpen((current) => !current)}
      >
        <HistoryPanel
          sessions={sessions}
          currentSessionId={currentSessionId}
          onLoadSession={onLoadSession}
          onDeleteSession={onDeleteSession}
          onLoadSample={onLoadSample}
        />
      </ExpandableDetailSection>

      <ExpandableDetailSection
        title="수동 테스트"
        description="테스트 화면과 입력 설정을 직접 확인합니다."
        open={labOpen}
        onToggle={() => setLabOpen((current) => !current)}
      >
        <Suspense fallback={<p role="status">고급 시험 화면을 불러오는 중입니다.</p>}>
          <FpsLabPage
            session={currentSession}
            onRecordLabTask={onRecordLabTask}
            onUpdateLabPreferences={onUpdateLabPreferences}
          />
        </Suspense>
      </ExpandableDetailSection>
    </section>
  );
}
