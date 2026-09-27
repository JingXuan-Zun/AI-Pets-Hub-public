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

function createMcpStdioSessionRestartPolicy(options = {}) {
  const now = normalizeNowProvider(options.now);
  const baseBackoffMs = normalizeBackoffMs(options.baseBackoffMs, DEFAULT_RESTART_BACKOFF_MS);
  const maxBackoffMs = normalizeBackoffMs(options.maxBackoffMs, MAX_RESTART_BACKOFF_MS);
  const statuses = new Map();

  function getMutableStatus(serverId) {
    const normalizedServerId = String(serverId ?? '').trim();
    if (!statuses.has(normalizedServerId)) {
      statuses.set(normalizedServerId, createInitialStatus(normalizedServerId));
    }

    return statuses.get(normalizedServerId);
  }

  function getGate(serverId) {
    const status = getMutableStatus(serverId);
    const retryAt = Number(status.nextRestartAt ?? 0);
    if (status.status !== 'cooldown' || retryAt <= now()) {
      return { allowed: true, status: cloneStatus(status, now()), waitMs: 0 };
    }

    const waitMs = retryAt - now();
    return {
      allowed: false,
      reason: `MCP session ${status.serverId} restart cooling down after failure: ${status.lastError || 'unknown error'}`,
      status: cloneStatus(status, now()),
      waitMs,
    };
  }

  function recordStart(serverId) {
    const status = getMutableStatus(serverId);
    status.lastRestartAt = now();
    status.status = 'starting';
    return cloneStatus(status, now());
  }

  function recordSuccess(serverId) {
    const status = getMutableStatus(serverId);
    status.consecutiveFailures = 0;
    status.lastError = null;
    status.nextRestartAt = null;
    status.status = 'ok';
    return cloneStatus(status, now());
  }

  function recordFailure(serverId, error) {
    const status = getMutableStatus(serverId);
    const failedAt = now();
    status.consecutiveFailures += 1;
    status.lastError = normalizeErrorText(error);
    status.lastFailureAt = failedAt;
    status.nextRestartAt = failedAt + Math.min(
      maxBackoffMs,
      baseBackoffMs * (2 ** Math.max(0, status.consecutiveFailures - 1)),
    );
    status.status = 'cooldown';
    return cloneStatus(status, now());
  }

  function getStatus(serverId) {
    return cloneStatus(getMutableStatus(serverId), now());
  }

  function listStatuses() {
    return [...statuses.values()].map((status) => cloneStatus(status, now()));
  }

  function reset(serverId) {
    return statuses.delete(String(serverId ?? '').trim());
  }

  function resetAll() {
    const count = statuses.size;
    statuses.clear();
    return count;
  }

  return {
    getGate,
    getStatus,
    listStatuses,
    recordFailure,
    recordStart,
    recordSuccess,
    reset,
    resetAll,
  };
}

module.exports = {
  createMcpStdioSessionRestartPolicy,
};
