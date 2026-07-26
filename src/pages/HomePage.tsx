import { StartCard } from '../components/StartCard';
import type { AppSettings, StoredSession } from '../types/models';

interface HomePageProps {
  draft: AppSettings;
  currentSession: StoredSession | null;
  onDraftChange: (nextDraft: AppSettings) => void;
  onStartQuickSession: () => void;
  onOpenSettings: () => void;
  onOpenResults: () => void;
}

export function HomePage({
  draft,
  currentSession,
  onDraftChange,
  onStartQuickSession,
  onOpenSettings,
  onOpenResults,
}: HomePageProps): JSX.Element {
  return (
    <section className="home-page simple-page">
      <StartCard
        draft={draft}
        currentSession={currentSession}
        onDraftChange={onDraftChange}
        onStart={onStartQuickSession}
        onOpenSettings={onOpenSettings}
        onOpenResults={onOpenResults}
      />
    </section>
  );
}
