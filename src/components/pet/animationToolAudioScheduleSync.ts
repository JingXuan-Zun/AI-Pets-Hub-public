import { type VoicePlaybackSession } from '../../voice/types';

export type AnimationToolAudioScheduleSyncScheduler =
  | NonNullable<VoicePlaybackSession['scheduler']>
  | 'fallback';

export interface AnimationToolAudioScheduleTiming {
  baseDelayMs: number;
  publishedAtMs: number;
  scheduler: AnimationToolAudioScheduleSyncScheduler;
  token: number;
}

const AUDIO_SCHEDULE_TIMING_WAIT_TIMEOUT_MS = 1500;
const timingsByToken = new Map<number, AnimationToolAudioScheduleTiming>();
const waitersByToken = new Map<number, Map<number, (timing: AnimationToolAudioScheduleTiming) => void>>();
const waitCancelersByHandle = new Map<number, () => void>();

let nextWaitHandle = -1;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createTiming(
  token: number,
  baseDelayMs: number,
  scheduler: AnimationToolAudioScheduleSyncScheduler,
): AnimationToolAudioScheduleTiming {
  return {
    baseDelayMs: Math.max(0, Math.round(baseDelayMs)),
    publishedAtMs: nowMs(),
    scheduler,
    token,
  };
}

function removeWaiter(handle: number) {
  waitersByToken.forEach((waiters) => {
    waiters.delete(handle);
  });
}

function deleteWaiter(handle: number) {
  removeWaiter(handle);
  waitCancelersByHandle.delete(handle);
}

export function publishAnimationToolAudioScheduleTiming(options: {
  baseDelayMs: number;
  scheduler: AnimationToolAudioScheduleSyncScheduler;
  token: number;
}) {
  const timing = createTiming(options.token, options.baseDelayMs, options.scheduler);
  timingsByToken.set(options.token, timing);
  const waiters = waitersByToken.get(options.token);
  if (!waiters) {
    return timing;
  }

  waitersByToken.delete(options.token);
  waiters.forEach((resolve, handle) => {
    waitCancelersByHandle.delete(handle);
    resolve(timing);
  });
  return timing;
}

export function clearAnimationToolAudioScheduleTiming(token: number) {
  timingsByToken.delete(token);
  const waiters = waitersByToken.get(token);
  waitersByToken.delete(token);
  waiters?.forEach((_resolve, handle) => {
    waitCancelersByHandle.get(handle)?.();
  });
}

export function cancelAnimationToolAudioScheduleTimingWait(handle: number) {
  waitCancelersByHandle.get(handle)?.();
}

export function waitForAnimationToolAudioScheduleTiming(options: {
  fallbackBaseDelayMs: number;
  onTiming: (timing: AnimationToolAudioScheduleTiming) => void;
  token: number;
  timeoutMs?: number;
}) {
  const timing = timingsByToken.get(options.token);
  if (timing) {
    options.onTiming(timing);
    return 0;
  }

  if (typeof window === 'undefined') {
    options.onTiming(createTiming(options.token, options.fallbackBaseDelayMs, 'fallback'));
    return 0;
  }

  const handle = nextWaitHandle;
  nextWaitHandle -= 1;
  let settled = false;
  const timeoutId = window.setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    deleteWaiter(handle);
    options.onTiming(createTiming(options.token, options.fallbackBaseDelayMs, 'fallback'));
  }, options.timeoutMs ?? AUDIO_SCHEDULE_TIMING_WAIT_TIMEOUT_MS);
  waitCancelersByHandle.set(handle, () => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(timeoutId);
    deleteWaiter(handle);
  });
  const waiters = waitersByToken.get(options.token) ?? new Map();
  waiters.set(handle, (nextTiming) => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(timeoutId);
    deleteWaiter(handle);
    options.onTiming(nextTiming);
  });
  waitersByToken.set(options.token, waiters);

  return handle;
}
