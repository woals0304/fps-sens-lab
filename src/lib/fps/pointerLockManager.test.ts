import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForFpsPointerLock } from './pointerLockManager';

function setPointerLockElement(element: Element | null): void {
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    value: element,
  });
}

describe('waitForFpsPointerLock', () => {
  afterEach(() => {
    setPointerLockElement(null);
    vi.useRealTimers();
  });

  it('비동기 pointerlockchange에서 실제 잠금 획득을 확인한다', async () => {
    const canvas = document.createElement('canvas');
    const pending = waitForFpsPointerLock(canvas, 100);

    setPointerLockElement(canvas);
    document.dispatchEvent(new Event('pointerlockchange'));

    await expect(pending).resolves.toBe(true);
  });

  it('비동기 pointerlockerror를 즉시 실패로 반환한다', async () => {
    const canvas = document.createElement('canvas');
    const pending = waitForFpsPointerLock(canvas, 100);

    document.dispatchEvent(new Event('pointerlockerror'));

    await expect(pending).resolves.toBe(false);
  });

  it('이벤트가 오지 않으면 제한 시간 뒤 실패로 반환한다', async () => {
    vi.useFakeTimers();
    const canvas = document.createElement('canvas');
    const pending = waitForFpsPointerLock(canvas, 100);

    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toBe(false);
  });
});
