import type { DuelMatch, SensitivityLabSummary } from '../../types/models';

function getPairKey(left: number, right: number): string {
  return [left, right].sort((a, b) => a - b).join(':');
}

function orderPair(left: number, right: number): [number, number] {
  return left <= right ? [left, right] : [right, left];
}

export function generateDuelPairs(
  summaries: SensitivityLabSummary[],
  duelMatches: DuelMatch[],
): Array<[number, number]> {
  const seenPairs = new Set(duelMatches.map((match) => getPairKey(match.candidateA, match.candidateB)));
  const ranked = [...summaries]
    .filter((summary) => summary.combinedWeightedScore !== null)
    .sort(
      (left, right) =>
        (right.combinedWeightedScore ?? 0) - (left.combinedWeightedScore ?? 0) ||
        left.sensitivity - right.sensitivity,
    )
    .slice(0, 5);

  if (ranked.length < 2) {
    return [];
  }

  const pairs: Array<[number, number]> = [];
  const best = ranked[0];
  const farthest = [...ranked].sort(
    (left, right) =>
      Math.abs(right.sensitivity - best.sensitivity) - Math.abs(left.sensitivity - best.sensitivity) ||
      left.sensitivity - right.sensitivity,
  )[0];
  const second = ranked[1];
  const third = ranked[2] ?? null;
  const candidates: Array<[number, number]> = [];

  if (farthest && farthest.sensitivity !== best.sensitivity) {
    candidates.push(orderPair(best.sensitivity, farthest.sensitivity));
  }

  candidates.push(orderPair(best.sensitivity, second.sensitivity));

  if (third) {
    candidates.push(orderPair(best.sensitivity, third.sensitivity));
    candidates.push(orderPair(second.sensitivity, third.sensitivity));
  }

  for (const pair of candidates) {
    const key = getPairKey(pair[0], pair[1]);

    if (!seenPairs.has(key) && !pairs.some((current) => getPairKey(current[0], current[1]) === key)) {
      pairs.push(pair);
    }
  }

  return pairs.slice(0, 3);
}
