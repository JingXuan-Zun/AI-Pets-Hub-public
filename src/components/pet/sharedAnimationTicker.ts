type SharedAnimationTickCallback = (timestamp: number) => void;

const subscribers = new Set<SharedAnimationTickCallback>();
let animationFrameId: number | null = null;

function runSharedAnimationFrame(timestamp: number) {
  animationFrameId = null;

  subscribers.forEach((callback) => {
    callback(timestamp);
  });

  if (subscribers.size > 0) {
    animationFrameId = window.requestAnimationFrame(runSharedAnimationFrame);
  }
}

function ensureSharedAnimationTicker() {
  if (animationFrameId !== null || subscribers.size === 0) {
    return;
  }

  animationFrameId = window.requestAnimationFrame(runSharedAnimationFrame);
}

export function subscribeSharedAnimationTick(callback: SharedAnimationTickCallback) {
  subscribers.add(callback);
  ensureSharedAnimationTicker();

  return () => {
    subscribers.delete(callback);

    if (subscribers.size === 0 && animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };
}
