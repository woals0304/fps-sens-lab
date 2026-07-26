import { describe, expect, it } from 'vitest';
import { parseAiPredictionPayload } from './aiPrediction';

describe('parseAiPredictionPayload', () => {
  it('유효한 AI 예측 값을 정규화한다', () => {
    expect(
      parseAiPredictionPayload({
        predictedBestSensitivity: 2.345,
        recommendedNextPair: [2.22, 99],
        confidence: 1.4,
        generatedAt: '2026-03-14T00:00:00.000Z',
      }),
    ).toEqual({
      predictedBestSensitivity: 2.35,
      recommendedNextPair: [2.22, 8],
      confidence: 1,
      generatedAt: '2026-03-14T00:00:00.000Z',
    });
  });

  it('필수 숫자가 유한하지 않으면 거부한다', () => {
    expect(
      parseAiPredictionPayload({
        predictedBestSensitivity: Number.NaN,
        confidence: 0.5,
      }),
    ).toBeNull();

    expect(
      parseAiPredictionPayload({
        predictedBestSensitivity: 2.3,
        confidence: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
  });
});
