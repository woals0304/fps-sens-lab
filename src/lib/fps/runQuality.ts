import type { LabRunQuality } from '../../types/models';
import { roundTo } from '../utils/numberUtils';

export const LONG_FRAME_GAP_MS = 50;
export const INVALID_FRAME_GAP_MS = 250;
const REFERENCE_ASPECT_RATIO = 16 / 9;
const REFERENCE_ASPECT_TOLERANCE_RATIO = 0.01;

export class RunQualityTracker {
  private previousFrameAt: number | null = null;
  private maxFrameGapMs = 0;
  private longFrameCount = 0;
  private frameSampleCount = 0;

  reset(startedAt: number): void {
    this.previousFrameAt = startedAt;
    this.maxFrameGapMs = 0;
    this.longFrameCount = 0;
    this.frameSampleCount = 0;
  }

  recordFrame(now: number): { invalid: boolean; gapMs: number } {
    if (this.previousFrameAt === null || !Number.isFinite(now)) {
      this.previousFrameAt = Number.isFinite(now) ? now : null;
      return { invalid: false, gapMs: 0 };
    }

    const gapMs = Math.max(0, now - this.previousFrameAt);
    this.previousFrameAt = now;

    if (gapMs === 0) {
      return { invalid: false, gapMs: 0 };
    }

    this.frameSampleCount += 1;
    this.maxFrameGapMs = Math.max(this.maxFrameGapMs, gapMs);

    if (gapMs >= LONG_FRAME_GAP_MS) {
      this.longFrameCount += 1;
    }

    return {
      invalid: gapMs >= INVALID_FRAME_GAP_MS,
      gapMs,
    };
  }

  getGapSinceLastFrame(now: number): number {
    if (this.previousFrameAt === null || !Number.isFinite(now)) {
      return 0;
    }

    return Math.max(0, now - this.previousFrameAt);
  }

  buildSnapshot(input: {
    rawInput: boolean;
    viewportWidth: number;
    viewportHeight: number;
    horizontalFieldOfView: number;
    verticalFieldOfView: number;
    calibrationMultiplier: number;
  }): LabRunQuality {
    const width = Math.max(0, Math.round(input.viewportWidth));
    const height = Math.max(0, Math.round(input.viewportHeight));
    const aspectRatio = height > 0 ? width / height : 0;

    return {
      schemaVersion: 1,
      rawInput: input.rawInput,
      maxFrameGapMs: roundTo(this.maxFrameGapMs, 2),
      longFrameRatio: roundTo(
        this.frameSampleCount > 0 ? this.longFrameCount / this.frameSampleCount : 0,
        4,
      ),
      frameSampleCount: this.frameSampleCount,
      viewportWidth: width,
      viewportHeight: height,
      aspectRatio: roundTo(aspectRatio, 4),
      referenceAspect:
        aspectRatio > 0 &&
        Math.abs(aspectRatio - REFERENCE_ASPECT_RATIO) / REFERENCE_ASPECT_RATIO <=
          REFERENCE_ASPECT_TOLERANCE_RATIO,
      horizontalFieldOfView: roundTo(input.horizontalFieldOfView, 4),
      verticalFieldOfView: roundTo(input.verticalFieldOfView, 4),
      calibrationMultiplier: roundTo(input.calibrationMultiplier, 4),
    };
  }
}
