// Counts pet voice jobs from the moment synthesis is requested until playback ends or is dropped.
// "Speaking" flags alone miss the gaps while the next queued sentence is still being synthesized,
// which is exactly when a hands-free mic would otherwise pick up the pet's own voice.

type Listener = () => void;

let activeJobs = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function beginVoiceOutputJob() {
  activeJobs += 1;
  if (activeJobs === 1) notify();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeJobs = Math.max(0, activeJobs - 1);
    if (activeJobs === 0) notify();
  };
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
