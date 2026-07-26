import { AUTO_SCORE_WEIGHTS } from '../constants/appConstants';
import type { FlickMetrics, TrackingMetrics, TurnMetrics } from '../../types/models';
import { clamp, clampScore, roundTo } from '../utils/numberUtils';

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function scaleValue(value: number, min: number, max: number, invert = false): number {
  if (max <= min) {
    return 50;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  const ratio = clamp((value - min) / (max - min), 0, 1);
  const score = invert ? 1 - ratio : ratio;
  return roundTo(score * 100, 2);
}

export function scoreFlickMetrics(metrics: FlickMetrics | null): number | null {
  if (!metrics) {
    return null;
  }

  if (metrics.shotCount <= 0 || metrics.hits <= 0 || metrics.hitRate <= 0) {
    return 0;
  }

  const hitRateScore = safeNumber(metrics.hitRate) * 100;
  const oneShotScore = safeNumber(metrics.oneShotHitRate) * 100;
  const timeScore = scaleValue(metrics.averageTimeToHitMs, 180, 1800, true);
  const correctionScore = scaleValue(metrics.averageCorrectionTimeMs, 40, 900, true);
  const jitterScore = scaleValue(metrics.preClickJitter, 0.002, 0.03, true);
  const overshootSizeScore = scaleValue(metrics.averageOvershootAmount, 0.5, 12, true);

  return roundTo(
    clampScore(
      hitRateScore * 0.3 +
        oneShotScore * 0.18 +
        timeScore * 0.18 +
        correctionScore * 0.14 +
        jitterScore * 0.1 +
        overshootSizeScore * 0.1,
    ),
    2,
  );
}

export function scoreTrackingMetrics(metrics: TrackingMetrics | null): number | null {
  if (!metrics) {
    return null;
  }

  const timeOnTargetScore = safeNumber(metrics.timeOnTargetRatio) * 100;
  const distanceScore = scaleValue(metrics.averageCrosshairDistanceDeg, 0.5, 10, true);
  const stabilityScore = clampScore(metrics.followStability);
  const smoothnessScore = clampScore(metrics.movementSmoothness);
  const lossScore = scaleValue(metrics.trackingLossCount, 0, 20, true);
  const correctionScore = scaleValue(metrics.averageCorrectionFrequency, 0.2, 4.5, true);

  return roundTo(
    clampScore(
      timeOnTargetScore * 0.28 +
        distanceScore * 0.22 +
        stabilityScore * 0.18 +
        smoothnessScore * 0.14 +
        lossScore * 0.1 +
        correctionScore * 0.08,
    ),
    2,
  );
}

export function scoreTurnMetrics(metrics: TurnMetrics | null): number | null {
  if (!metrics) {
    return null;
  }

  const completionScore = safeNumber(metrics.completionRate) * 100;
  const timeScore = scaleValue(metrics.completionTimeMs, 350, 2600, true);
  const errorScore = scaleValue(metrics.angularErrorDeg, 0, 30, true);
  const overshootScore = scaleValue(metrics.overshootAngleDeg, 0, 45, true);
  const correctionScore = scaleValue(metrics.correctionCount, 0, 12, true);
  const stabilizationScore = scaleValue(metrics.stabilizationTimeMs, 80, 1200, true);

  return roundTo(
    clampScore(
      completionScore * 0.28 +
        timeScore * 0.22 +
        errorScore * 0.18 +
        overshootScore * 0.14 +
        correctionScore * 0.08 +
        stabilizationScore * 0.1,
    ),
    2,
  );
}

export function getHitRateScore(metrics: FlickMetrics | null): number | null {
  if (!metrics) {
    return null;
  }

  return roundTo(clampScore(metrics.hitRate * 100), 2);
}

export function getSmoothnessScore(
  trackingMetrics: TrackingMetrics | null,
  flickMetrics: FlickMetrics | null,
): number | null {
  if (trackingMetrics) {
    return roundTo(clampScore(trackingMetrics.movementSmoothness), 2);
  }

  if (flickMetrics) {
    if (flickMetrics.shotCount <= 0 || flickMetrics.hits <= 0 || flickMetrics.hitRate <= 0) {
      return 0;
    }

    return roundTo(scaleValue(flickMetrics.preClickJitter, 0.002, 0.03, true), 2);
  }

  return null;
}

export function getOvershootPenalty(
  flickMetrics: FlickMetrics | null,
  turnMetrics: TurnMetrics | null,
): number {
  const flickPenalty = flickMetrics
    ? scaleValue(
        flickMetrics.averageOvershootAmount + flickMetrics.overshootReturnCount * 0.8,
        0,
        12,
      )
    : 0;
  const turnPenalty = turnMetrics
    ? scaleValue(turnMetrics.overshootAngleDeg + turnMetrics.correctionCount * 2, 0, 50)
    : 0;

  return roundTo((flickPenalty + turnPenalty) / (flickMetrics && turnMetrics ? 2 : 1), 2);
}

export function calculateAutoWeightedScore(input: {
  flickMetrics: FlickMetrics | null;
  trackingMetrics: TrackingMetrics | null;
  turnMetrics: TurnMetrics | null;
}): {
  flickScore: number | null;
  trackingScore: number | null;
  turnScore: number | null;
  hitRateScore: number | null;
  smoothnessScore: number | null;
  overshootPenalty: number;
  autoWeightedScore: number | null;
} {
  const flickScore = scoreFlickMetrics(input.flickMetrics);
  const trackingScore = scoreTrackingMetrics(input.trackingMetrics);
  const turnScore = scoreTurnMetrics(input.turnMetrics);
  const hitRateScore = getHitRateScore(input.flickMetrics);
  const smoothnessScore = getSmoothnessScore(input.trackingMetrics, input.flickMetrics);
  const overshootPenalty = getOvershootPenalty(input.flickMetrics, input.turnMetrics);

  const weightedParts: Array<{ score: number; weight: number }> = [];

  if (flickScore !== null) {
    weightedParts.push({ score: flickScore, weight: AUTO_SCORE_WEIGHTS.flick });
  }

  if (trackingScore !== null) {
    weightedParts.push({ score: trackingScore, weight: AUTO_SCORE_WEIGHTS.tracking });
  }

  if (turnScore !== null) {
    weightedParts.push({ score: turnScore, weight: AUTO_SCORE_WEIGHTS.turn });
  }

  if (weightedParts.length === 0) {
    return {
      flickScore,
      trackingScore,
      turnScore,
      hitRateScore,
      smoothnessScore,
      overshootPenalty,
      autoWeightedScore: null,
    };
  }

  const weightSum = weightedParts.reduce((total, item) => total + item.weight, 0);
  const baseScore =
    weightedParts.reduce((total, item) => total + item.score * item.weight, 0) / weightSum;
  const finalScore = clampScore(baseScore - overshootPenalty * AUTO_SCORE_WEIGHTS.overshootPenalty);

  return {
    flickScore,
    trackingScore,
    turnScore,
    hitRateScore,
    smoothnessScore,
    overshootPenalty,
    autoWeightedScore: roundTo(finalScore, 2),
  };
}

export function combineManualAndAutoScores(
  autoWeightedScore: number | null,
  manualWeightedScore: number | null,
): number | null {
  if (autoWeightedScore === null && manualWeightedScore === null) {
    return null;
  }

  if (autoWeightedScore === null) {
    return manualWeightedScore;
  }

  if (manualWeightedScore === null) {
    return autoWeightedScore;
  }

  return roundTo(
    autoWeightedScore * (1 - AUTO_SCORE_WEIGHTS.manualBlend) +
      manualWeightedScore * AUTO_SCORE_WEIGHTS.manualBlend,
    2,
  );
}
