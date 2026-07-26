import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OVERWATCH_FOV,
  getEffectiveFov,
  horizontalFovToVerticalFov,
  normalizeFovSettings,
  OVERWATCH_REFERENCE_ASPECT_RATIO,
} from './fov';

describe('fov utilities', () => {
  it('uses overwatch default when custom fov is turned off', () => {
    expect(
      getEffectiveFov({
        useCustomFov: false,
        customFov: 95,
        effectiveFov: 95,
      }),
    ).toBe(DEFAULT_OVERWATCH_FOV);
  });

  it('keeps custom fov inside allowed range', () => {
    expect(
      normalizeFovSettings({
        useCustomFov: true,
        customFov: 120,
        effectiveFov: 120,
      }),
    ).toEqual({
      useCustomFov: true,
      customFov: DEFAULT_OVERWATCH_FOV,
      effectiveFov: DEFAULT_OVERWATCH_FOV,
    });
  });

  it('converts the 16:9 horizontal Overwatch FOV to Three.js vertical FOV', () => {
    expect(
      horizontalFovToVerticalFov(DEFAULT_OVERWATCH_FOV, OVERWATCH_REFERENCE_ASPECT_RATIO),
    ).toBeCloseTo(70.5328, 4);
  });

  it('converts the same stored horizontal FOV for the active canvas aspect', () => {
    expect(horizontalFovToVerticalFov(DEFAULT_OVERWATCH_FOV, 1)).toBeCloseTo(
      DEFAULT_OVERWATCH_FOV,
      8,
    );
    expect(horizontalFovToVerticalFov(90, 4 / 3)).toBeCloseTo(73.7398, 4);
  });

  it('falls back to the 16:9 reference aspect for invalid renderer dimensions', () => {
    expect(horizontalFovToVerticalFov(DEFAULT_OVERWATCH_FOV, 0)).toBeCloseTo(
      horizontalFovToVerticalFov(DEFAULT_OVERWATCH_FOV, OVERWATCH_REFERENCE_ASPECT_RATIO),
      8,
    );
  });
});
