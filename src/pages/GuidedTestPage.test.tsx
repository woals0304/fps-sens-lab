import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/constants/appConstants';
import {
  getActiveExperimentTask,
  initializeExperimentState,
  recordLabRun,
} from '../lib/experiment/experimentController';
import { createSession } from '../lib/utils/sessionUtils';
import type { LabMetrics, LabRunQuality } from '../types/models';
import { GuidedTestPage } from './GuidedTestPage';

const canvasMockState = vi.hoisted(() => ({
  locked: false,
  props: null as Record<string, unknown> | null,
}));

vi.mock('../components/fps/FpsTestCanvas', async () => {
  const React = await import('react');
  const FpsTestCanvas = React.forwardRef<
    { requestPointerLock: () => Promise<boolean>; isPointerLocked: () => boolean },
    object
  >(function MockFpsTestCanvas(props, ref) {
    canvasMockState.props = props as Record<string, unknown>;
    React.useImperativeHandle(ref, () => ({
      requestPointerLock: async () => canvasMockState.locked,
      isPointerLocked: () => canvasMockState.locked,
    }));

    return React.createElement('div', { 'data-testid': 'fps-test-canvas' });
  });

  return { FpsTestCanvas };
});

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`버튼을 찾지 못했습니다: ${label}`);
  }

  return button;
}

function createFlickMetrics(): LabMetrics {
  return {
    shotCount: 6,
    hits: 5,
    misses: 1,
    hitRate: 5 / 6,
    oneShotHitRate: 4 / 6,
    averageTimeToHitMs: 540,
    averageCorrectionTimeMs: 150,
    overshootEvents: 1,
    overshootReturnCount: 1,
    reacquireCount: 1,
    firstEnterDelayMs: 210,
    preClickJitter: 0.01,
    averageOvershootAmount: 2,
  };
}

const RUN_QUALITY: LabRunQuality = {
  schemaVersion: 1,
  rawInput: true,
  maxFrameGapMs: 18,
  longFrameRatio: 0,
  frameSampleCount: 100,
  viewportWidth: 1600,
  viewportHeight: 900,
  aspectRatio: 1.7778,
  referenceAspect: true,
  horizontalFieldOfView: 103,
  verticalFieldOfView: 70.5328,
  calibrationMultiplier: 1,
};

describe('GuidedTestPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    canvasMockState.locked = false;
    canvasMockState.props = null;

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(performance.now());
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('포인터 잠금 실패 후 중단 대화상자에서 시험을 나갈 수 있다', async () => {
    const baseSession = createSession(DEFAULT_SETTINGS);
    const session = {
      ...baseSession,
      experimentState: initializeExperimentState(baseSession.settings, baseSession.testProtocol),
    };
    const onExit = vi.fn();

    await act(async () => {
      root.render(
        <GuidedTestPage
          session={session}
          onRecordLabTask={vi.fn(() => true)}
          onUpdateLabPreferences={vi.fn()}
          onOpenResults={vi.fn()}
          onExit={onExit}
        />,
      );
    });

    await act(async () => {
      getButton(container, '시험 시작').click();
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('시험이 중단됐습니다.');
    expect(document.activeElement?.textContent).toContain('현재 단계 다시 시작');

    await act(async () => {
      getButton(dialog as HTMLElement, '시험 나가기').click();
    });

    expect(onExit).toHaveBeenCalledOnce();

  });

  it('완료 안내를 800ms 보여준 뒤 다음 작업을 시작한다', async () => {
    vi.useFakeTimers();
    canvasMockState.locked = true;
    const baseSession = createSession(DEFAULT_SETTINGS);
    const session = {
      ...baseSession,
      experimentState: initializeExperimentState(baseSession.settings, baseSession.testProtocol),
    };
    const activeTask = getActiveExperimentTask(session.experimentState);

    expect(activeTask?.mode).toBe('flick');

    await act(async () => {
      root.render(
        <GuidedTestPage
          session={session}
          onRecordLabTask={vi.fn(() => true)}
          onUpdateLabPreferences={vi.fn()}
          onOpenResults={vi.fn()}
          onExit={vi.fn()}
        />,
      );
    });

    await act(async () => {
      getButton(container, '시험 시작').click();
      await Promise.resolve();
    });

    const nextSession = recordLabRun(session, activeTask!.id, createFlickMetrics(), RUN_QUALITY);
    const nextTask = getActiveExperimentTask(nextSession.experimentState);
    const onComplete = canvasMockState.props?.onComplete as
      | ((taskId: string, metrics: LabMetrics, quality: LabRunQuality) => void)
      | undefined;

    expect(onComplete).toBeTypeOf('function');
    expect(nextTask).toBeTruthy();

    await act(async () => {
      onComplete?.(activeTask!.id, createFlickMetrics(), RUN_QUALITY);
      root.render(
        <GuidedTestPage
          session={nextSession}
          onRecordLabTask={vi.fn(() => true)}
          onUpdateLabPreferences={vi.fn()}
          onOpenResults={vi.fn()}
          onExit={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[role="status"]')?.textContent).toContain('완료');
    expect(canvasMockState.props?.task).toBeNull();

    await act(async () => vi.advanceTimersByTime(799));
    expect(canvasMockState.props?.task).toBeNull();

    await act(async () => vi.advanceTimersByTime(1));
    expect((canvasMockState.props?.task as { id?: string } | null)?.id).toBe(nextTask!.id);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('완료 기록 저장에 실패하면 같은 작업을 다시 시작할 수 있게 복구한다', async () => {
    canvasMockState.locked = true;
    const baseSession = createSession(DEFAULT_SETTINGS);
    const session = {
      ...baseSession,
      experimentState: initializeExperimentState(baseSession.settings, baseSession.testProtocol),
    };
    const activeTask = getActiveExperimentTask(session.experimentState);

    await act(async () => {
      root.render(
        <GuidedTestPage
          session={session}
          onRecordLabTask={vi.fn(() => false)}
          onUpdateLabPreferences={vi.fn()}
          onOpenResults={vi.fn()}
          onExit={vi.fn()}
        />,
      );
    });

    await act(async () => {
      getButton(container, '시험 시작').click();
      await Promise.resolve();
    });

    const onComplete = canvasMockState.props?.onComplete as
      | ((taskId: string, metrics: LabMetrics, quality: LabRunQuality) => void)
      | undefined;

    await act(async () => {
      onComplete?.(activeTask!.id, createFlickMetrics(), RUN_QUALITY);
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('브라우저 저장소에 기록하지 못했습니다.');
    expect(dialog?.textContent).toContain('현재 단계 다시 시작');
  });
});
