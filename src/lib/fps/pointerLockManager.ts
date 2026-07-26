export async function requestFpsPointerLock(
  element: HTMLCanvasElement,
): Promise<{ requested: boolean; rawInput: boolean }> {
  const requestPointerLock = element.requestPointerLock?.bind(element) as
    | ((options?: { unadjustedMovement?: boolean }) => Promise<void> | void)
    | undefined;

  if (!requestPointerLock) {
    return {
      requested: false,
      rawInput: false,
    };
  }

  try {
    const result = requestPointerLock({
      unadjustedMovement: true,
    });

    if (result && typeof (result as Promise<void>).then === 'function') {
      await result;
    }

    return {
      requested: true,
      rawInput: true,
    };
  } catch {
    try {
      const fallback = requestPointerLock();

      if (fallback && typeof (fallback as Promise<void>).then === 'function') {
        await fallback;
      }

      return {
        requested: true,
        rawInput: false,
      };
    } catch {
      return {
        requested: false,
        rawInput: false,
      };
    }
  }
}

export function waitForFpsPointerLock(
  element: HTMLCanvasElement,
  timeoutMs = 1200,
): Promise<boolean> {
  if (isPointerLocked(element)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (locked: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      resolve(locked);
    };

    const handlePointerLockChange = (): void => {
      if (isPointerLocked(element)) {
        finish(true);
      }
    };

    const handlePointerLockError = (): void => {
      finish(false);
    };

    const timeoutId = window.setTimeout(() => finish(isPointerLocked(element)), timeoutMs);

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);

    if (isPointerLocked(element)) {
      finish(true);
    }
  });
}

export function isPointerLocked(element: HTMLCanvasElement | null): boolean {
  if (!element) {
    return false;
  }

  return document.pointerLockElement === element;
}

export function exitFpsPointerLock(): void {
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}
