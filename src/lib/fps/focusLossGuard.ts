// Let a focus transition finish before treating a blur notification as loss of the window.
// Actual pointer-lock loss and hidden tabs are handled immediately by the canvas.
export function createFocusLossGuard(hasFocus: () => boolean, onLoss: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    check() {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        if (!hasFocus()) onLoss();
      }, 0);
    },
    cancel,
  };
}
