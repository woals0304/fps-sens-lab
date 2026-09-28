import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFocusLossGuard } from './focusLossGuard';
afterEach(() => vi.useRealTimers());
describe('focus loss guard', () => {
  it('ignores blur when the document still has focus after the transition', () => {
    vi.useFakeTimers();
    const lost = vi.fn();
    const guard = createFocusLossGuard(() => true, lost);
    guard.check();
    vi.runAllTimers();
    expect(lost).not.toHaveBeenCalled();
  });
  it('invalidates persistent window focus loss once', () => {
    vi.useFakeTimers();
    const lost = vi.fn();
    const guard = createFocusLossGuard(() => false, lost);
    guard.check();
    guard.check();
    vi.runAllTimers();
    expect(lost).toHaveBeenCalledTimes(1);
  });
  it('cancels a pending check on focus restoration or disposal', () => {
    vi.useFakeTimers();
    const lost = vi.fn();
    const guard = createFocusLossGuard(() => false, lost);
    guard.check();
    guard.cancel();
    vi.runAllTimers();
    expect(lost).not.toHaveBeenCalled();
  });
});
