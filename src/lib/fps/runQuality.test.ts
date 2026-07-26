import { describe, expect, it } from 'vitest';
import { INVALID_FRAME_GAP_MS, RunQualityTracker } from './runQuality';

describe('RunQualityTracker', () => {
  it('250ms 이상의 프레임 공백을 측정 무효 사유로 판단한다', () => {
    const tracker = new RunQualityTracker();
    tracker.reset(1000);

    expect(tracker.recordFrame(1016).invalid).toBe(false);
    expect(tracker.recordFrame(1016 + INVALID_FRAME_GAP_MS).invalid).toBe(true);
  });

  it('입력 이벤트에서도 마지막 렌더 프레임 기준 250ms 경계를 확인한다', () => {
    const tracker = new RunQualityTracker();
    tracker.reset(1000);

    expect(tracker.getGapSinceLastFrame(1249)).toBe(249);
    expect(tracker.getGapSinceLastFrame(1250)).toBe(INVALID_FRAME_GAP_MS);
  });

  it('프레임 품질과 16:9 기준 여부를 스냅샷으로 남긴다', () => {
    const tracker = new RunQualityTracker();
    tracker.reset(0);
    tracker.recordFrame(16);
    tracker.recordFrame(76);

    expect(
      tracker.buildSnapshot({
        rawInput: true,
        viewportWidth: 1600,
        viewportHeight: 900,
        horizontalFieldOfView: 103,
        verticalFieldOfView: 70.5328,
        calibrationMultiplier: 1,
      }),
    ).toMatchObject({
      schemaVersion: 1,
      rawInput: true,
      maxFrameGapMs: 60,
      longFrameRatio: 0.5,
      frameSampleCount: 2,
      aspectRatio: 1.7778,
      referenceAspect: true,
      horizontalFieldOfView: 103,
      verticalFieldOfView: 70.5328,
      calibrationMultiplier: 1,
    });
  });

  it('비16:9 화면은 기록하되 그 자체로 측정을 무효화하지 않는다', () => {
    const tracker = new RunQualityTracker();
    tracker.reset(0);
    const frame = tracker.recordFrame(16);
    const snapshot = tracker.buildSnapshot({
      rawInput: false,
      viewportWidth: 1280,
      viewportHeight: 1024,
      horizontalFieldOfView: 103,
      verticalFieldOfView: 86.5606,
      calibrationMultiplier: 0.95,
    });

    expect(frame.invalid).toBe(false);
    expect(snapshot.referenceAspect).toBe(false);
  });
});
