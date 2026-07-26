import type { AiPrediction } from '../../types/models';
import { clamp } from './numberUtils';
import { clampSensitivity } from './sensitivity';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSensitivity(value: unknown): number | null {
  return isFiniteNumber(value) ? clampSensitivity(value) : null;
}

function parseRecommendedNextPair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const left = parseSensitivity(value[0]);
  const right = parseSensitivity(value[1]);

  return left !== null && right !== null ? [left, right] : null;
}

export function parseAiPredictionPayload(value: unknown): AiPrediction | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const predictedBestSensitivity = parseSensitivity(record.predictedBestSensitivity);

  if (predictedBestSensitivity === null || !isFiniteNumber(record.confidence)) {
    return null;
  }

  return {
    predictedBestSensitivity,
    recommendedNextPair: parseRecommendedNextPair(record.recommendedNextPair),
    confidence: clamp(record.confidence, 0, 1),
    generatedAt: typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString(),
  };
}
