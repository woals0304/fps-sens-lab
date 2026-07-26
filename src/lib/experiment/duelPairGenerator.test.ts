import { describe, expect, it } from 'vitest';
import { generateDuelPairs } from './duelPairGenerator';

describe('generateDuelPairs', () => {
  it('이미 비교한 쌍을 피하면서 상위 후보 페어를 만든다', () => {
    const pairs = generateDuelPairs(
      [
        {
          sensitivity: 2.1,
          flickMetrics: null,
          trackingMetrics: null,
          turnMetrics: null,
          flickScore: 70,
          trackingScore: 72,
          turnScore: 69,
          hitRateScore: 72,
          smoothnessScore: 74,
          overshootPenalty: 2,
          autoWeightedScore: 71,
          manualWeightedScore: 68,
          combinedWeightedScore: 70,
          interpretationTags: ['balanced'],
          runCount: 3,
        },
        {
          sensitivity: 2.3,
          flickMetrics: null,
          trackingMetrics: null,
          turnMetrics: null,
          flickScore: 82,
          trackingScore: 80,
          turnScore: 78,
          hitRateScore: 84,
          smoothnessScore: 82,
          overshootPenalty: 1,
          autoWeightedScore: 81,
          manualWeightedScore: 79,
          combinedWeightedScore: 80,
          interpretationTags: ['stable_zone'],
          runCount: 3,
        },
        {
          sensitivity: 2.5,
          flickMetrics: null,
          trackingMetrics: null,
          turnMetrics: null,
          flickScore: 76,
          trackingScore: 68,
          turnScore: 73,
          hitRateScore: 74,
          smoothnessScore: 70,
          overshootPenalty: 5,
          autoWeightedScore: 70,
          manualWeightedScore: 69,
          combinedWeightedScore: 69,
          interpretationTags: ['too_fast'],
          runCount: 3,
        },
      ],
      [
        {
          candidateA: 2.3,
          candidateB: 2.5,
          choice: 'A',
          note: '',
          playedAt: new Date().toISOString(),
        },
      ],
    );

    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.some((pair) => pair.includes(2.3) && pair.includes(2.5))).toBe(false);
    expect(pairs.every(([candidateA, candidateB]) => candidateA < candidateB)).toBe(true);
  });
});
