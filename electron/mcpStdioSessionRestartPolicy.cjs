const { DEFAULT_RESTART_BACKOFF_MS, MAX_RESTART_BACKOFF_MS, normalizeNowProvider, normalizeBackoffMs, cloneStatus } = require('./mcpStdioRestartPolicyRules.cjs');
const { createMcpRestartStatusStore } = require('./mcpStdioRestartStatusStore.cjs');
const { createMcpRestartRecorder } = require('./mcpStdioRestartRecorder.cjs');

function createMcpStdioSessionRestartPolicy(options = {}) {
  const now = normalizeNowProvider(options.now);
  const baseBackoffMs = normalizeBackoffMs(options.baseBackoffMs, DEFAULT_RESTART_BACKOFF_MS);
  const maxBackoffMs = normalizeBackoffMs(options.maxBackoffMs, MAX_RESTART_BACKOFF_MS);
  const statuses = new Map();
  const { getMutableStatus, getStatus, listStatuses, reset, resetAll } = createMcpRestartStatusStore({ statuses, now });
  const { recordStart, recordSuccess, recordFailure } = createMcpRestartRecorder({ getMutableStatus, now, baseBackoffMs, maxBackoffMs });

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

module.exports = { createMcpStdioSessionRestartPolicy };
