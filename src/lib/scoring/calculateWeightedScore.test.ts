import { describe, expect, it } from 'vitest';
import { calculateWeightedScore } from './calculateWeightedScore';

describe('calculateWeightedScore', () => {
  it('가중치 상수대로 점수를 계산한다', () => {
    const score = calculateWeightedScore({
      accuracyScore: 80,
      trackingComfort: 70,
      flickComfort: 60,
      overshoot: 20,
      overallFeeling: 90,
    });

    expect(score).toBe(66);
  });
});
