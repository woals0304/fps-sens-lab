import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleSession } from '../data/sampleSessions';
import { ResultSummaryCard } from './ResultSummaryCard';

describe('ResultSummaryCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  it('확정되지 않은 안정 범위를 단정하지 않고 바로 적용할 행동을 보여 준다', async () => {
    const sample = createSampleSession();
    const session = {
      ...sample,
      recommendation: {
        ...sample.recommendation,
        safeRange: null,
      },
      analysisSummary: {
        ...sample.analysisSummary,
        explanationLines: ['2.10~2.70 구간에서 가장 안정적인 결과가 나왔습니다.'],
      },
    };

    await act(async () => {
      root.render(
        <ResultSummaryCard
          session={session}
          detailOpen={false}
          onRetry={vi.fn()}
          onToggleDetails={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('안정 범위는 이번 측정에서 확정하지 못했습니다.');
    expect(container.textContent).not.toContain('2.10~2.70 구간에서 가장 안정적인 결과');
    expect(container.textContent).toContain('감도 2.30 복사');
    expect(container.textContent).toContain('판단 보류');

    await act(async () => root.unmount());
    container.remove();
  });
});
