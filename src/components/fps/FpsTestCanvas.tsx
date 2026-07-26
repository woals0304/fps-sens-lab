import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { POINTER_LOCK_RETRY_MESSAGE } from '../../lib/constants/appConstants';
import { getAimSnapshot } from '../../lib/fps/aimSnapshot';
import { CameraController } from '../../lib/fps/cameraController';
import { FlickTestManager } from '../../lib/fps/flickTestManager';
import { PointerMetricsCollector } from '../../lib/fps/metricsCollector';
import {
  exitFpsPointerLock,
  isPointerLocked,
  requestFpsPointerLock,
  waitForFpsPointerLock,
} from '../../lib/fps/pointerLockManager';
import { INVALID_FRAME_GAP_MS, RunQualityTracker } from '../../lib/fps/runQuality';
import { createLabScene } from '../../lib/fps/sceneBuilder';
import { TrackingTestManager } from '../../lib/fps/trackingTestManager';
import { TurnTestManager } from '../../lib/fps/turnTestManager';
import { getExperimentStageLabel, getLabModeLabel } from '../../lib/utils/uiText';
import type {
  ExperimentTask,
  LabMetrics,
  LabMode,
  LabRunQuality,
  TestProtocol,
} from '../../types/models';
import { TestHud } from './TestHud';

interface FpsTestCanvasProps {
  task: ExperimentTask | null;
  selectedMode: LabMode | null;
  stageLabelOverride?: string;
  sensitivity: number;
  fieldOfView: number;
  calibrationMultiplier: number;
  testProtocol: TestProtocol;
  running: boolean;
  remainingLabel?: string;
  etaLabel?: string;
  onComplete: (taskId: string, metrics: LabMetrics, quality: LabRunQuality) => void;
  onPointerLockLost?: (reason: string) => void;
  onMeasurementInvalidated?: (reason: string) => void;
  immersive?: boolean;
  minimalHud?: boolean;
}

export interface FpsTestCanvasHandle {
  requestPointerLock: () => Promise<boolean>;
  isPointerLocked: () => boolean;
}

function getModeLabel(mode: LabMode | null): string {
  if (!mode) {
    return '대기 화면';
  }

  return getLabModeLabel(mode);
}

function getProtocolConfig(testProtocol: TestProtocol, task: ExperimentTask | null) {
  if (!task) {
    return testProtocol.standard;
  }

  return task.protocolVariant === 'validation' ? testProtocol.validation : testProtocol.standard;
}

export const FpsTestCanvas = forwardRef<FpsTestCanvasHandle, FpsTestCanvasProps>(function FpsTestCanvas(
  {
    task,
    selectedMode,
    stageLabelOverride,
    sensitivity,
    fieldOfView,
    calibrationMultiplier,
    testProtocol,
    running,
    remainingLabel = '',
    etaLabel = '',
    onComplete,
    onPointerLockLost,
    onMeasurementInvalidated,
    immersive = false,
    minimalHud = false,
  },
  ref,
): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ReturnType<typeof createLabScene> | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const collectorRef = useRef(new PointerMetricsCollector());
  const qualityTrackerRef = useRef(new RunQualityTracker());
  const flickManagerRef = useRef<FlickTestManager | null>(null);
  const trackingManagerRef = useRef<TrackingTestManager | null>(null);
  const turnManagerRef = useRef<TurnTestManager | null>(null);
  const completionSentRef = useRef(false);
  const pointerLockedRef = useRef(false);
  const lockRequestInFlightRef = useRef(false);
  const qualityInvalidatedRef = useRef(false);
  const rawInputRef = useRef(false);
  const runningRef = useRef(running);
  const sensitivityRef = useRef(sensitivity);
  const calibrationRef = useRef(calibrationMultiplier);
  const taskRef = useRef(task);
  const protocolRef = useRef(testProtocol);
  const fieldOfViewRef = useRef(fieldOfView);
  const onCompleteRef = useRef(onComplete);
  const onPointerLockLostRef = useRef(onPointerLockLost);
  const onMeasurementInvalidatedRef = useRef(onMeasurementInvalidated);
  const statusTextRef = useRef('시작 버튼을 누르면 시험이 바로 시작됩니다.');
  const progressLabelRef = useRef('대기 중');

  const [pointerLocked, setPointerLocked] = useState(false);
  const [rawInput, setRawInput] = useState(false);
  const [statusText, setStatusText] = useState(statusTextRef.current);
  const [progressLabel, setProgressLabel] = useState(progressLabelRef.current);

  useEffect(() => {
    runningRef.current = running;
    sensitivityRef.current = sensitivity;
    calibrationRef.current = calibrationMultiplier;
    taskRef.current = task;
    protocolRef.current = testProtocol;
    fieldOfViewRef.current = fieldOfView;
    onCompleteRef.current = onComplete;
    onPointerLockLostRef.current = onPointerLockLost;
    onMeasurementInvalidatedRef.current = onMeasurementInvalidated;
  }, [
    calibrationMultiplier,
    fieldOfView,
    onComplete,
    onMeasurementInvalidated,
    onPointerLockLost,
    running,
    sensitivity,
    task,
    testProtocol,
  ]);

  function updateHudText(nextStatus: string, nextProgress: string): void {
    if (statusTextRef.current !== nextStatus) {
      statusTextRef.current = nextStatus;
      setStatusText(nextStatus);
    }

    if (progressLabelRef.current !== nextProgress) {
      progressLabelRef.current = nextProgress;
      setProgressLabel(nextProgress);
    }
  }

  function resetManagers(): void {
    flickManagerRef.current = null;
    trackingManagerRef.current = null;
    turnManagerRef.current = null;
    completionSentRef.current = false;

    if (sceneRef.current) {
      sceneRef.current.targetMesh.visible = false;
      sceneRef.current.turnMarker.visible = false;
    }
  }

  function pauseForPointerLoss(reason: string): void {
    pointerLockedRef.current = false;
    setPointerLocked(false);

    if (!runningRef.current || qualityInvalidatedRef.current) {
      if (!qualityInvalidatedRef.current) {
        updateHudText(reason, progressLabelRef.current);
      }
      return;
    }

    qualityInvalidatedRef.current = true;
    completionSentRef.current = true;
    runningRef.current = false;
    updateHudText(reason, progressLabelRef.current);
    if (sceneRef.current) {
      sceneRef.current.targetMesh.visible = false;
      sceneRef.current.turnMarker.visible = false;
    }
    onPointerLockLostRef.current?.(reason);
  }

  function buildRunQuality(): LabRunQuality {
    const canvas = canvasRef.current;
    const projection = sceneRef.current?.getProjectionSnapshot();

    return qualityTrackerRef.current.buildSnapshot({
      rawInput: rawInputRef.current,
      viewportWidth: canvas?.clientWidth ?? 0,
      viewportHeight: canvas?.clientHeight ?? 0,
      horizontalFieldOfView: projection?.horizontalFieldOfView ?? fieldOfViewRef.current,
      verticalFieldOfView: projection?.verticalFieldOfView ?? fieldOfViewRef.current,
      calibrationMultiplier: calibrationRef.current,
    });
  }

  function completeTask(metrics: LabMetrics): void {
    const currentTask = taskRef.current;

    if (!currentTask || completionSentRef.current || qualityInvalidatedRef.current) {
      return;
    }

    completionSentRef.current = true;
    runningRef.current = false;
    onCompleteRef.current(currentTask.id, metrics, buildRunQuality());
  }

  function invalidateForFrameGap(gapMs: number): void {
    if (qualityInvalidatedRef.current || !runningRef.current) {
      return;
    }

    const reason = `화면이 ${Math.round(gapMs)}ms 동안 멈춰 현재 측정을 저장하지 않았습니다. 같은 단계를 다시 시작해 주세요.`;
    qualityInvalidatedRef.current = true;
    completionSentRef.current = true;
    runningRef.current = false;
    updateHudText(reason, progressLabelRef.current);
    if (sceneRef.current) {
      sceneRef.current.targetMesh.visible = false;
      sceneRef.current.turnMarker.visible = false;
    }
    exitFpsPointerLock();
    onMeasurementInvalidatedRef.current?.(reason);
  }

  function invalidateIfFrameStalled(now: number): boolean {
    const gapMs = qualityTrackerRef.current.getGapSinceLastFrame(now);

    if (gapMs < INVALID_FRAME_GAP_MS) {
      return false;
    }

    invalidateForFrameGap(gapMs);
    return true;
  }

  async function requestPointerLockNow(): Promise<boolean> {
    const canvas = canvasRef.current;

    if (!canvas || lockRequestInFlightRef.current) {
      return false;
    }

    if (isPointerLocked(canvas)) {
      pointerLockedRef.current = true;
      setPointerLocked(true);
      return true;
    }

    lockRequestInFlightRef.current = true;
    canvas.focus();

    try {
      const result = await requestFpsPointerLock(canvas);
      const locked = result.requested ? await waitForFpsPointerLock(canvas) : false;
      rawInputRef.current = locked && result.rawInput;
      setRawInput(rawInputRef.current);

      if (locked) {
        pointerLockedRef.current = true;
        setPointerLocked(true);
        updateHudText('시점 고정이 다시 연결되었습니다.', progressLabelRef.current);
      } else {
        updateHudText(POINTER_LOCK_RETRY_MESSAGE, progressLabelRef.current);
      }

      return locked;
    } finally {
      lockRequestInFlightRef.current = false;
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      requestPointerLock: requestPointerLockNow,
      isPointerLocked: () => isPointerLocked(canvasRef.current),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const scene = createLabScene(canvas, fieldOfView);
    sceneRef.current = scene;
    cameraControllerRef.current = new CameraController(scene.camera, sensitivity, calibrationMultiplier);

    const handleResize = (): void => {
      scene.resize();
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
    resizeObserver?.observe(canvas);

    const handlePointerLockChange = (): void => {
      const locked = isPointerLocked(canvas);
      pointerLockedRef.current = locked;
      setPointerLocked(locked);

      if (!locked) {
        pauseForPointerLoss(
          runningRef.current
            ? '시점 고정이 풀려 현재 측정을 중단했습니다. 시작 버튼으로 다시 측정해 주세요.'
            : '대기 중입니다. 시작 버튼을 눌러 주세요.',
        );
        return;
      }

      updateHudText(
        runningRef.current ? '시험을 진행합니다.' : '시점 고정이 켜졌습니다.',
        progressLabelRef.current,
      );
    };

    const handleWindowBlur = (): void => {
      if (!pointerLockedRef.current) {
        return;
      }

      pauseForPointerLoss('브라우저 포커스가 바뀌어 현재 측정을 중단했습니다. 시작 버튼으로 다시 측정해 주세요.');
      exitFpsPointerLock();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== 'hidden') {
        return;
      }

      if (!pointerLockedRef.current) {
        return;
      }

      pauseForPointerLoss('화면이 가려져 현재 측정을 중단했습니다. 돌아오면 시작 버튼으로 다시 측정해 주세요.');
      exitFpsPointerLock();
    };

    const handleMouseMove = (event: MouseEvent): void => {
      if (!runningRef.current || !pointerLockedRef.current || !cameraControllerRef.current) {
        return;
      }

      const now = performance.now();

      if (invalidateIfFrameStalled(now)) {
        return;
      }

      cameraControllerRef.current.applyMouseDelta(event.movementX, event.movementY);
      collectorRef.current.recordMouseDelta(now, event.movementX, event.movementY);
    };

    const handleCanvasClick = async (): Promise<void> => {
      if (!canvas) {
        return;
      }

      if (!pointerLockedRef.current) {
        if (runningRef.current) {
          await requestPointerLockNow();
        }
        return;
      }

      const now = performance.now();

      if (runningRef.current && invalidateIfFrameStalled(now)) {
        return;
      }

      if (runningRef.current && taskRef.current?.mode === 'flick' && flickManagerRef.current && sceneRef.current) {
        flickManagerRef.current.handleClick(
          now,
          getAimSnapshot(sceneRef.current.camera, sceneRef.current.targetMesh),
          collectorRef.current,
        );
      }
    };

    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
    };

    const handlePointerLockError = (): void => {
      pauseForPointerLoss(
        '시점 고정 연결에 실패했습니다. 화면을 다시 눌러 주세요.',
      );
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleContextMenu);

    let animationFrame = 0;

    const renderFrame = (now: number): void => {
      const context = sceneRef.current;
      const cameraController = cameraControllerRef.current;

      if (!context || !cameraController) {
        return;
      }

      cameraController.setSensitivity(sensitivityRef.current, calibrationRef.current);

      if (runningRef.current && taskRef.current && pointerLockedRef.current) {
        const protocolConfig = getProtocolConfig(protocolRef.current, taskRef.current);
        const frameQuality = qualityTrackerRef.current.recordFrame(now);

        if (frameQuality.invalid) {
          invalidateForFrameGap(frameQuality.gapMs);
          context.targetMesh.visible = false;
          context.turnMarker.visible = false;
          context.renderer.render(context.scene, context.camera);
          animationFrame = window.requestAnimationFrame(renderFrame);
          return;
        }

        if (taskRef.current.mode === 'flick' && flickManagerRef.current) {
          flickManagerRef.current.update(
            now,
            context.targetMesh,
            () => getAimSnapshot(context.camera, context.targetMesh),
          );
          context.turnMarker.visible = false;
          updateHudText(
            '표적이 나타나면 바로 맞히세요.',
            flickManagerRef.current.getProgressLabel(),
          );

          if (flickManagerRef.current.isFinished() && !completionSentRef.current) {
            completeTask(flickManagerRef.current.getMetrics());
          }
        }

        if (taskRef.current.mode === 'tracking' && trackingManagerRef.current) {
          context.turnMarker.visible = false;
          const metrics = trackingManagerRef.current.update(
            now,
            context.targetMesh,
            context.camera,
            collectorRef.current,
          );

          updateHudText(
            '움직이는 표적을 끝까지 따라가세요.',
            `${Math.ceil(trackingManagerRef.current.getRemainingMs(now) / 1000)}초 남음`,
          );

          if (metrics && !completionSentRef.current) {
            completeTask(metrics);
          }
        }

        if (taskRef.current.mode === 'turn' && turnManagerRef.current) {
          context.targetMesh.visible = false;
          const metrics = turnManagerRef.current.update(
            now,
            cameraController.getYawDegrees(),
            context.turnMarker,
            context.camera.position,
          );

          updateHudText(
            `${turnManagerRef.current.getCurrentInstructionLabel()} · 표식에 맞춰 멈추세요.`,
            turnManagerRef.current.getProgressLabel(),
          );

          if (metrics && !completionSentRef.current) {
            completeTask(metrics);
          }
        }

        if (!taskRef.current.mode) {
          updateHudText(`${protocolConfig.label} 준비 중입니다.`, progressLabelRef.current);
        }
      } else if (runningRef.current && !pointerLockedRef.current) {
        context.targetMesh.visible = false;
        context.turnMarker.visible = false;
        updateHudText('시점 고정이 풀려 현재 측정을 중단했습니다. 시작 버튼으로 다시 측정해 주세요.', progressLabelRef.current);
      } else {
        context.targetMesh.visible = false;
        context.turnMarker.visible = false;
        updateHudText(
          pointerLockedRef.current
            ? '대기 중입니다. 시작 버튼을 누르면 현재 작업을 처음부터 측정합니다.'
            : '시작 버튼을 누르면 시점 고정과 시험이 함께 시작됩니다.',
          '대기 중',
        );
      }

      context.renderer.render(context.scene, context.camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    animationFrame = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      resizeObserver?.disconnect();
      scene.dispose();
      sceneRef.current = null;
      cameraControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    scene.setHorizontalFov(fieldOfView);
  }, [fieldOfView]);

  useEffect(() => {
    const controller = cameraControllerRef.current;

    if (!running || !task || !controller) {
      resetManagers();
      return;
    }

    const protocolConfig = getProtocolConfig(testProtocol, task);
    const now = performance.now();
    controller.reset();
    completionSentRef.current = false;
    qualityInvalidatedRef.current = false;
    collectorRef.current.reset();
    qualityTrackerRef.current.reset(now);

    if (task.mode === 'flick') {
      const manager = new FlickTestManager(task.seed, protocolConfig);
      manager.start(now);
      flickManagerRef.current = manager;
      trackingManagerRef.current = null;
      turnManagerRef.current = null;
      updateHudText(
        `순간 조준 표적 ${protocolConfig.flickTargetCount}개를 같은 규약으로 측정합니다.`,
        manager.getProgressLabel(),
      );
    }

    if (task.mode === 'tracking') {
      const manager = new TrackingTestManager(task.seed, protocolConfig);
      manager.start(now);
      flickManagerRef.current = null;
      trackingManagerRef.current = manager;
      turnManagerRef.current = null;
      updateHudText(
        `추적 조준을 ${Math.round(protocolConfig.trackingDurationMs / 1000)}초 동안 측정합니다.`,
        `${Math.ceil(manager.getDurationMs() / 1000)}초 측정`,
      );
    }

    if (task.mode === 'turn') {
      const manager = new TurnTestManager(protocolConfig);
      manager.start(now, controller.getYawDegrees());
      flickManagerRef.current = null;
      trackingManagerRef.current = null;
      turnManagerRef.current = manager;
      updateHudText(
        `회전 반응 ${protocolConfig.turnInstructions.length}회를 같은 순서로 측정합니다.`,
        manager.getProgressLabel(),
      );
    }
  }, [running, task, testProtocol]);

  return (
    <div className={immersive ? 'fps-canvas-shell immersive-shell' : 'fps-canvas-shell'}>
      <canvas
        ref={canvasRef}
        className={immersive ? 'fps-canvas immersive-canvas' : 'fps-canvas'}
        tabIndex={0}
      />
      <TestHud
        sensitivity={sensitivity}
        calibrationMultiplier={calibrationMultiplier}
        modeLabel={getModeLabel(task?.mode ?? selectedMode)}
        stageLabel={stageLabelOverride ?? (task ? getExperimentStageLabel(task.stage) : '미리 보기')}
        pointerLocked={pointerLocked}
        rawInput={rawInput}
        running={running}
        progressLabel={progressLabel}
        statusText={statusText}
        remainingLabel={remainingLabel}
        etaLabel={etaLabel}
        minimal={minimalHud}
      />
    </div>
  );
});
