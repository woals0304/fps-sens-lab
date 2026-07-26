import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TestHud } from './TestHud';

const BASE_PROPS = {
  sensitivity: 2.5,
  calibrationMultiplier: 1,
  modeLabel: '순간 조준',
  stageLabel: '감도 범위 확인',
  pointerLocked: true,
  rawInput: true,
  progressLabel: '3 / 6',
  statusText: '표적이 나타나면 바로 맞히세요.',
  etaLabel: '예상 약 2분',
};

describe('TestHud minimal mode', () => {
  it('실행 중에는 행동 지시와 실제 진행률을 함께 보여 준다', () => {
    const html = renderToStaticMarkup(
      <TestHud {...BASE_PROPS} running minimal />,
    );

    expect(html).toContain('순간 조준 · 3 / 6');
    expect(html).toContain('표적이 나타나면 바로 맞히세요.');
    expect(html).toContain('감도 2.50');
  });

  it('시작 전에는 실행 HUD를 숨기고 조준점만 유지한다', () => {
    const html = renderToStaticMarkup(
      <TestHud {...BASE_PROPS} running={false} minimal />,
    );

    expect(html).not.toContain('순간 조준 · 3 / 6');
    expect(html).not.toContain('표적이 나타나면 바로 맞히세요.');
    expect(html).toContain('fps-crosshair');
  });
});
