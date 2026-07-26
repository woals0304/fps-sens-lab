import { describe, expect, it } from 'vitest';
import { createSampleSession } from '../../data/sampleSessions';
import { DEFAULT_SETTINGS, STANDARD_TEST_PROTOCOL, STORAGE_VERSION } from '../constants/appConstants';
import { migrateStoredSession } from './sessionMigrations';

describe('migrateStoredSession', () => {
  it('예전 세션을 v3 구조로 올린다', () => {
    const migrated = migrateStoredSession({
      id: 'old-session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
      rangeEntries: [],
      duelMatches: [],
      recommendation: {
        bestSensitivity: null,
        preValidationSensitivity: null,
        finalSensitivity: null,
        validationPassed: null,
        safeRange: null,
        slightlyLowerBackup: null,
        slightlyHigherBackup: null,
        topCandidates: [],
        reasonSummary: [],
        nextTestCandidates: [],
      },
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.storageVersion).toBe(5);
    expect(migrated?.labRuns).toEqual([]);
    expect(migrated?.experimentState.stage).toBe('setup');
    expect(migrated?.experimentState.searchCenter).toBe(DEFAULT_SETTINGS.currentSensitivity);
    expect(migrated?.settings.useCustomFov).toBe(false);
    expect(migrated?.settings.effectiveFov).toBe(DEFAULT_SETTINGS.effectiveFov);
    expect(migrated?.testProtocol.label).toBeTruthy();
    expect(migrated?.analysisSummary.recommendationText).toBeTruthy();
  });

  it('숨겨진 예전 탭 값은 보이는 탭으로 정리한다', () => {
    const migrated = migrateStoredSession({
      id: 'old-hidden-tab-session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
      testProtocol: undefined,
      rangeEntries: [],
      duelMatches: [],
      labRuns: [],
      experimentState: {
        lastResumeTab: 'fps-lab',
      },
      recommendation: {
        bestSensitivity: null,
        preValidationSensitivity: null,
        finalSensitivity: null,
        validationPassed: null,
        safeRange: null,
        slightlyLowerBackup: null,
        slightlyHigherBackup: null,
        topCandidates: [],
        reasonSummary: [],
        nextTestCandidates: [],
      },
    });

    expect(migrated?.experimentState.lastResumeTab).toBe('finder');
  });

  it('일부 설정만 남은 예전 세션은 기본값으로 빈 필드를 채운다', () => {
    const migrated = migrateStoredSession({
      id: 'partial-settings',
      settings: {
        dpi: 800,
        currentSensitivity: 3.2,
      },
    });

    expect(migrated?.settings.dpi).toBe(800);
    expect(migrated?.settings.currentSensitivity).toBe(3.2);
    expect(migrated?.settings.playStyle).toBe(DEFAULT_SETTINGS.playStyle);
    expect(migrated?.testProtocol.standard.turnInstructions.length).toBeGreaterThan(0);
  });

  it('일부 시험 규약은 기본 규약과 깊게 병합하고 잘못된 값은 복구한다', () => {
    const migrated = migrateStoredSession({
      id: 'partial-protocol',
      settings: DEFAULT_SETTINGS,
      testProtocol: {
        label: '사용자 규약',
        standard: {
          flickTargetCount: 4,
          trackingDurationMs: -1,
        },
        validation: {
          turnInstructions: [],
        },
      },
    });

    expect(migrated?.testProtocol.label).toBe('사용자 규약');
    expect(migrated?.testProtocol.standard.flickTargetCount).toBe(4);
    expect(migrated?.testProtocol.standard.trackingDurationMs).toBe(
      STANDARD_TEST_PROTOCOL.standard.trackingDurationMs,
    );
    expect(migrated?.testProtocol.standard.flickTargetTimeoutMs).toBe(
      STANDARD_TEST_PROTOCOL.standard.flickTargetTimeoutMs,
    );
    expect(migrated?.testProtocol.validation.turnInstructions).toEqual(
      STANDARD_TEST_PROTOCOL.validation.turnInstructions,
    );
  });

  it('현재 앱보다 새로운 저장 형식은 임의로 덮어쓰지 않는다', () => {
    expect(
      migrateStoredSession({
        storageVersion: STORAGE_VERSION + 1,
        settings: DEFAULT_SETTINGS,
      }),
    ).toBeNull();
  });

  it('진행 중인 최종 확인의 기준 감도는 다시 불러와도 유지한다', () => {
    const migrated = migrateStoredSession({
      id: 'validation-in-progress',
      settings: DEFAULT_SETTINGS,
      experimentState: {
        stage: 'validation',
      },
      recommendation: {
        preValidationSensitivity: 2.31,
      },
    });

    expect(migrated?.recommendation.preValidationSensitivity).toBe(2.31);
  });

  it('유효한 실행 품질은 보존하고 손상된 품질만 버린다', () => {
    const sample = createSampleSession();
    const quality = {
      schemaVersion: 1,
      rawInput: true,
      maxFrameGapMs: 18.4,
      longFrameRatio: 0.01,
      frameSampleCount: 240,
      viewportWidth: 1920,
      viewportHeight: 1080,
      aspectRatio: 1.7778,
      referenceAspect: true,
      horizontalFieldOfView: 103,
      verticalFieldOfView: 70.5328,
      calibrationMultiplier: 1,
    };
    const withQuality = {
      ...sample,
      labRuns: sample.labRuns.map((run, index) =>
        index === 0 ? { ...run, quality } : run,
      ),
    };

    expect(migrateStoredSession(withQuality)?.labRuns[0].quality).toEqual(quality);

    const withCorruptedQuality = {
      ...sample,
      labRuns: sample.labRuns.map((run, index) =>
        index === 0 ? { ...run, quality: { ...quality, maxFrameGapMs: '멈춤' } } : run,
      ),
    };
    const migrated = migrateStoredSession(withCorruptedQuality);

    expect(migrated?.labRuns).toHaveLength(sample.labRuns.length);
    expect(migrated?.labRuns[0].quality).toBeUndefined();
  });
});
