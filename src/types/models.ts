export type HeroCategory =
  | 'hitscan'
  | 'tracking'
  | 'projectile'
  | 'high-mobility'
  | 'custom';

export type PlayStyle =
  | 'balanced'
  | 'tracking-focus'
  | 'flick-focus'
  | 'aggressive'
  | 'stable';

export type AppTab =
  | 'finder'
  | 'results'
  | 'settings'
  | 'setup'
  | 'range'
  | 'duel'
  | 'fps-lab'
  | 'history';

export type LabMode = 'flick' | 'tracking' | 'turn';

export type LabSection = 'setup' | 'flick' | 'tracking' | 'turn' | 'results';

export type ExperimentStage =
  | 'setup'
  | 'range_test'
  | 'duel_test'
  | 'fine_tune'
  | 'validation'
  | 'result';

export type ProtocolVariant = 'standard' | 'validation';

export type DuelChoice = 'A' | 'B' | 'SIMILAR';

export type DuelPhase = 'coarse' | 'fine' | 'done';

export type ExperimentTaskStatus = 'pending' | 'running' | 'completed' | 'skipped';

export type SensitivityTrendTag =
  | 'too_fast'
  | 'too_slow'
  | 'stable_zone'
  | 'fine_control_issue'
  | 'balanced';

export type DirectionTrend = 'lower' | 'higher' | 'stable' | 'unclear';

export type SearchPhase = 'wide_probe' | 'focused_probe' | 'ready_for_duel';

export type CandidateDecisionAction =
  | 'advanced'
  | 'eliminated'
  | 'recentered'
  | 'validation_target'
  | 'confirmed'
  | 'adjusted';

export type ValidationCandidateRole = 'lower' | 'recommended' | 'higher';

export interface AppSettings {
  dpi: number;
  currentSensitivity: number;
  minSensitivity: number;
  maxSensitivity: number;
  step: number;
  useCustomFov: boolean;
  customFov: number | null;
  effectiveFov: number;
  heroCategory: HeroCategory;
  customHeroCategory: string;
  playStyle: PlayStyle;
}

export interface SensitivityCandidate {
  value: number;
  index: number;
}

export interface RangeTestEntry {
  sensitivity: number;
  accuracyScore: number;
  trackingComfort: number;
  flickComfort: number;
  overshoot: number;
  overallFeeling: number;
  memo: string;
  weightedScore: number;
  testedAt: string;
}

export interface DuelMatch {
  candidateA: number;
  candidateB: number;
  choice: DuelChoice;
  note: string;
  playedAt: string;
  source?: 'manual' | 'auto_lab';
  pairId?: string | null;
}

export interface SafeRange {
  min: number;
  max: number;
}

export interface TopCandidate {
  sensitivity: number;
  score: number;
  label: string;
}

export interface RecommendationResult {
  bestSensitivity: number | null;
  preValidationSensitivity: number | null;
  finalSensitivity: number | null;
  validationPassed: boolean | null;
  safeRange: SafeRange | null;
  slightlyLowerBackup: number | null;
  slightlyHigherBackup: number | null;
  topCandidates: TopCandidate[];
  reasonSummary: string[];
  nextTestCandidates: number[];
}

export interface TurnInstruction {
  id: string;
  label: string;
  angleDeg: number;
}

export interface ProtocolVariantConfig {
  label: string;
  flickTargetCount: number;
  flickTargetTimeoutMs: number;
  trackingDurationMs: number;
  trackingTargetSpeedScale: number;
  turnTrialTimeoutMs: number;
  turnInstructions: TurnInstruction[];
}

export interface TestProtocol {
  version: string;
  label: string;
  description: string;
  standard: ProtocolVariantConfig;
  validation: ProtocolVariantConfig;
}

export interface FlickMetrics {
  // 몇 개를 쐈는지 기록합니다.
  shotCount: number;
  hits: number;
  misses: number;
  hitRate: number;
  // 처음 들어간 흐름 그대로 한 번에 맞춘 비율입니다.
  oneShotHitRate: number;
  averageTimeToHitMs: number;
  averageCorrectionTimeMs: number;
  overshootEvents: number;
  // 지나친 뒤 다시 들어와서 맞춘 횟수입니다.
  overshootReturnCount: number;
  reacquireCount: number;
  firstEnterDelayMs: number;
  preClickJitter: number;
  // 지나친 폭이 평균적으로 얼마나 컸는지 봅니다.
  averageOvershootAmount: number;
}

export interface TrackingMetrics {
  durationMs: number;
  averageCrosshairDistanceDeg: number;
  timeOnTargetRatio: number;
  followStability: number;
  movementSmoothness: number;
  trackingLossCount: number;
  // 초당 평균 몇 번 크게 다시 맞추려 했는지 봅니다.
  averageCorrectionFrequency: number;
}

export interface TurnMetrics {
  instructionCount: number;
  completionRate: number;
  completionTimeMs: number;
  angularErrorDeg: number;
  overshootAngleDeg: number;
  correctionCount: number;
  // 목표 각도에 들어간 뒤 얼마나 빨리 흔들림이 잠잠해졌는지 봅니다.
  stabilizationTimeMs: number;
}

export type LabMetrics = FlickMetrics | TrackingMetrics | TurnMetrics;

export interface LabRunQuality {
  schemaVersion: 1;
  rawInput: boolean;
  maxFrameGapMs: number;
  longFrameRatio: number;
  frameSampleCount: number;
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
  referenceAspect: boolean;
  horizontalFieldOfView: number;
  verticalFieldOfView: number;
  calibrationMultiplier: number;
}

export interface LabRun {
  id: string;
  taskId: string;
  pairId: string | null;
  pairLabel: 'A' | 'B' | null;
  stage: ExperimentStage;
  mode: LabMode;
  protocolVariant: ProtocolVariant;
  sensitivity: number;
  seed: number;
  createdAt: string;
  metrics: LabMetrics;
  // 이전 저장 기록에는 없을 수 있으므로 선택 필드로 유지합니다.
  quality?: LabRunQuality;
}

export interface SensitivityLabSummary {
  sensitivity: number;
  flickMetrics: FlickMetrics | null;
  trackingMetrics: TrackingMetrics | null;
  turnMetrics: TurnMetrics | null;
  flickScore: number;
  trackingScore: number;
  turnScore: number;
  hitRateScore: number;
  smoothnessScore: number;
  overshootPenalty: number;
  autoWeightedScore: number | null;
  manualWeightedScore: number | null;
  combinedWeightedScore: number | null;
  interpretationTags: SensitivityTrendTag[];
  runCount: number;
}

export interface ExperimentTask {
  id: string;
  title: string;
  description: string;
  stage: ExperimentStage;
  mode: LabMode;
  section: LabSection;
  protocolVariant: ProtocolVariant;
  sensitivity: number;
  seed: number;
  pairId: string | null;
  pairLabel: 'A' | 'B' | null;
  compareAgainst: number | null;
  status: ExperimentTaskStatus;
  createdAt: string;
}

export interface ExperimentState {
  stage: ExperimentStage;
  tasks: ExperimentTask[];
  activeTaskId: string | null;
  // 처음 입력한 감도를 그대로 저장해 두면 나중에 얼마나 멀리 이동했는지 설명할 수 있습니다.
  initialCenter: number;
  // 지금 탐색이 실제로 어디를 중심으로 움직이는지 기록합니다.
  searchCenter: number;
  searchPhase: SearchPhase;
  recenterCount: number;
  lastDirectionTrend: DirectionTrend;
  lastResumeTab: AppTab;
  lastLabSection: LabSection;
  calibrationMultiplier: number;
  manualSensitivityOverride: number | null;
  recommendedPairs: Array<[number, number]>;
  stopReason: string | null;
  lastUpdatedAt: string;
}

export interface ExperimentDecisionRecord {
  id: string;
  stage: ExperimentStage;
  sensitivity: number;
  action: CandidateDecisionAction;
  reason: string;
  score: number | null;
  createdAt: string;
}

export interface ValidationCandidateResult {
  sensitivity: number;
  role: ValidationCandidateRole;
  score: number | null;
  flickScore: number;
  trackingScore: number;
  turnScore: number;
  overshootPenalty: number;
  interpretationTags: SensitivityTrendTag[];
}

export interface ValidationResult {
  baselineSensitivity: number | null;
  comparedSensitivities: number[];
  candidateResults: ValidationCandidateResult[];
  passed: boolean | null;
  finalSensitivity: number | null;
  decisionReason: string[];
  validatedAt: string | null;
}

export interface AnalysisSummary {
  currentPaceText: string;
  stableRangeText: string;
  overshootText: string;
  turnSlowText: string;
  balanceText: string;
  recommendationText: string;
  explanationLines: string[];
}

export interface AiPrediction {
  predictedBestSensitivity: number;
  recommendedNextPair: [number, number] | null;
  confidence: number;
  generatedAt: string;
}

export interface StoredSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  storageVersion: 5;
  settings: AppSettings;
  testProtocol: TestProtocol;
  rangeEntries: RangeTestEntry[];
  duelMatches: DuelMatch[];
  labRuns: LabRun[];
  labSummaries: SensitivityLabSummary[];
  analysisSummary: AnalysisSummary;
  decisionLog: ExperimentDecisionRecord[];
  validationResult: ValidationResult | null;
  experimentState: ExperimentState;
  recommendation: RecommendationResult;
  aiPrediction: AiPrediction | null;
}

export interface DuelProgress {
  phase: DuelPhase;
  remainingCandidates: number[];
  focusSensitivity: number | null;
  currentPair: {
    candidateA: number;
    candidateB: number;
  } | null;
  similarPairs: Array<[number, number]>;
}

export interface StorageAdapter {
  listSessions: () => StoredSession[];
  getSession: (id: string) => StoredSession | null;
  saveSession: (session: StoredSession) => boolean;
  deleteSession: (id: string) => boolean;
  loadSampleSession: () => StoredSession;
}
