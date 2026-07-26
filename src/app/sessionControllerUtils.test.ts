import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/constants/appConstants';
import { recordLabRun } from '../lib/experiment/experimentController';
import { createSession } from '../lib/utils/sessionUtils';
import type { FlickMetrics } from '../types/models';
import { resolveCurrentSession } from './sessionControllerUtils';

const FLICK_METRICS: FlickMetrics = {
  shotCount: 20,
  hits: 18,
  misses: 2,
  hitRate: 0.9,
  oneShotHitRate: 0.8,
  averageTimeToHitMs: 520,
  averageCorrectionTimeMs: 160,
  overshootEvents: 1,
  overshootReturnCount: 1,
  reacquireCount: 1,
  firstEnterDelayMs: 220,
  preClickJitter: 0.01,
  averageOvershootAmount: 2.1,
};

describe('resolveCurrentSession', () => {
  it('작업이 없는 구형 세션도 화면과 기록에서 같은 작업 ID를 사용한다', () => {
    const legacySession = createSession(DEFAULT_SETTINGS);
    const resolved = resolveCurrentSession([legacySession], legacySession.id);
    const task = resolved?.experimentState.tasks.find((item) => item.mode === 'flick');

    expect(task).toBeDefined();

    const recorded = recordLabRun(resolved!, task!.id, FLICK_METRICS);

    expect(recorded.labRuns).toHaveLength(1);
    expect(recorded.labRuns[0].taskId).toBe(task!.id);
  });
});
