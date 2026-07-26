import { describe, expect, it } from 'vitest';
import {
  calculateAutoWeightedScore,
  combineManualAndAutoScores,
  scoreTrackingMetrics,
  scoreTurnMetrics,
} from './calculateAutoWeightedScore';

describe('calculateAutoWeightedScore', () => {
  it('자동 측정 점수를 계산한다', () => {
    const result = calculateAutoWeightedScore({
      flickMetrics: {
        shotCount: 20,
        hits: 18,
        misses: 2,
        hitRate: 0.875,
        oneShotHitRate: 0.72,
        averageTimeToHitMs: 520,
        averageCorrectionTimeMs: 160,
        overshootEvents: 1,
        overshootReturnCount: 1,
        reacquireCount: 1,
        firstEnterDelayMs: 220,
        preClickJitter: 0.01,
        averageOvershootAmount: 2.2,
      },
      trackingMetrics: {
        durationMs: 15000,
        averageCrosshairDistanceDeg: 2.1,
        timeOnTargetRatio: 0.8,
        followStability: 84,
        movementSmoothness: 81,
        trackingLossCount: 2,
        averageCorrectionFrequency: 1.2,
      },
      turnMetrics: {
        instructionCount: 10,
        completionRate: 1,
        completionTimeMs: 910,
        angularErrorDeg: 2.5,
        overshootAngleDeg: 6,
        correctionCount: 1,
        stabilizationTimeMs: 180,
      },
    });

    expect(result.autoWeightedScore).not.toBeNull();
    expect(result.flickScore).toBeGreaterThan(70);
    expect(result.trackingScore).toBeGreaterThan(70);
    expect(result.turnScore).toBeGreaterThan(70);
  });

  it('수동 점수와 자동 점수를 결합한다', () => {
    expect(combineManualAndAutoScores(80, 60)).toBeGreaterThan(70);
  });

  it('한 번도 맞히지 못한 플릭을 빠른 반응으로 보상하지 않는다', () => {
    const result = calculateAutoWeightedScore({
      flickMetrics: {
        shotCount: 8,
        hits: 0,
        misses: 8,
        hitRate: 0,
        oneShotHitRate: 0,
        averageTimeToHitMs: 0,
        averageCorrectionTimeMs: 0,
        overshootEvents: 0,
        overshootReturnCount: 0,
        reacquireCount: 0,
        firstEnterDelayMs: 0,
        preClickJitter: 0,
        averageOvershootAmount: 0,
      },
      trackingMetrics: null,
      turnMetrics: null,
    });

    expect(result.flickScore).toBe(0);
    expect(result.smoothnessScore).toBe(0);
    expect(result.autoWeightedScore).toBe(0);
  });

  it('비정상 측정값을 역방향 지표의 최고점으로 계산하지 않는다', () => {
    expect(
      scoreTrackingMetrics({
        durationMs: 15000,
        averageCrosshairDistanceDeg: Number.NaN,
        timeOnTargetRatio: 0,
        followStability: 0,
        movementSmoothness: 0,
        trackingLossCount: Number.POSITIVE_INFINITY,
        averageCorrectionFrequency: Number.NaN,
      }),
    ).toBe(0);

    expect(
      scoreTurnMetrics({
        instructionCount: 10,
        completionRate: 1,
        completionTimeMs: Number.NaN,
        angularErrorDeg: Number.NaN,
        overshootAngleDeg: Number.NaN,
        correctionCount: Number.NaN,
        stabilizationTimeMs: Number.NaN,
      }),
    ).toBe(28);
  });
});
