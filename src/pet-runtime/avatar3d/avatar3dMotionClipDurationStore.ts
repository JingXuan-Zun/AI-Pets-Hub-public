type MotionClipDurationEntry = {
  durationMs: number;
  name: string;
};

type MotionClipDurationListener = () => void;

const motionClipDurationByName = new Map<string, number>();
const motionClipDurationListeners = new Set<MotionClipDurationListener>();
let motionClipDurationVersion = 0;

function normalizeMotionClipDurationLookupKey(name: string) {
  return name.trim().toLowerCase();
}

function normalizeMotionClipDurationMs(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.max(1, Math.round(numericValue));
}

function notifyMotionClipDurationListeners() {
  motionClipDurationVersion += 1;
  motionClipDurationListeners.forEach((listener) => listener());
}

export function registerAvatar3DMotionClipDurationEntries(entries: MotionClipDurationEntry[]) {
  let changed = false;

  entries.forEach((entry) => {
    const lookupKey = normalizeMotionClipDurationLookupKey(entry.name);
    const durationMs = normalizeMotionClipDurationMs(entry.durationMs);
    if (!lookupKey || durationMs === null) {
      return;
    }

    const previousDurationMs = motionClipDurationByName.get(lookupKey) ?? 0;
    const nextDurationMs = Math.max(previousDurationMs, durationMs);
    if (nextDurationMs === previousDurationMs) {
      return;
    }

    motionClipDurationByName.set(lookupKey, nextDurationMs);
    changed = true;
  });

  if (changed) {
    notifyMotionClipDurationListeners();
  }
}

export function resolveAvatar3DMotionClipDurationMs(candidateNames: string[]) {
  return candidateNames.reduce<number | null>((resolvedDurationMs, candidateName) => {
    const lookupKey = normalizeMotionClipDurationLookupKey(candidateName);
    if (!lookupKey) {
      return resolvedDurationMs;
    }

    const candidateDurationMs = motionClipDurationByName.get(lookupKey);
    if (!candidateDurationMs) {
      return resolvedDurationMs;
    }

    return Math.max(resolvedDurationMs ?? 0, candidateDurationMs);
  }, null);
}

export function getAvatar3DMotionClipDurationVersion() {
  return motionClipDurationVersion;
}

export function subscribeAvatar3DMotionClipDurations(listener: MotionClipDurationListener) {
  motionClipDurationListeners.add(listener);
  return () => {
    motionClipDurationListeners.delete(listener);
  };
}
