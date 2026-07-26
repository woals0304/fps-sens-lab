import type { AppSettings } from '../../types/models';

export const DEFAULT_OVERWATCH_FOV = 103;
export const MIN_CUSTOM_FOV = 80;
export const MAX_CUSTOM_FOV = 103;
export const OVERWATCH_REFERENCE_ASPECT_RATIO = 16 / 9;

export function normalizeFov(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_OVERWATCH_FOV;
  }

  return Math.round(value);
}

export function clampFov(value: number): number {
  const normalized = normalizeFov(value);
  return Math.min(MAX_CUSTOM_FOV, Math.max(MIN_CUSTOM_FOV, normalized));
}

export function getDefaultOverwatchFov(): number {
  return DEFAULT_OVERWATCH_FOV;
}

/**
 * App FOV values use Overwatch's horizontal-FOV convention. Three.js expects
 * a vertical FOV, so the renderer converts the stored value for its aspect.
 */
export function horizontalFovToVerticalFov(
  horizontalFov: number,
  aspectRatio: number = OVERWATCH_REFERENCE_ASPECT_RATIO,
): number {
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : OVERWATCH_REFERENCE_ASPECT_RATIO;
  const horizontalRadians = horizontalFov * (Math.PI / 180);
  const verticalRadians = 2 * Math.atan(Math.tan(horizontalRadians / 2) / safeAspectRatio);

  return verticalRadians * (180 / Math.PI);
}

export function isCustomFovEnabled(settings: Pick<AppSettings, 'useCustomFov'>): boolean {
  return settings.useCustomFov;
}

export function getEffectiveFov(
  settings: Pick<AppSettings, 'useCustomFov' | 'customFov' | 'effectiveFov'>,
): number {
  if (!settings.useCustomFov) {
    return getDefaultOverwatchFov();
  }

  return clampFov(settings.customFov ?? settings.effectiveFov ?? getDefaultOverwatchFov());
}

export function normalizeFovSettings(
  settings: Pick<AppSettings, 'useCustomFov' | 'customFov' | 'effectiveFov'>,
): Pick<AppSettings, 'useCustomFov' | 'customFov' | 'effectiveFov'> {
  const customFov = clampFov(settings.customFov ?? getDefaultOverwatchFov());
  const effectiveFov = settings.useCustomFov ? customFov : getDefaultOverwatchFov();

  return {
    useCustomFov: settings.useCustomFov,
    customFov,
    effectiveFov,
  };
}
