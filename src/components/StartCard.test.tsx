// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSampleSession } from '../data/sampleSessions';
import { StartCard } from './StartCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div');
document.body.append(host);
let root = createRoot(host);
afterEach(() => { act(() => root.unmount()); root = createRoot(host); });
function change(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function setup() {
  const start = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(createSampleSession().settings);
    return <StartCard draft={draft} currentSession={null} onDraftChange={setDraft}
      onStart={() => start(draft)} onOpenSettings={() => {}} onOpenResults={() => {}} />;
  }
  act(() => root.render(<Harness />));
  return { start, inputs: host.querySelectorAll('input'), submit: () => act(() => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }) };
}
describe('StartCard input flow', () => {
  it('allows clearing and typing a decimal without reformatting each keystroke', () => {
    const { inputs, start, submit } = setup();
    change(inputs[1], '');
    expect(inputs[1].value).toBe('');
    change(inputs[1], '4.');
    expect(inputs[1].value).toBe('4.');
    change(inputs[1], '4.25');
    submit();
    expect(start.mock.calls[0][0].currentSensitivity).toBe(4.25);
  });
  it('blocks blank input and focuses the field with an associated error', () => {
    const { inputs, start, submit } = setup();
    change(inputs[0], '');
    submit();
    expect(start).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(inputs[0]);
    expect(inputs[0].getAttribute('aria-invalid')).toBe('true');
    const errorId = inputs[0].getAttribute('aria-describedby')!.split(' ')[1];
    expect(document.getElementById(errorId)!.textContent).toContain('정수');
    change(inputs[0], '800');
    submit();
    expect(start.mock.calls[0][0].dpi).toBe(800);
  });
});
