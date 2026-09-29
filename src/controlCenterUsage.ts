export interface ModelUsageSnapshot {
  completionTokens: number;
  lastModel: string | null;
  lastUpdatedAt: number | null;
  promptTokens: number;
  reportedRequestCount: number;
  totalTokens: number;
}

export interface SoftwareRuntimeSnapshot {
  accumulatedMs: number;
  sessionMs: number;
  totalMs: number;
}

const MODEL_USAGE_EVENT = 'desktop-pet:model-usage-updated';
const MODEL_USAGE_KEY = 'desktop-pet:model-usage:v1';
const SOFTWARE_RUNTIME_KEY = 'desktop-pet:software-runtime:v1';

const EMPTY_MODEL_USAGE: ModelUsageSnapshot = {
  completionTokens: 0,
  lastModel: null,
  lastUpdatedAt: null,
  promptTokens: 0,
  reportedRequestCount: 0,
  totalTokens: 0,
};

let runtimeStartedAt = Date.now();
let persistedRuntimeMs = 0;
let lastRuntimePersistedAt = runtimeStartedAt;
let initialized = false;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canReadDesktopAppRuntime() {
  return typeof window !== 'undefined'
    && typeof window.desktopPetShell?.getAppRuntimeInfo === 'function';
}

function finiteNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function readJson(key: string) {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Usage telemetry must never prevent the app from responding to a user.
  }
}

function normalizeModelUsage(value: unknown): ModelUsageSnapshot {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    completionTokens: finiteNonNegative(source.completionTokens) ?? 0,
    lastModel: typeof source.lastModel === 'string' && source.lastModel.trim() ? source.lastModel.trim() : null,
    lastUpdatedAt: finiteNonNegative(source.lastUpdatedAt),
    promptTokens: finiteNonNegative(source.promptTokens) ?? 0,
    reportedRequestCount: finiteNonNegative(source.reportedRequestCount) ?? 0,
    totalTokens: finiteNonNegative(source.totalTokens) ?? 0,
  };
}

export function initializeControlCenterUsageTracking() {
  if (initialized) return;
  initialized = true;

  // The Electron main process is the only authoritative clock.  A renderer
  // fallback remains for browser development, where there is no main process.
  if (canReadDesktopAppRuntime()) return;

  const stored = readJson(SOFTWARE_RUNTIME_KEY) as Record<string, unknown> | null;
  persistedRuntimeMs = finiteNonNegative(stored?.accumulatedMs) ?? 0;
  runtimeStartedAt = Date.now();
  lastRuntimePersistedAt = runtimeStartedAt;

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', persistSoftwareRuntimeUsage);
  }
}

export function getModelUsageSnapshot() {
  return normalizeModelUsage(readJson(MODEL_USAGE_KEY) ?? EMPTY_MODEL_USAGE);
}

export function recordModelUsage(input: {
  completionTokens?: unknown;
  model?: string | null;
  promptTokens?: unknown;
  totalTokens?: unknown;
}) {
  const promptTokens = finiteNonNegative(input.promptTokens);
  const completionTokens = finiteNonNegative(input.completionTokens);
  const totalTokens = finiteNonNegative(input.totalTokens)
    ?? (promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null);

  // Some compatible providers omit usage entirely. Do not estimate and label it as real usage.
  if (totalTokens === null) return;

  const current = getModelUsageSnapshot();
  const next: ModelUsageSnapshot = {
    completionTokens: current.completionTokens + (completionTokens ?? 0),
    lastModel: input.model?.trim() || current.lastModel,
    lastUpdatedAt: Date.now(),
    promptTokens: current.promptTokens + (promptTokens ?? 0),
    reportedRequestCount: current.reportedRequestCount + 1,
    totalTokens: current.totalTokens + totalTokens,
  };
  writeJson(MODEL_USAGE_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MODEL_USAGE_EVENT));
  }
}

export function subscribeToModelUsage(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(MODEL_USAGE_EVENT, listener);
  const storageListener = (event: StorageEvent) => {
    if (event.key === MODEL_USAGE_KEY) listener();
  };
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener(MODEL_USAGE_EVENT, listener);
    window.removeEventListener('storage', storageListener);
  };
}

export function getSoftwareRuntimeSnapshot(): SoftwareRuntimeSnapshot {
  initializeControlCenterUsageTracking();
  const now = Date.now();
  const sessionMs = Math.max(0, now - runtimeStartedAt);
  const unpersistedMs = Math.max(0, now - lastRuntimePersistedAt);
  return {
    accumulatedMs: persistedRuntimeMs + unpersistedMs,
    sessionMs,
    totalMs: persistedRuntimeMs + unpersistedMs,
  };
}

export function persistSoftwareRuntimeUsage() {
  initializeControlCenterUsageTracking();
  if (canReadDesktopAppRuntime()) return;
  const now = Date.now();
  persistedRuntimeMs += Math.max(0, now - lastRuntimePersistedAt);
  lastRuntimePersistedAt = now;
  writeJson(SOFTWARE_RUNTIME_KEY, { accumulatedMs: persistedRuntimeMs });
}

export async function loadSoftwareRuntimeSnapshot(): Promise<SoftwareRuntimeSnapshot> {
  if (canReadDesktopAppRuntime()) {
    try {
      const snapshot = await window.desktopPetShell?.getAppRuntimeInfo?.();
      if (snapshot) {
        const totalMs = finiteNonNegative(snapshot.totalMs);
        const sessionMs = finiteNonNegative(snapshot.sessionMs);
        if (totalMs !== null && sessionMs !== null) {
          return {
            accumulatedMs: Math.max(0, totalMs - sessionMs),
            sessionMs,
            totalMs,
          };
        }
      }
    } catch {
      // The overview can still show the renderer fallback if the bridge is unavailable.
    }
  }
  return getSoftwareRuntimeSnapshot();
}
