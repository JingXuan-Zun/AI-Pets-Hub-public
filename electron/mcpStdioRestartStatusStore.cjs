const { createInitialStatus, cloneStatus } = require('./mcpStdioRestartPolicyRules.cjs');

function createMcpRestartStatusStore({ statuses, now }) {
  function getMutableStatus(serverId) {
    const normalizedServerId = String(serverId ?? '').trim();
    if (!statuses.has(normalizedServerId)) {
      statuses.set(normalizedServerId, createInitialStatus(normalizedServerId));
    }

    return statuses.get(normalizedServerId);
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

  return { getMutableStatus, getStatus, listStatuses, reset, resetAll };
}

module.exports = { createMcpRestartStatusStore };
