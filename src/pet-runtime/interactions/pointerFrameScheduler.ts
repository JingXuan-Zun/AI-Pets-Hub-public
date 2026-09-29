export type PointerFrameScheduler<T> = {
  cancel: () => void;
  flush: () => void;
  push: (value: T) => void;
};

export function createPointerFrameScheduler<T>(
  applyValue: (value: T) => void,
): PointerFrameScheduler<T> {
  let animationFrameId: number | null = null;
  let pendingValue: T | null = null;

  const flush = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    const nextValue = pendingValue;
    pendingValue = null;
    if (nextValue !== null) {
      applyValue(nextValue);
    }
  };

  return {
    cancel: () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = null;
      pendingValue = null;
    },
    flush,
    push: (value) => {
      pendingValue = value;
      if (animationFrameId === null) {
        animationFrameId = window.requestAnimationFrame(flush);
      }
    },
  };
}
