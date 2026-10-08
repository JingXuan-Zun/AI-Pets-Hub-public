const { createSessionPoolStatuses } = require('./mcpStdioSessionPoolStatus.cjs');

function shouldResetRestartPolicy(reason) {
  return ['app-quit', 'client-dispose', 'config-save', 'manual-reset'].includes(String(reason ?? ''));
}

function createMcpPoolControls({ entries, lastCloseEvents, restartPolicy, idleTimeoutMs, discardEntry }) {
  function discard(serverId, reason = 'discarded') {
    const result = discardEntry(serverId, reason);
    if (shouldResetRestartPolicy(reason)) {
      restartPolicy.reset(serverId);
    }
    return result.closed;
  }

  function getStatus() {
    return createSessionPoolStatuses(entries, lastCloseEvents, restartPolicy, idleTimeoutMs);
  }

  function dispose(reason = 'dispose') {
    const count = entries.size;
    for (const serverId of [...entries.keys()]) {
      discard(serverId, reason);
    }
    if (shouldResetRestartPolicy(reason)) {
      restartPolicy.resetAll();
    }
    return count;
  }

  return { discard, dispose, getStatus };
}

module.exports = { createMcpPoolControls };
