import { clamp } from '../utils/numberUtils';

export interface PointerSample {
  time: number;
  dx: number;
  dy: number;
  magnitude: number;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

export class PointerMetricsCollector {
  private readonly samples: PointerSample[] = [];

  reset(): void {
    this.samples.length = 0;
  }

  recordMouseDelta(time: number, dx: number, dy: number): void {
    this.samples.push({
      time,
      dx,
      dy,
      magnitude: Math.sqrt(dx ** 2 + dy ** 2),
    });

    const cutoff = time - 15000;

    while (this.samples.length > 0 && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }

  getRecentAverageMagnitude(windowMs: number, now: number): number {
    const samples = this.samples.filter((sample) => sample.time >= now - windowMs);
    return average(samples.map((sample) => sample.magnitude));
  }

  getRecentMagnitudeDeviation(windowMs: number, now: number): number {
    const samples = this.samples.filter((sample) => sample.time >= now - windowMs);
    return standardDeviation(samples.map((sample) => sample.magnitude));
  }

  getSmoothnessScore(windowMs: number, now: number): number {
    const deviation = this.getRecentMagnitudeDeviation(windowMs, now);
    return clamp(100 - deviation * 4, 0, 100);
  }

  getDirectionChangeRate(windowMs: number, now: number): number {
    const samples = this.samples.filter((sample) => sample.time >= now - windowMs);

    if (samples.length <= 1 || windowMs <= 0) {
      return 0;
    }

    let changes = 0;

    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      const changedX = Math.sign(previous.dx) !== 0 && Math.sign(previous.dx) !== Math.sign(current.dx);
      const changedY = Math.sign(previous.dy) !== 0 && Math.sign(previous.dy) !== Math.sign(current.dy);

      if (changedX || changedY) {
        changes += 1;
      }
    }

    return changes / Math.max(windowMs / 1000, 0.001);
  }
}
