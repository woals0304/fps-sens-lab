import { FINE_TUNE_THRESHOLD } from '../constants/appConstants';
import type { DuelMatch, DuelProgress } from '../../types/models';

function sortCandidates(values: number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

function getPairKey(left: number, right: number): string {
  return [left, right].sort((a, b) => a - b).join(':');
}

function getCoarsePair(values: number[]): { aIndex: number; bIndex: number } | null {
  if (values.length < 2) {
    return null;
  }

  // 넓은 탐색에서는 대충 25% 지점과 75% 지점을 비교합니다.
  let aIndex = Math.floor((values.length - 1) * 0.25);
  let bIndex = Math.ceil((values.length - 1) * 0.75);

  if (aIndex === bIndex) {
    aIndex = 0;
    bIndex = values.length - 1;
  }

  return { aIndex, bIndex };
}

type CoarseOutcome = 'lower' | 'higher' | 'similar';

function isExpectedPair(
  match: DuelMatch,
  expected: { candidateA: number; candidateB: number },
): boolean {
  return getPairKey(match.candidateA, match.candidateB) === getPairKey(expected.candidateA, expected.candidateB);
}

function getCoarseOutcome(match: DuelMatch): CoarseOutcome | null {
  if (match.choice === 'SIMILAR') {
    return 'similar';
  }

  const winner = match.choice === 'A' ? match.candidateA : match.candidateB;
  const loser = match.choice === 'A' ? match.candidateB : match.candidateA;

  if (winner === loser) {
    return null;
  }

  return winner < loser ? 'lower' : 'higher';
}

function applyCoarseOutcome(
  values: number[],
  outcome: CoarseOutcome,
  pair: { aIndex: number; bIndex: number },
): number[] {
  if (outcome === 'lower') {
    return values.slice(0, pair.bIndex + 1);
  }

  if (outcome === 'higher') {
    return values.slice(pair.aIndex);
  }

  return values.slice(pair.aIndex, pair.bIndex + 1);
}

function getInitialFineFocus(values: number[], matches: DuelMatch[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const reversed = [...matches].reverse();

  // 최근 승자부터 뒤에서 찾아보면, 지금 유력 후보를 쉽게 잡을 수 있습니다.
  for (const match of reversed) {
    if (match.choice === 'A' && values.includes(match.candidateA)) {
      return match.candidateA;
    }

    if (match.choice === 'B' && values.includes(match.candidateB)) {
      return match.candidateB;
    }

    if (match.choice === 'SIMILAR') {
      if (values.includes(match.candidateA)) {
        return match.candidateA;
      }

      if (values.includes(match.candidateB)) {
        return match.candidateB;
      }
    }
  }

  return values[Math.floor(values.length / 2)];
}

function getNextFinePair(
  values: number[],
  focus: number | null,
  comparedPairs: Set<string>,
): { candidateA: number; candidateB: number } | null {
  if (focus === null || values.length < 2) {
    return null;
  }

  // 미세 조정에서는 포커스 감도와 가장 가까운 이웃부터 비교합니다.
  const ranked = values
    .filter((value) => value !== focus)
    .sort((left, right) => {
      const distanceDiff = Math.abs(left - focus) - Math.abs(right - focus);

      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      return left - right;
    });

  for (const candidate of ranked) {
    const pairKey = getPairKey(focus, candidate);

    if (!comparedPairs.has(pairKey)) {
      return {
        candidateA: focus,
        candidateB: candidate,
      };
    }
  }

  return null;
}

export function getDuelProgress(candidateValues: number[], matches: DuelMatch[]): DuelProgress {
  const ordered = sortCandidates(candidateValues);
  let remaining = ordered;
  let phase: DuelProgress['phase'] = ordered.length <= FINE_TUNE_THRESHOLD ? 'fine' : 'coarse';
  let focus = getInitialFineFocus(remaining, []);
  const comparedPairs = new Set<string>();
  const similarPairs: Array<[number, number]> = [];
  const acceptedMatches: DuelMatch[] = [];

  // 과거 기록을 처음부터 다시 따라가면서 지금 단계와 남은 범위를 재구성합니다.
  for (const match of matches) {
    if (phase === 'coarse' && remaining.length > FINE_TUNE_THRESHOLD) {
      const pair = getCoarsePair(remaining);

      if (!pair) {
        return {
          phase: 'done',
          remainingCandidates: remaining,
          focusSensitivity: focus,
          currentPair: null,
          similarPairs,
        };
      }

      const expectedPair = {
        candidateA: remaining[pair.aIndex],
        candidateB: remaining[pair.bIndex],
      };
      const outcome = getCoarseOutcome(match);

      if (!isExpectedPair(match, expectedPair) || outcome === null) {
        continue;
      }

      remaining = applyCoarseOutcome(remaining, outcome, pair);
      acceptedMatches.push(match);

      if (remaining.length <= FINE_TUNE_THRESHOLD) {
        phase = 'fine';
        focus = getInitialFineFocus(remaining, acceptedMatches);
      }

      continue;
    }

    phase = 'fine';
    const expectedPair = getNextFinePair(remaining, focus, comparedPairs);

    if (!expectedPair || !isExpectedPair(match, expectedPair)) {
      continue;
    }

    comparedPairs.add(getPairKey(expectedPair.candidateA, expectedPair.candidateB));
    acceptedMatches.push(match);

    if (match.choice === 'A') {
      focus = match.candidateA;
    } else if (match.choice === 'B') {
      focus = match.candidateB;
    } else {
      focus = focus ?? match.candidateA;
      similarPairs.push(
        [match.candidateA, match.candidateB].sort((left, right) => left - right) as [number, number],
      );
    }
  }

  if (remaining.length < 2) {
    return {
      phase: 'done',
      remainingCandidates: remaining,
      focusSensitivity: remaining[0] ?? null,
      currentPair: null,
      similarPairs,
    };
  }

  if (phase === 'coarse' && remaining.length > FINE_TUNE_THRESHOLD) {
    const pair = getCoarsePair(remaining);

    if (!pair) {
      return {
        phase: 'done',
        remainingCandidates: remaining,
        focusSensitivity: focus,
        currentPair: null,
        similarPairs,
      };
    }

    return {
      phase,
      remainingCandidates: remaining,
      focusSensitivity: focus,
      currentPair: {
        candidateA: remaining[pair.aIndex],
        candidateB: remaining[pair.bIndex],
      },
      similarPairs,
    };
  }

  const nextFocus = focus ?? getInitialFineFocus(remaining, acceptedMatches);
  const currentPair = getNextFinePair(remaining, nextFocus, comparedPairs);

  if (!currentPair) {
    return {
      phase: 'done',
      remainingCandidates: remaining,
      focusSensitivity: nextFocus,
      currentPair: null,
      similarPairs,
    };
  }

  return {
    phase: 'fine',
    remainingCandidates: remaining,
    focusSensitivity: nextFocus,
    currentPair,
    similarPairs,
  };
}

export function buildDuelScoreMap(matches: DuelMatch[]): Map<number, number> {
  const scores = new Map<number, number>();

  // 듀얼 비교는 간단한 승점판처럼 합산합니다.
  for (const match of matches) {
    const aScore = scores.get(match.candidateA) ?? 0;
    const bScore = scores.get(match.candidateB) ?? 0;

    if (match.choice === 'A') {
      scores.set(match.candidateA, aScore + 1);
      scores.set(match.candidateB, bScore - 0.25);
    } else if (match.choice === 'B') {
      scores.set(match.candidateA, aScore - 0.25);
      scores.set(match.candidateB, bScore + 1);
    } else {
      scores.set(match.candidateA, aScore + 0.5);
      scores.set(match.candidateB, bScore + 0.5);
    }
  }

  return scores;
}
