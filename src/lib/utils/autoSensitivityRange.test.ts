import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants/appConstants';
import {
  buildAutoSensitivitySettings,
  buildFineTuneCandidates,
  buildFocusedSensitivityCandidates,
  buildInitialSensitivityCandidates,
  getAutoRangeOffset,
} from './autoSensitivityRange';

describe('autoSensitivityRange', () => {
  it('현재 감도만으로도 넓은 1차 후보 5개를 자동 계산한다', () => {
    const candidates = buildInitialSensitivityCandidates(2.5);

    expect(candidates).toEqual([1.8, 2.2, 2.5, 2.8, 3.2]);
  });

  it('자동 범위 폭은 너무 좁거나 너무 넓지 않게 보정한다', () => {
    expect(getAutoRangeOffset(1.0)).toBe(0.2);
    expect(getAutoRangeOffset(10.0)).toBe(0.6);
  });

  it('세션 설정도 자동 범위와 간격을 함께 채운다', () => {
    const autoSettings = buildAutoSensitivitySettings({
      ...DEFAULT_SETTINGS,
      currentSensitivity: 2.5,
    });

    expect(autoSettings.minSensitivity).toBe(1.8);
    expect(autoSettings.maxSensitivity).toBe(3.2);
    expect(autoSettings.step).toBe(0.1);
  });

  it('중심을 다시 옮긴 뒤에는 새 중심 주변 후보를 만든다', () => {
    expect(buildFocusedSensitivityCandidates(2.15, 0.1)).toEqual([1.95, 2.05, 2.15, 2.25, 2.35]);
  });

  it('미세 조정 후보는 두 자리 정밀도로 더 촘촘하게 만든다', () => {
    expect(buildFineTuneCandidates(2.63, 0.1)).toEqual([2.59, 2.61, 2.65, 2.67]);
  });

  it('현재 감도와 미세 조정 후보를 앱 허용 범위 안으로 제한한다', () => {
    expect(buildAutoSensitivitySettings({ ...DEFAULT_SETTINGS, currentSensitivity: 99 }).currentSensitivity).toBe(8);
    expect(buildFineTuneCandidates(0.5, 0.1).every((value) => value >= 0.5)).toBe(true);
    expect(buildFineTuneCandidates(8, 0.1).every((value) => value <= 8)).toBe(true);
  });
});
