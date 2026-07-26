import { SCORE_WEIGHTS } from '../constants/appConstants';
import { clampScore, roundTo } from '../utils/numberUtils';

interface WeightedScoreInput {
  accuracyScore: number;
  trackingComfort: number;
  flickComfort: number;
  overshoot: number;
  overallFeeling: number;
}

export function calculateWeightedScore(input: WeightedScoreInput): number {
  // 혹시 이상한 값이 들어와도 0~100 사이로 먼저 정리합니다.
  const accuracyScore = clampScore(input.accuracyScore);
  const trackingComfort = clampScore(input.trackingComfort);
  const flickComfort = clampScore(input.flickComfort);
  const overshoot = clampScore(input.overshoot);
  const overallFeeling = clampScore(input.overallFeeling);

  // MVP에서는 복잡한 AI 대신, 고정 가중치로 바로 계산합니다.
  const score =
    SCORE_WEIGHTS.accuracy * accuracyScore +
    SCORE_WEIGHTS.tracking * trackingComfort +
    SCORE_WEIGHTS.flick * flickComfort +
    SCORE_WEIGHTS.overall * overallFeeling -
    SCORE_WEIGHTS.overshootPenalty * overshoot;

  return roundTo(score, 2);
}
