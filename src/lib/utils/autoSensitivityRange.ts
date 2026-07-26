import {
  AUTO_RANGE_MAX_OFFSET,
  AUTO_RANGE_MIN_OFFSET,
  AUTO_RANGE_PERCENT,
  DEFAULT_SETTINGS,
  FOCUSED_PROBE_MAX_STEP,
  FOCUSED_PROBE_MIN_STEP,
  MIN_ALLOWED_SENSITIVITY,
} from '../constants/appConstants';
import { buildFocusedCandidates, buildWideProbeCandidates } from '../experiment/searchStrategy';
import type { AppSettings } from '../../types/models';
import { clamp } from './numberUtils';
import {
  addSensitivityStep,
  clampSensitivity,
  compareSensitivity,
  getFineTuneStep,
  normalizeSensitivity,
} from './sensitivity';

function roundToNearestStep(value: number, step: number): number {
  const safeStep = step > 0 ? step : 0.01;
  return normalizeSensitivity(Math.round(value / safeStep) * safeStep);
}

function dedupeSorted(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => normalizeSensitivity(value)))).sort((left, right) =>
    compareSensitivity(left, right),
  );
}

export function getAutoRangeOffset(currentSensitivity: number): number {
  // 현재 감도는 단서일 뿐이지만, 화면에 보여 줄 기본 범위는 너무 좁지도 넓지도 않게 잡습니다.
  const normalizedCurrent = normalizeSensitivity(currentSensitivity);
  const rawOffset = normalizedCurrent * AUTO_RANGE_PERCENT;
  const clampedOffset = clamp(rawOffset, AUTO_RANGE_MIN_OFFSET, AUTO_RANGE_MAX_OFFSET);
  const step = clampedOffset <= 0.25 ? 0.05 : 0.1;

  return roundToNearestStep(clampedOffset, step);
}

export function getInitialSensitivityStep(currentSensitivity: number): number {
  const offset = getAutoRangeOffset(currentSensitivity);
  return offset <= 0.25 ? 0.05 : 0.1;
}

export function buildInitialSensitivityCandidates(currentSensitivity: number): number[] {
  const center = clampSensitivity(
    Number.isFinite(currentSensitivity) ? currentSensitivity : DEFAULT_SETTINGS.currentSensitivity,
  );

  return buildWideProbeCandidates(center);
}

export function buildAutoSensitivitySettings(draft: AppSettings): AppSettings {
  const currentSensitivity = clampSensitivity(
    Number.isFinite(draft.currentSensitivity) ? draft.currentSensitivity : DEFAULT_SETTINGS.currentSensitivity,
  );
  const candidates = buildInitialSensitivityCandidates(currentSensitivity);

  return {
    ...draft,
    currentSensitivity,
    minSensitivity: candidates[0],
    maxSensitivity: candidates[candidates.length - 1],
    step: getInitialSensitivityStep(currentSensitivity),
  };
}

export function buildFocusedSensitivityCandidates(searchCenter: number, baseStep: number): number[] {
  const focusedStep = normalizeSensitivity(clamp(baseStep, FOCUSED_PROBE_MIN_STEP, FOCUSED_PROBE_MAX_STEP));
  const compactCandidates = buildFocusedCandidates(searchCenter, focusedStep);

  if (compactCandidates.length >= 3) {
    return compactCandidates;
  }

  const center = normalizeSensitivity(searchCenter);
  return dedupeSorted([
    Math.max(MIN_ALLOWED_SENSITIVITY, addSensitivityStep(center, -focusedStep)),
    center,
    addSensitivityStep(center, focusedStep),
  ]);
}

export function buildFineTuneCandidates(bestSensitivity: number, baseStep: number): number[] {
  const fineStep = getFineTuneStep(baseStep);

  return dedupeSorted([
    clampSensitivity(addSensitivityStep(bestSensitivity, -fineStep * 2)),
    clampSensitivity(addSensitivityStep(bestSensitivity, -fineStep)),
    clampSensitivity(addSensitivityStep(bestSensitivity, fineStep)),
    clampSensitivity(addSensitivityStep(bestSensitivity, fineStep * 2)),
  ]);
}
