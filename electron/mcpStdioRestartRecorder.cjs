const { cloneStatus, normalizeErrorText } = require('./mcpStdioRestartPolicyRules.cjs');

function createMcpRestartRecorder({ getMutableStatus, now, baseBackoffMs, maxBackoffMs }) {
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

  return { recordStart, recordSuccess, recordFailure };
}

module.exports = { createMcpRestartRecorder };
