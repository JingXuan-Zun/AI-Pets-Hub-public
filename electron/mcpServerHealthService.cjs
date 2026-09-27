const DEFAULT_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 30_000;

function normalizeNowProvider(value) {
  return typeof value === 'function' ? value : () => Date.now();
}

function normalizeBackoffMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(MAX_BACKOFF_MS, Math.round(parsed)));
}

function normalizeErrorText(error) {
  return error instanceof Error ? error.message : String(error ?? '');
}

function createInitialStatus(serverId) {
  return {
    consecutiveFailures: 0,
    lastError: null,
    lastFailureAt: null,
    lastOkAt: null,
    lastRecoveryAt: null,
    nextRetryAt: null,
    serverId,
    status: 'unknown',
  };
}

function cloneStatus(status) {
  return {
    ...status,
  };
}

function createMcpServerHealthService(options = {}) {
  const now = normalizeNowProvider(options.now);
  const baseBackoffMs = normalizeBackoffMs(options.baseBackoffMs, DEFAULT_BACKOFF_MS);
  const maxBackoffMs = normalizeBackoffMs(options.maxBackoffMs, MAX_BACKOFF_MS);
  const statuses = new Map();

  function getMutableStatus(serverId) {
    const normalizedServerId = String(serverId ?? '').trim();
    if (!statuses.has(normalizedServerId)) {
      statuses.set(normalizedServerId, createInitialStatus(normalizedServerId));
    }

    return statuses.get(normalizedServerId);
  }

  function recordSuccess(serverId) {
    const status = getMutableStatus(serverId);
    const recovered = status.status === 'unhealthy' || status.consecutiveFailures > 0;
    status.consecutiveFailures = 0;
    status.lastError = null;
    status.lastOkAt = now();
    status.lastRecoveryAt = recovered ? status.lastOkAt : status.lastRecoveryAt;
    status.nextRetryAt = null;
    status.status = 'ok';
    return cloneStatus(status);
  }

  function recordFailure(serverId, error) {
    const status = getMutableStatus(serverId);
    const failedAt = now();
    status.consecutiveFailures += 1;
    status.lastError = normalizeErrorText(error);
    status.lastFailureAt = failedAt;
    status.nextRetryAt = failedAt + Math.min(
      maxBackoffMs,
      baseBackoffMs * (2 ** Math.max(0, status.consecutiveFailures - 1)),
    );
    status.status = 'unhealthy';
    return cloneStatus(status);
  }

  function getRetryGate(serverId) {
    const status = getMutableStatus(serverId);
    const retryAt = Number(status.nextRetryAt ?? 0);
    if (status.status !== 'unhealthy' || retryAt <= now()) {
      return { allowed: true, status: cloneStatus(status), waitMs: 0 };
    }

    return {
      allowed: false,
      reason: `MCP server ${status.serverId} is cooling down after failure: ${status.lastError || 'unknown error'}`,
      status: cloneStatus(status),
      waitMs: retryAt - now(),
    };
  }

  function getStatus(serverId) {
    return cloneStatus(getMutableStatus(serverId));
  }

  function listStatuses() {
    return [...statuses.values()].map(cloneStatus);
  }

  function resetStatus(serverId) {
    const normalizedServerId = String(serverId ?? '').trim();
    if (!normalizedServerId) {
      return false;
    }

    return statuses.delete(normalizedServerId);
  }

  function resetAll() {
    const count = statuses.size;
    statuses.clear();
    return count;
  }

  return {
    getRetryGate,
    getStatus,
    listStatuses,
    recordFailure,
    recordSuccess,
    resetAll,
    resetStatus,
  };
}

module.exports = {
  createMcpServerHealthService,
};
