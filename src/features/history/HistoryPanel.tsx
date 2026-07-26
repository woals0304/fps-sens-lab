import { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '../../lib/utils/numberUtils';
import { formatSensitivity } from '../../lib/utils/sensitivity';
import { getExperimentStageLabel, getHeroCategoryLabel } from '../../lib/utils/uiText';
import type { AppTab, StoredSession } from '../../types/models';

interface HistoryPanelProps {
  sessions: StoredSession[];
  currentSessionId: string | null;
  onLoadSession: (sessionId: string, tab?: AppTab) => void;
  onDeleteSession: (sessionId: string) => void;
  onLoadSample: () => void;
}

export function HistoryPanel({
  sessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onLoadSample,
}: HistoryPanelProps): JSX.Element {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (pendingDeleteId) {
      confirmDeleteButtonRef.current?.focus();
    }
  }, [pendingDeleteId]);

  useEffect(() => {
    if (pendingDeleteId && !sessions.some((session) => session.id === pendingDeleteId)) {
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, sessions]);

  function confirmDelete(sessionId: string): void {
    onDeleteSession(sessionId);
    setPendingDeleteId(null);
  }

  function cancelDelete(sessionId: string): void {
    setPendingDeleteId(null);
    window.requestAnimationFrame(() => deleteButtonRefs.current.get(sessionId)?.focus());
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">저장된 기록</p>
          <h2>저장된 테스트를 이어서 진행하거나 결과를 확인할 수 있습니다.</h2>
        </div>

        <button type="button" className="primary-button" onClick={onLoadSample}>
          샘플 기록 불러오기
        </button>
      </div>

      <div className="history-list">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <article
              key={session.id}
              className={session.id === currentSessionId ? 'panel-card history-card active' : 'panel-card history-card'}
            >
              <div className="history-row stacked">
                <div>
                  <h3>
                    {getHeroCategoryLabel(
                      session.settings.heroCategory,
                      session.settings.customHeroCategory,
                    )}
                  </h3>
                  <p className="muted-text">{formatDateTime(session.updatedAt)}</p>
                </div>
                <span className="pill">
                  최종 감도 {formatSensitivity(session.recommendation.finalSensitivity ?? session.recommendation.bestSensitivity)}
                </span>
              </div>

              <p className="muted-text">
                DPI {session.settings.dpi} / 현재 감도 {formatSensitivity(session.settings.currentSensitivity)} / 수동 기록{' '}
                {session.rangeEntries.length}건 / 비교 기록 {session.duelMatches.length}건 / 자동 측정 {session.labRuns.length}회
              </p>
              <p className="muted-text">
                진행 단계 {getExperimentStageLabel(session.experimentState.stage)}
                {session.experimentState.stopReason ? ` / ${session.experimentState.stopReason}` : ''}
              </p>
              <p className="muted-text">
                최종 검증 {session.validationResult ? (session.validationResult.passed ? '통과' : '검증 후 조정') : '대기'}
              </p>

              <div className="button-row">
                <button type="button" className="secondary-button" onClick={() => onLoadSession(session.id, 'results')}>
                  결과 보기
                </button>
                <button type="button" className="ghost-button" onClick={() => onLoadSession(session.id, 'finder')}>
                  다시 진행하기
                </button>
                <button
                  ref={(button) => {
                    if (button) {
                      deleteButtonRefs.current.set(session.id, button);
                    } else {
                      deleteButtonRefs.current.delete(session.id);
                    }
                  }}
                  type="button"
                  className="ghost-button danger"
                  aria-expanded={pendingDeleteId === session.id}
                  aria-controls={`delete-confirmation-${session.id}`}
                  onClick={() => setPendingDeleteId(session.id)}
                  disabled={pendingDeleteId === session.id}
                >
                  삭제
                </button>
              </div>

              {pendingDeleteId === session.id ? (
                <div
                  id={`delete-confirmation-${session.id}`}
                  className="history-delete-confirmation"
                  role="group"
                  aria-label="기록 삭제 확인"
                >
                  <p role="alert">이 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.</p>
                  <div className="button-row">
                    <button
                      ref={confirmDeleteButtonRef}
                      type="button"
                      className="secondary-button danger-confirm-button"
                      onClick={() => confirmDelete(session.id)}
                    >
                      삭제 확정
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => cancelDelete(session.id)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="panel-card">
            <h3>저장된 기록이 없습니다.</h3>
            <p className="muted-text">완료하거나 진행 중인 테스트가 여기에 저장됩니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
