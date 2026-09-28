import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSampleSession } from '../data/sampleSessions';
import { AppliedReportCard } from './AppliedReportCard';

describe('AppliedReportCard', () => {
  it('추천값의 기록이 없으면 다른 감도의 점수를 대신 표시하지 않는다', () => {
    const session = createSampleSession();
    session.recommendation.finalSensitivity = 9.99;
    const html = renderToStaticMarkup(<AppliedReportCard session={session} />);
    expect(html).toContain('아직 비교 점수가 충분하지 않음');
    expect(html).not.toContain('순간 80');
  });
  it('실제로 측정한 추천값의 점수와 판정 이유를 표시한다', () => {
    const session = createSampleSession();
    const measured = session.labSummaries[0];
    session.recommendation.finalSensitivity = measured.sensitivity;
    const html = renderToStaticMarkup(<AppliedReportCard session={session} />);
    expect(html).toContain(`순간 ${measured.flickScore.toFixed(0)}`);
    expect(html).toContain('통계적 신뢰도를 뜻하지 않습니다');
    expect(html).toContain(session.validationResult!.decisionReason[0]);
  });
});
