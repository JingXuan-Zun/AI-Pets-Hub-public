const DEFAULT_RESTART_BACKOFF_MS = 1500;

const MAX_RESTART_BACKOFF_MS = 30_000;

function normalizeNowProvider(value) {
  return typeof value === 'function' ? value : () => Date.now();
}

function normalizeBackoffMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(MAX_RESTART_BACKOFF_MS, Math.round(parsed)));
}

function normalizeErrorText(error) {
  return error instanceof Error ? error.message : String(error ?? '');
}

function cloneStatus(status, now) {
  const nextRestartAt = Number(status.nextRestartAt ?? 0);
  return {
    ...status,
    restartWaitMs: nextRestartAt > now ? nextRestartAt - now : 0,
  };
}

function createInitialStatus(serverId) {
  return {
    consecutiveFailures: 0,
    lastError: null,
    lastFailureAt: null,
    lastRestartAt: null,
    nextRestartAt: null,
    serverId,
    status: 'unknown',
  };
}

module.exports = { DEFAULT_RESTART_BACKOFF_MS, MAX_RESTART_BACKOFF_MS, normalizeNowProvider, normalizeBackoffMs, normalizeErrorText, cloneStatus, createInitialStatus };
