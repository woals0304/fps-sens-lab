import { describe, expect, it, vi } from 'vitest';
import { horizontalFovToVerticalFov } from '../utils/fov';
import { createLabScene } from './sceneBuilder';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  class WebGLRenderer {
    setPixelRatio(): void {}

    setSize(): void {}

    dispose(): void {}
  }

  return {
    ...actual,
    WebGLRenderer,
  };
});

describe('createLabScene FOV projection', () => {
  it('recomputes vertical camera FOV on resize and horizontal-FOV changes', () => {
    const canvas = document.createElement('canvas');
    let width = 1_600;
    let height = 900;
    Object.defineProperty(canvas, 'clientWidth', { get: () => width });
    Object.defineProperty(canvas, 'clientHeight', { get: () => height });

    const context = createLabScene(canvas, 103);

    expect(context.camera.aspect).toBeCloseTo(16 / 9, 8);
    expect(context.camera.fov).toBeCloseTo(horizontalFovToVerticalFov(103, 16 / 9), 8);
    expect(context.getProjectionSnapshot()).toMatchObject({
      horizontalFieldOfView: 103,
      aspectRatio: 16 / 9,
    });
    expect(context.getProjectionSnapshot().verticalFieldOfView).toBeCloseTo(70.5328, 4);

    width = 1_200;
    height = 900;
    context.resize();
    expect(context.camera.aspect).toBeCloseTo(4 / 3, 8);
    expect(context.camera.fov).toBeCloseTo(horizontalFovToVerticalFov(103, 4 / 3), 8);

    context.setHorizontalFov(90);
    expect(context.camera.fov).toBeCloseTo(horizontalFovToVerticalFov(90, 4 / 3), 8);

    context.dispose();
  });
});
