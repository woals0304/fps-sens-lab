import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleSession } from '../../data/sampleSessions';
import { HistoryPanel } from './HistoryPanel';

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`버튼을 찾지 못했습니다: ${label}`);
  }

  return button;
}

describe('HistoryPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  it('삭제를 확인하기 전에는 저장 기록을 제거하지 않는다', async () => {
    const session = createSampleSession();
    const onDeleteSession = vi.fn();

    await act(async () => {
      root.render(
        <HistoryPanel
          sessions={[session]}
          currentSessionId={session.id}
          onLoadSession={vi.fn()}
          onDeleteSession={onDeleteSession}
          onLoadSample={vi.fn()}
        />,
      );
    });

    await act(async () => getButton(container, '삭제').click());
    expect(onDeleteSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain('삭제하면 되돌릴 수 없습니다.');

    await act(async () => getButton(container, '취소').click());
    expect(onDeleteSession).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('삭제하면 되돌릴 수 없습니다.');

    await act(async () => getButton(container, '삭제').click());
    await act(async () => getButton(container, '삭제 확정').click());
    expect(onDeleteSession).toHaveBeenCalledWith(session.id);

    await act(async () => root.unmount());
    container.remove();
  });
});
