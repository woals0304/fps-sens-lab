import * as THREE from 'three';
import {
  TURN_HOLD_MS,
  TURN_TOLERANCE_DEG,
  TURN_TRIAL_TIMEOUT_MS,
} from '../constants/appConstants';
import type { ProtocolVariantConfig, TurnInstruction, TurnMetrics } from '../../types/models';
import { normalizeDegrees } from '../utils/sensitivity';
import { getTurnMarkerPosition } from './targetSpawner';

interface TrialState {
  label: string;
  targetYaw: number;
  targetAngleDeg: number;
  startedAt: number;
  holdStartAt: number | null;
  firstStableEnterAt: number | null;
  previousYaw: number;
  travelledYaw: number;
  previousProgressError: number;
  maxOvershoot: number;
  correctionCount: number;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export class TurnTestManager {
  private readonly instructions: TurnInstruction[];

  private readonly trialTimeoutMs: number;

  private trialIndex = 0;

  private trialState: TrialState | null = null;

  private readonly completionTimes: number[] = [];

  private readonly errors: number[] = [];

  private readonly overshoots: number[] = [];

  private readonly corrections: number[] = [];

  private readonly stabilizationTimes: number[] = [];

  private successes = 0;

  constructor(protocol: ProtocolVariantConfig) {
    this.instructions = protocol.turnInstructions;
    this.trialTimeoutMs = protocol.turnTrialTimeoutMs ?? TURN_TRIAL_TIMEOUT_MS;
  }

  start(now: number, currentYaw: number): void {
    this.trialIndex = 0;
    this.completionTimes.length = 0;
    this.errors.length = 0;
    this.overshoots.length = 0;
    this.corrections.length = 0;
    this.stabilizationTimes.length = 0;
    this.successes = 0;
    this.trialState = this.createTrialState(now, currentYaw);
  }

  getCurrentInstructionLabel(): string {
    return this.trialState?.label ?? '완료';
  }

  isFinished(): boolean {
    return this.trialState === null;
  }

  getProgressLabel(): string {
    return `${Math.min(this.trialIndex + 1, this.instructions.length)} / ${this.instructions.length}`;
  }

  update(
    now: number,
    currentYaw: number,
    turnMarker: THREE.Object3D,
    cameraPosition: THREE.Vector3,
  ): TurnMetrics | null {
    if (!this.trialState) {
      turnMarker.visible = false;
      return this.buildMetrics();
    }

    turnMarker.visible = true;
    turnMarker.position.copy(getTurnMarkerPosition(this.trialState.targetYaw));
    turnMarker.lookAt(cameraPosition);

    const currentTrial = this.trialState;
    currentTrial.travelledYaw += normalizeDegrees(currentYaw - currentTrial.previousYaw);
    currentTrial.previousYaw = currentYaw;

    const progressError = currentTrial.travelledYaw - currentTrial.targetAngleDeg;
    const signedError = normalizeDegrees(currentYaw - currentTrial.targetYaw);
    const absError = Math.abs(signedError);

    if (
      Math.sign(currentTrial.previousProgressError) !== 0 &&
      Math.sign(progressError) !== 0 &&
      Math.sign(currentTrial.previousProgressError) !== Math.sign(progressError)
    ) {
      currentTrial.correctionCount += 1;
    }

    const turnDirection = Math.sign(currentTrial.targetAngleDeg);
    currentTrial.maxOvershoot = Math.max(
      currentTrial.maxOvershoot,
      Math.max(0, turnDirection * progressError),
    );
    currentTrial.previousProgressError = progressError;

    if (absError <= TURN_TOLERANCE_DEG) {
      if (currentTrial.firstStableEnterAt === null) {
        currentTrial.firstStableEnterAt = now;
      }

      if (currentTrial.holdStartAt === null) {
        currentTrial.holdStartAt = now;
      }

      if (now - currentTrial.holdStartAt >= TURN_HOLD_MS) {
        this.successes += 1;
        this.finishTrial(now, absError, currentYaw);

        if (!this.trialState) {
          turnMarker.visible = false;
          return this.buildMetrics();
        }
      }
    } else {
      currentTrial.holdStartAt = null;
    }

    if (this.trialState === currentTrial && now - currentTrial.startedAt >= this.trialTimeoutMs) {
      this.finishTrial(now, absError, currentYaw);

      if (!this.trialState) {
        turnMarker.visible = false;
        return this.buildMetrics();
      }
    }

    return null;
  }

  private createTrialState(now: number, currentYaw: number): TrialState | null {
    const instruction = this.instructions[this.trialIndex];

    if (!instruction) {
      return null;
    }

    return {
      label: instruction.label,
      targetYaw: normalizeDegrees(currentYaw + instruction.angleDeg),
      targetAngleDeg: instruction.angleDeg,
      startedAt: now,
      holdStartAt: null,
      firstStableEnterAt: null,
      previousYaw: currentYaw,
      travelledYaw: 0,
      previousProgressError: -instruction.angleDeg,
      maxOvershoot: 0,
      correctionCount: 0,
    };
  }

  private finishTrial(now: number, absError: number, currentYaw: number): void {
    if (!this.trialState) {
      return;
    }

    this.completionTimes.push(now - this.trialState.startedAt);
    this.errors.push(absError);
    this.overshoots.push(this.trialState.maxOvershoot);
    this.corrections.push(this.trialState.correctionCount);
    this.stabilizationTimes.push(
      this.trialState.firstStableEnterAt !== null ? now - this.trialState.firstStableEnterAt : this.trialTimeoutMs,
    );
    this.trialIndex += 1;
    this.trialState = this.createTrialState(now, currentYaw);
  }

  private buildMetrics(): TurnMetrics {
    return {
      instructionCount: this.instructions.length,
      completionRate: this.instructions.length > 0 ? this.successes / this.instructions.length : 0,
      completionTimeMs: average(this.completionTimes),
      angularErrorDeg: average(this.errors),
      overshootAngleDeg: average(this.overshoots),
      correctionCount: average(this.corrections),
      stabilizationTimeMs: average(this.stabilizationTimes),
    };
  }
}
