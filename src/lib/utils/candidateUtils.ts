import type { AppSettings, SensitivityCandidate } from '../../types/models';
import {
  addSensitivityStep,
  clampSensitivity,
  compareSensitivity,
  normalizeSensitivity,
} from './sensitivity';

export function generateCandidates(settings: AppSettings): SensitivityCandidate[] {
  // Set을 쓰면 같은 숫자가 두 번 들어와도 자동으로 한 번만 남습니다.
  const values = new Set<number>();
  const { minSensitivity, maxSensitivity, step, currentSensitivity } = settings;

  if (step <= 0 || minSensitivity >= maxSensitivity) {
    return [];
  }

  const normalizedMin = clampSensitivity(minSensitivity);
  const normalizedMax = clampSensitivity(maxSensitivity);
  const normalizedStep = normalizeSensitivity(step);

  if (normalizedStep <= 0 || normalizedMin >= normalizedMax) {
    return [];
  }

  let value = normalizedMin;

  while (value <= normalizedMax) {
    // 감도는 항상 0.01 단위로 정규화해서 2.6000000001 같은 값을 막습니다.
    values.add(normalizeSensitivity(value));
    const nextValue = addSensitivityStep(value, normalizedStep);
    if (nextValue <= value) {
      break;
    }
    value = nextValue;
  }

  // 간격이 범위를 정확히 나누지 못해도 설정한 끝값은 후보로 보존합니다.
  values.add(normalizedMax);

  // 현재 감도가 범위 밖이어도 비교 후보에는 꼭 넣어 줍니다.
  values.add(clampSensitivity(currentSensitivity));

  return Array.from(values)
    .sort((left, right) => compareSensitivity(left, right))
    .map((value, index) => ({
      value,
      index,
    }));
}

export function getCandidateValues(settings: AppSettings): number[] {
  return generateCandidates(settings).map((candidate) => candidate.value);
}
