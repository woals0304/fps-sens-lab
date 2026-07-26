import { lazy, Suspense } from 'react';
import { APP_TABS } from '../lib/constants/appConstants';
import { getGuidedStageInfo } from '../lib/utils/guidedFlow';
import { formatSensitivity } from '../lib/utils/sensitivity';
import { HomePage } from '../pages/HomePage';
import { useSessionController } from './useSessionController';

const GuidedTestPage = lazy(() =>
  import('../pages/GuidedTestPage').then((module) => ({ default: module.GuidedTestPage })),
);
const ResultPage = lazy(() =>
  import('../pages/ResultPage').then((module) => ({ default: module.ResultPage })),
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

export function App(): JSX.Element {
  // 내부 엔진은 복잡하지만, 바깥 화면은 세 개의 메뉴만 보이게 단순화합니다.
  const {
    sessions,
    currentSession,
    currentSessionId,
    activeTab,
    storageError,
    setupDraft,
    setSetupDraft,
    switchTab,
    startSession,
    startQuickSession,
    recordLabTask,
    updateLabPreferences,
    loadSession,
    deleteSession,
    loadSample,
  } = useSessionController();

  const stageInfo = currentSession ? getGuidedStageInfo(currentSession.experimentState.stage) : null;
  const finalSensitivity =
    currentSession?.recommendation.finalSensitivity ?? currentSession?.recommendation.bestSensitivity ?? null;
  const isGuidedMode =
    activeTab === 'finder' && Boolean(currentSession && currentSession.experimentState.stage !== 'result');

  return (
    <div className={isGuidedMode ? 'simple-app-shell immersive-app-shell' : 'simple-app-shell'}>
      {!isGuidedMode ? (
        <header className="app-topbar">
          <div className="brand-card topbar-brand">
            <strong className="brand-wordmark">FPS Sens Lab</strong>
            <span className="brand-divider" aria-hidden="true" />
            <p className="muted-text">오버워치 감도 측정</p>
          </div>

          <nav className="topbar-nav" aria-label="주요 메뉴">
            {APP_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeTab ? 'tab-button active' : 'tab-button'}
                aria-current={tab.id === activeTab ? 'page' : undefined}
                onClick={() => switchTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="status-card topbar-status" aria-label="현재 세션 상태">
            {currentSession ? (
              <>
                <strong>DPI {currentSession.settings.dpi}</strong>
                <p className="muted-text">
                  현재 감도 {formatSensitivity(currentSession.settings.currentSensitivity)}
                </p>
                <p className="muted-text">
                  {currentSession.experimentState.stage === 'result'
                    ? `추천 감도 ${formatSensitivity(finalSensitivity)}`
                    : `${stageInfo?.title ?? '진행 중'} 단계`}
                </p>
              </>
            ) : (
              <p className="muted-text">설치 없이 브라우저에서 측정합니다.</p>
            )}
          </div>
        </header>
      ) : null}

      <main className={isGuidedMode ? 'main-panel immersive-main-panel' : 'main-panel simple-main-panel'}>
        {storageError ? (
          <p className="inline-alert app-storage-alert" role="alert">
            {storageError}
          </p>
        ) : null}

        <Suspense
          fallback={
            <section className="page-section simple-page" role="status">
              <article className="panel-card">화면을 불러오는 중입니다.</article>
            </section>
          }
        >
          {activeTab === 'finder' &&
            (currentSession && currentSession.experimentState.stage !== 'result' ? (
              <GuidedTestPage
                session={currentSession}
                onRecordLabTask={recordLabTask}
                onUpdateLabPreferences={updateLabPreferences}
                onOpenResults={() => switchTab('results')}
                onExit={() => switchTab('settings')}
              />
            ) : (
              <HomePage
                draft={setupDraft}
                currentSession={currentSession}
                onDraftChange={setSetupDraft}
                onStartQuickSession={() => startQuickSession(setupDraft)}
                onOpenSettings={() => switchTab('settings')}
                onOpenResults={() => switchTab('results')}
              />
            ))}

          {activeTab === 'results' && (
            <ResultPage
              session={currentSession}
              retrySettings={currentSession?.settings ?? setupDraft}
              onRetry={startQuickSession}
              onResume={() => switchTab('finder')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              draft={setupDraft}
              currentSession={currentSession}
              sessions={sessions}
              currentSessionId={currentSessionId}
              onDraftChange={setSetupDraft}
              onStartAdvancedSession={startSession}
              onRecordLabTask={recordLabTask}
              onUpdateLabPreferences={updateLabPreferences}
              onLoadSession={loadSession}
              onDeleteSession={deleteSession}
              onLoadSample={loadSample}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}
