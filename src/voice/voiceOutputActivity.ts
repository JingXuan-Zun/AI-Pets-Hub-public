// Counts pet voice jobs from the moment synthesis is requested until playback ends or is dropped.
// "Speaking" flags alone miss the gaps while the next queued sentence is still being synthesized,
// which is exactly when a hands-free mic would otherwise pick up the pet's own voice.

type Listener = () => void;

let activeJobs = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

// A job that never reported its end (a prepared sentence dropped without dispose, playback that
// never settled) kept the hands-free microphone on "稍等，马上继续听" for good. No sentence takes
// this long even with a cold voice model (warm-up ≈50 s), so such a job is ended by the watchdog.
export const VOICE_OUTPUT_JOB_WATCHDOG_MS = 120_000;
let onJobExpired: (() => void) | null = null;

/** Lets the app log watchdog expiries (they point at a playback path that leaks a job). */
export function setVoiceOutputJobExpiredListener(listener: (() => void) | null) {
  onJobExpired = listener;
}

export function beginVoiceOutputJob(watchdogMs = VOICE_OUTPUT_JOB_WATCHDOG_MS) {
  activeJobs += 1;
  if (activeJobs === 1) notify();
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    globalThis.clearTimeout(watchdog);
    activeJobs = Math.max(0, activeJobs - 1);
    if (activeJobs === 0) notify();
  };
  const watchdog = globalThis.setTimeout(() => {
    if (ended) return;
    onJobExpired?.();
    end();
  }, watchdogMs);
  return end;
}

export function isVoiceOutputActive() {
  return activeJobs > 0;
}

export function subscribeVoiceOutputActivity(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
