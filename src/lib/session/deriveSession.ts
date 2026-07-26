import { buildAnalysisSummary, buildLabSummariesFromRuns } from '../experiment/metricsAnalyzer';
import { buildRecommendation } from '../recommendation/recommendationEngine';
import type { StoredSession } from '../../types/models';

/**
 * 원본 측정 기록에서 화면에 표시할 파생 데이터를 한 번에 다시 계산합니다.
 * 저장 시각 변경 여부는 호출자가 결정할 수 있도록 이 함수는 순수하게 유지합니다.
 */
export function deriveSession(session: StoredSession): StoredSession {
  const labSummaries = buildLabSummariesFromRuns(session.labRuns, session.rangeEntries);
  const frozenValidationBaseline =
    session.experimentState.stage === 'validation'
      ? session.recommendation.preValidationSensitivity
      : null;
  const recommendation = buildRecommendation(
    session.settings,
    session.rangeEntries,
    session.duelMatches,
    labSummaries,
    session.aiPrediction,
    session.validationResult,
    frozenValidationBaseline,
  );
  const analysisSummary = buildAnalysisSummary({
    currentSensitivity: session.settings.currentSensitivity,
    summaries: labSummaries,
    bestSensitivity: recommendation.bestSensitivity,
    safeRange: recommendation.safeRange,
    validationResult: session.validationResult,
  });

  return {
    ...session,
    labSummaries,
    analysisSummary,
    recommendation,
  };
}
