import assert from 'node:assert/strict';
import {
  cancelAnimationToolAudioScheduleTimingWait,
  clearAnimationToolAudioScheduleTiming,
  publishAnimationToolAudioScheduleTiming,
  waitForAnimationToolAudioScheduleTiming,
} from '../src/components/pet/animationToolAudioScheduleSync';

function installFakeWindowTimers() {
  const timeouts = new Map<number, () => void>();
  let nextTimeoutId = 1;
  const previousWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    clearTimeout: (timeoutId: number) => {
      timeouts.delete(timeoutId);
    },
    setTimeout: (callback: () => void) => {
      const timeoutId = nextTimeoutId;
      nextTimeoutId += 1;
      timeouts.set(timeoutId, callback);
      return timeoutId;
    },
  };

  return {
    fire(timeoutId: number) {
      const callback = timeouts.get(timeoutId);
      timeouts.delete(timeoutId);
      callback?.();
    },
    pendingCount() {
      return timeouts.size;
    },
    restore() {
      if (previousWindow === undefined) {
        delete (globalThis as typeof globalThis & { window?: unknown }).window;
        return;
      }

      (globalThis as typeof globalThis & { window: unknown }).window = previousWindow;
    },
  };
}

const timers = installFakeWindowTimers();
try {
  const received: Array<{ baseDelayMs: number; scheduler: string; token: number }> = [];
  const waitHandle = waitForAnimationToolAudioScheduleTiming({
    fallbackBaseDelayMs: 40,
    onTiming: (timing) => {
      received.push({
        baseDelayMs: timing.baseDelayMs,
        scheduler: timing.scheduler,
        token: timing.token,
      });
    },
    token: 101,
  });

  assert.equal(waitHandle < 0, true);
  assert.equal(timers.pendingCount(), 1);
  publishAnimationToolAudioScheduleTiming({
    baseDelayMs: 96.4,
    scheduler: 'clocked',
    token: 101,
  });
  assert.deepEqual(received, [{ baseDelayMs: 96, scheduler: 'clocked', token: 101 }]);
  assert.equal(timers.pendingCount(), 0);

  const fallbackReceived: string[] = [];
  const fallbackHandle = waitForAnimationToolAudioScheduleTiming({
    fallbackBaseDelayMs: 33,
    onTiming: (timing) => fallbackReceived.push(`${timing.scheduler}:${timing.baseDelayMs}`),
    timeoutMs: 10,
    token: 102,
  });
  timers.fire(Math.abs(fallbackHandle));
  assert.deepEqual(fallbackReceived, ['fallback:33']);

  const cancelledReceived: string[] = [];
  const cancelledHandle = waitForAnimationToolAudioScheduleTiming({
    fallbackBaseDelayMs: 12,
    onTiming: (timing) => cancelledReceived.push(`${timing.scheduler}:${timing.baseDelayMs}`),
    token: 103,
  });
  cancelAnimationToolAudioScheduleTimingWait(cancelledHandle);
  publishAnimationToolAudioScheduleTiming({
    baseDelayMs: 20,
    scheduler: 'clocked',
    token: 103,
  });
  assert.deepEqual(cancelledReceived, []);

  clearAnimationToolAudioScheduleTiming(103);
} finally {
  timers.restore();
}

console.log('animation tool audio schedule sync smoke ok');
