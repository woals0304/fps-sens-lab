import * as THREE from 'three';
import type { ProtocolVariantConfig } from '../../types/models';
import type { FlickMetrics } from '../../types/models';
import type { AimSnapshot } from './aimSnapshot';
import { PointerMetricsCollector } from './metricsCollector';
import { createFlickTargetPositions } from './targetSpawner';

interface FlickTargetState {
  spawnTime: number;
  firstEnterTime: number | null;
  enteredAtLeastOnce: boolean;
  currentlyOnTarget: boolean;
  leftAfterEntry: boolean;
  overshootPeak: number;
  hadCorrection: boolean;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export class FlickTestManager {
  private readonly positions: THREE.Vector3[];

  private readonly targetTimeoutMs: number;

  private currentIndex = 0;

  private currentTargetState: FlickTargetState | null = null;

  private readonly hitDurations: number[] = [];

  private readonly correctionDurations: number[] = [];

  private readonly firstEnterDelays: number[] = [];

  private readonly preClickJitters: number[] = [];

  private readonly overshootAmounts: number[] = [];

  private hits = 0;

  private misses = 0;

  private oneShotHits = 0;

  private overshootEvents = 0;

  private overshootReturnCount = 0;

  private reacquireCount = 0;

  constructor(seed: number, protocol: ProtocolVariantConfig) {
    this.positions = createFlickTargetPositions(seed, protocol.flickTargetCount);
    this.targetTimeoutMs = protocol.flickTargetTimeoutMs;
  }

  start(now: number): void {
    this.currentIndex = 0;
    this.hits = 0;
    this.misses = 0;
    this.oneShotHits = 0;
    this.overshootEvents = 0;
    this.overshootReturnCount = 0;
    this.reacquireCount = 0;
    this.hitDurations.length = 0;
    this.correctionDurations.length = 0;
    this.firstEnterDelays.length = 0;
    this.preClickJitters.length = 0;
    this.overshootAmounts.length = 0;
    this.currentTargetState = this.createTargetState(now);
  }

  update(now: number, targetMesh: THREE.Object3D, readAim: () => AimSnapshot): void {
    if (this.isFinished()) {
      targetMesh.visible = false;
      return;
    }

    const position = this.positions[this.currentIndex];
    targetMesh.position.copy(position);
    targetMesh.visible = true;

    if (!this.currentTargetState) {
      this.currentTargetState = this.createTargetState(now);
    }

    const state = this.currentTargetState;
    const aim = readAim();

    if (aim.isOnTarget) {
      if (!state.enteredAtLeastOnce) {
        state.enteredAtLeastOnce = true;
        state.currentlyOnTarget = true;
        state.firstEnterTime = now;
        this.firstEnterDelays.push(now - state.spawnTime);
      } else if (state.leftAfterEntry) {
        state.leftAfterEntry = false;
        state.currentlyOnTarget = true;
        state.hadCorrection = true;
        this.reacquireCount += 1;
        this.overshootReturnCount += 1;
        this.overshootAmounts.push(state.overshootPeak);
        state.overshootPeak = 0;
      } else {
        state.currentlyOnTarget = true;
      }
    } else {
      if (state.currentlyOnTarget && state.enteredAtLeastOnce) {
        state.currentlyOnTarget = false;
        state.leftAfterEntry = true;
        state.hadCorrection = true;
        this.overshootEvents += 1;
      }

      if (state.leftAfterEntry) {
        state.overshootPeak = Math.max(state.overshootPeak, aim.angularDistanceDeg);
      }
    }

    if (now - state.spawnTime >= this.targetTimeoutMs) {
      if (state.leftAfterEntry && state.overshootPeak > 0) {
        this.overshootAmounts.push(state.overshootPeak);
      }

      this.misses += 1;
      this.advance(now);
    }
  }

  handleClick(now: number, aim: AimSnapshot, collector: PointerMetricsCollector): void {
    if (this.isFinished() || !this.currentTargetState) {
      return;
    }

    if (!aim.isOnTarget) {
      this.misses += 1;
      return;
    }

    this.hits += 1;
    this.hitDurations.push(now - this.currentTargetState.spawnTime);

    if (!this.currentTargetState.hadCorrection) {
      this.oneShotHits += 1;
    }

    if (this.currentTargetState.firstEnterTime !== null) {
      this.correctionDurations.push(now - this.currentTargetState.firstEnterTime);
    }

    if (this.currentTargetState.leftAfterEntry && this.currentTargetState.overshootPeak > 0) {
      this.overshootAmounts.push(this.currentTargetState.overshootPeak);
    }

    this.preClickJitters.push(collector.getRecentAverageMagnitude(200, now));
    this.advance(now);
  }

  isFinished(): boolean {
    return this.currentIndex >= this.positions.length;
  }

  getProgressLabel(): string {
    return `${Math.min(this.currentIndex + 1, this.positions.length)} / ${this.positions.length}`;
  }

  getMetrics(): FlickMetrics {
    const shotCount = this.hits + this.misses;

    return {
      shotCount,
      hits: this.hits,
      misses: this.misses,
      hitRate: shotCount > 0 ? this.hits / shotCount : 0,
      oneShotHitRate: shotCount > 0 ? this.oneShotHits / shotCount : 0,
      averageTimeToHitMs: average(this.hitDurations),
      averageCorrectionTimeMs: average(this.correctionDurations),
      overshootEvents: this.overshootEvents,
      overshootReturnCount: this.overshootReturnCount,
      reacquireCount: this.reacquireCount,
      firstEnterDelayMs: average(this.firstEnterDelays),
      preClickJitter: average(this.preClickJitters),
      averageOvershootAmount: average(this.overshootAmounts),
    };
  }

  private createTargetState(now: number): FlickTargetState {
    return {
      spawnTime: now,
      firstEnterTime: null,
      enteredAtLeastOnce: false,
      currentlyOnTarget: false,
      leftAfterEntry: false,
      overshootPeak: 0,
      hadCorrection: false,
    };
  }

  private advance(now: number): void {
    this.currentIndex += 1;
    this.currentTargetState = this.isFinished() ? null : this.createTargetState(now);
  }
}
