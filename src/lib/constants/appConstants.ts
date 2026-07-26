import type {
  AppSettings,
  AppTab,
  HeroCategory,
  LabMode,
  LabSection,
  PlayStyle,
  TestProtocol,
  TurnInstruction,
} from '../../types/models';
import { getDefaultOverwatchFov } from '../utils/fov';

export const DEFAULT_SETTINGS: AppSettings = {
  dpi: 1600,
  currentSensitivity: 2.5,
  minSensitivity: 1.5,
  maxSensitivity: 4.0,
  step: 0.2,
  useCustomFov: false,
  customFov: getDefaultOverwatchFov(),
  effectiveFov: getDefaultOverwatchFov(),
  heroCategory: 'hitscan',
  customHeroCategory: '',
  playStyle: 'balanced',
};

export const SCORE_WEIGHTS = {
  accuracy: 0.3,
  tracking: 0.2,
  flick: 0.2,
  overall: 0.2,
  overshootPenalty: 0.1,
} as const;

// 자동 측정 점수는 여기 숫자만 바꾸면 바로 조정할 수 있습니다.
export const AUTO_SCORE_WEIGHTS = {
  flick: 0.35,
  tracking: 0.35,
  turn: 0.2,
  overshootPenalty: 0.1,
  manualBlend: 0.25,
} as const;

export const APP_TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'finder', label: '감도 찾기' },
  { id: 'results', label: '결과 보기' },
  { id: 'settings', label: '설정' },
];

export const LAB_SECTIONS: Array<{ id: LabSection; label: string }> = [
  { id: 'setup', label: '설정' },
  { id: 'flick', label: '순간 조준 시험' },
  { id: 'tracking', label: '추적 조준 시험' },
  { id: 'turn', label: '회전 반응 시험' },
  { id: 'results', label: '결과' },
];

export const HERO_CATEGORY_OPTIONS: Array<{ value: HeroCategory; label: string }> = [
  { value: 'hitscan', label: '즉발 공격형' },
  { value: 'tracking', label: '지속 추적형' },
  { value: 'projectile', label: '투사체형' },
  { value: 'high-mobility', label: '고기동형' },
  { value: 'custom', label: '직접 입력' },
];

export const PLAY_STYLE_OPTIONS: Array<{ value: PlayStyle; label: string }> = [
  { value: 'balanced', label: '균형형' },
  { value: 'tracking-focus', label: '추적 조준 중심' },
  { value: 'flick-focus', label: '순간 조준 중심' },
  { value: 'aggressive', label: '공격 성향' },
  { value: 'stable', label: '안정 성향' },
];

export const LOCAL_STORAGE_KEY = 'ow2-sensitivity-finder-sessions';
export const STORAGE_VERSION = 5;

export const MIN_ALLOWED_SENSITIVITY = 0.5;
export const MAX_ALLOWED_SENSITIVITY = 8;
export const MAX_REASONABLE_CANDIDATES = 25;

export const TOO_FAST_KEYWORDS = ['빠름', '높음', '지나침', 'too fast'];
export const TOO_SLOW_KEYWORDS = ['답답', '느림', '무거움', 'too slow'];
export const TOO_FAST_OVERSHOOT = 70;
export const TOO_SLOW_TRACKING = 45;

export const OVERWATCH_YAW_DEGREES_PER_COUNT = 0.0066;
export const BASE_LOOK_SCALE = (OVERWATCH_YAW_DEGREES_PER_COUNT * Math.PI) / 180;
export const DEFAULT_CALIBRATION_MULTIPLIER = 1;
export const POINTER_LOCK_RETRY_MESSAGE =
  '브라우저가 원시 입력을 막으면 일반 포인터 잠금으로 자동 전환합니다.';

export const TURN_TOLERANCE_DEG = 4;
export const TURN_HOLD_MS = 150;
export const TURN_TRIAL_TIMEOUT_MS = 4500;
export const QUICK_TURN_TRIAL_TIMEOUT_MS = 2500;
export const QUICK_VALIDATION_TURN_TRIAL_TIMEOUT_MS = 2200;
export const TRACKING_ON_TARGET_THRESHOLD_DEG = 2.5;

export const LAB_CAMERA_FOV = getDefaultOverwatchFov();
export const LAB_TARGET_RADIUS = 0.45;
export const LAB_TARGET_DISTANCE = 11;
export const LAB_CANVAS_HEIGHT = 480;

export const AI_MIN_SUMMARY_COUNT = 30;
export const DEFAULT_LAST_RESUME_TAB: AppTab = 'finder';

export const AUTO_RANGE_PERCENT = 0.15;
export const AUTO_RANGE_MIN_OFFSET = 0.2;
export const AUTO_RANGE_MAX_OFFSET = 0.6;

export const WIDE_PROBE_NEAR_RATIO = 0.12;
export const WIDE_PROBE_FAR_RATIO = 0.28;
export const WIDE_PROBE_NEAR_MIN_OFFSET = 0.2;
export const WIDE_PROBE_NEAR_MAX_OFFSET = 0.45;
export const WIDE_PROBE_FAR_MIN_OFFSET = 0.45;
export const WIDE_PROBE_FAR_MAX_OFFSET = 1.2;
export const WIDE_PROBE_STEP = 0.05;

export const FOCUSED_PROBE_MIN_STEP = 0.05;
export const FOCUSED_PROBE_MAX_STEP = 0.25;

export const DIRECTION_SIMILAR_SCORE_DELTA = 1.5;
export const DIRECTION_MEANINGFUL_GAP = 3.5;
export const DIRECTION_WIN_COUNT_THRESHOLD = 2;

// 기본 모드는 오래 끌지 않는 쪽이 중요해서 재중심화는 1번만 허용합니다.
export const MAX_SEARCH_RECENTER_COUNT = 1;
export const RECENTER_MIN_SHIFT = 0.12;
export const RECENTER_MAX_SHIFT = 0.6;

export const RANGE_STAGE_ADVANCE_COUNT = 4;
export const DUEL_STAGE_ADVANCE_COUNT = 3;
export const FINE_TUNE_THRESHOLD = 5;

export const VALIDATION_SCORE_KEEP_THRESHOLD = 1.5;
export const VALIDATION_SCORE_SWITCH_THRESHOLD = 2.5;
export const STABLE_ZONE_SCORE_DELTA = 4;
export const OVERSHOOT_ALERT_PENALTY = 8;
export const TURN_SLOW_TIME_MS = 1500;
export const BALANCE_SCORE_GAP_THRESHOLD = 6;

// 빠른 시작 모드의 상한입니다.
export const QUICK_MODE_MAX_TOTAL_BUNDLES = 8;
export const QUICK_MODE_MAX_VALIDATION_BUNDLES = 3;
export const QUICK_MODE_MAX_DUEL_PAIRS = 1;
export const QUICK_MODE_MAX_FOCUSED_CANDIDATES = 3;
export const QUICK_MODE_CONFIDENT_SCORE_GAP = 7;
export const QUICK_MODE_SAFE_RANGE_WIDTH = 0.14;
export const QUICK_MODE_MAX_ESTIMATED_SECONDS = 240;

export const TEST_SEED_OFFSETS: Record<
  'range_test' | 'duel_test' | 'fine_tune' | 'validation',
  Record<LabMode, number>
> = {
  range_test: {
    flick: 1101,
    tracking: 1102,
    turn: 1103,
  },
  duel_test: {
    flick: 2101,
    tracking: 2102,
    turn: 2103,
  },
  fine_tune: {
    flick: 3101,
    tracking: 3102,
    turn: 3103,
  },
  validation: {
    flick: 4101,
    tracking: 4102,
    turn: 4103,
  },
};

const STANDARD_TURN_INSTRUCTIONS: TurnInstruction[] = [
  { id: 'left90-a', label: '왼쪽 90도', angleDeg: 90 },
  { id: 'right90-a', label: '오른쪽 90도', angleDeg: -90 },
  { id: 'left180-a', label: '왼쪽 180도', angleDeg: 180 },
  { id: 'right180-a', label: '오른쪽 180도', angleDeg: -180 },
  { id: 'left45', label: '왼쪽 45도', angleDeg: 45 },
  { id: 'right45', label: '오른쪽 45도', angleDeg: -45 },
  { id: 'left135', label: '왼쪽 135도', angleDeg: 135 },
  { id: 'right135', label: '오른쪽 135도', angleDeg: -135 },
  { id: 'left90-b', label: '왼쪽 90도', angleDeg: 90 },
  { id: 'right90-b', label: '오른쪽 90도', angleDeg: -90 },
];

const VALIDATION_TURN_INSTRUCTIONS: TurnInstruction[] = [
  { id: 'left90-v1', label: '왼쪽 90도', angleDeg: 90 },
  { id: 'right90-v1', label: '오른쪽 90도', angleDeg: -90 },
  { id: 'left180-v1', label: '왼쪽 180도', angleDeg: 180 },
  { id: 'right180-v1', label: '오른쪽 180도', angleDeg: -180 },
  { id: 'left90-v2', label: '왼쪽 90도', angleDeg: 90 },
  { id: 'right90-v2', label: '오른쪽 90도', angleDeg: -90 },
];

export const STANDARD_TEST_PROTOCOL: TestProtocol = {
  version: '2026-03-standard-v1',
  label: '기본 고정 시험 규약',
  description: '모든 감도를 같은 표적 수, 같은 시간, 같은 속도, 같은 시드로 시험합니다.',
  standard: {
    label: '기본 시험',
    flickTargetCount: 20,
    flickTargetTimeoutMs: 2500,
    trackingDurationMs: 15000,
    trackingTargetSpeedScale: 1,
    turnTrialTimeoutMs: TURN_TRIAL_TIMEOUT_MS,
    turnInstructions: STANDARD_TURN_INSTRUCTIONS,
  },
  validation: {
    label: '최종 검증 시험',
    flickTargetCount: 10,
    flickTargetTimeoutMs: 2200,
    trackingDurationMs: 8000,
    trackingTargetSpeedScale: 1,
    turnTrialTimeoutMs: TURN_TRIAL_TIMEOUT_MS,
    turnInstructions: VALIDATION_TURN_INSTRUCTIONS,
  },
};

export const QUICK_START_TEST_PROTOCOL: TestProtocol = {
  version: '2026-03-quick-v1',
  label: '빠른 시작 규약',
  description: '짧은 시간 안에 추천 감도를 찾기 위한 간단한 시험 규약입니다.',
  standard: {
    label: '빠른 시작 시험',
    flickTargetCount: 6,
    flickTargetTimeoutMs: 1200,
    trackingDurationMs: 4000,
    trackingTargetSpeedScale: 1,
    turnTrialTimeoutMs: QUICK_TURN_TRIAL_TIMEOUT_MS,
    turnInstructions: [
      { id: 'quick-left-90', label: '왼쪽 90도', angleDeg: 90 },
      { id: 'quick-right-90', label: '오른쪽 90도', angleDeg: -90 },
      { id: 'quick-back-180', label: '뒤돌기 180도', angleDeg: 180 },
    ],
  },
  validation: {
    label: '빠른 최종 확인',
    flickTargetCount: 4,
    flickTargetTimeoutMs: 1000,
    trackingDurationMs: 2500,
    trackingTargetSpeedScale: 1,
    turnTrialTimeoutMs: QUICK_VALIDATION_TURN_TRIAL_TIMEOUT_MS,
    turnInstructions: [
      { id: 'quick-valid-left-90', label: '왼쪽 90도', angleDeg: 90 },
      { id: 'quick-valid-back', label: '뒤돌기 180도', angleDeg: 180 },
    ],
  },
};
