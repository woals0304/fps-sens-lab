import { describe, expect, it } from 'vitest';
import { buildDuelScoreMap, getDuelProgress } from './duelEngine';

describe('getDuelProgress', () => {
  it('coarse 단계에서 A가 이기면 상한을 줄인다', () => {
    const progress = getDuelProgress([1, 2, 3, 4, 5, 6, 7], [
      {
        candidateA: 2,
        candidateB: 6,
        choice: 'A',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(progress.phase).toBe('coarse');
    expect(progress.remainingCandidates).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('coarse 단계에서 B가 이기면 하한을 올린다', () => {
    const progress = getDuelProgress([1, 2, 3, 4, 5, 6, 7], [
      {
        candidateA: 2,
        candidateB: 6,
        choice: 'B',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(progress.phase).toBe('coarse');
    expect(progress.remainingCandidates).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('coarse 기록의 A/B가 뒤집혀도 실제 승리 감도의 방향으로 범위를 줄인다', () => {
    const progress = getDuelProgress([1, 2, 3, 4, 5, 6, 7], [
      {
        candidateA: 6,
        candidateB: 2,
        choice: 'A',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(progress.remainingCandidates).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('현재 예상 쌍과 다른 과거 기록은 진행 상태에 적용하지 않는다', () => {
    const progress = getDuelProgress([1, 2, 3, 4, 5, 6, 7], [
      {
        candidateA: 1,
        candidateB: 7,
        choice: 'A',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(progress.remainingCandidates).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(progress.currentPair).toEqual({ candidateA: 2, candidateB: 6 });
  });

  it('coarse 단계에서 비슷하면 가운데 범위만 남긴다', () => {
    const progress = getDuelProgress([1, 2, 3, 4, 5, 6, 7], [
      {
        candidateA: 2,
        candidateB: 6,
        choice: 'SIMILAR',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(progress.remainingCandidates).toEqual([2, 3, 4, 5, 6]);
    expect(progress.phase).toBe('fine');
  });

  it('fine 단계에서 인접 감도를 다음 비교로 고른다', () => {
    const progress = getDuelProgress([2.1, 2.3, 2.5, 2.7, 2.9], []);

    expect(progress.phase).toBe('fine');
    expect(progress.currentPair).toEqual({
      candidateA: 2.5,
      candidateB: 2.3,
    });
  });
});

describe('buildDuelScoreMap', () => {
  it('승패 결과를 점수로 모은다', () => {
    const scoreMap = buildDuelScoreMap([
      {
        candidateA: 2.1,
        candidateB: 2.5,
        choice: 'A',
        note: '',
        playedAt: new Date().toISOString(),
      },
      {
        candidateA: 2.1,
        candidateB: 2.3,
        choice: 'SIMILAR',
        note: '',
        playedAt: new Date().toISOString(),
      },
    ]);

    expect(scoreMap.get(2.1)).toBe(1.5);
    expect(scoreMap.get(2.5)).toBe(-0.25);
    expect(scoreMap.get(2.3)).toBe(0.5);
  });
});
