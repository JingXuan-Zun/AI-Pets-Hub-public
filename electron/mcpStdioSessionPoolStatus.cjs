const { normalizeMcpSessionCloseReason } = require('./mcpStdioSessionCloseReason.cjs');

function shouldExposeClosedRestartStatus(restartStatus) {
  return restartStatus?.status === 'cooldown';
}

function createSessionStatus(entry, idleTimeoutMs, lastCloseEvent) {
  const closeInfo = entry.session.closed
    ? normalizeMcpSessionCloseReason(entry.session.closeReason)
    : null;

  return {
    closed: Boolean(entry.session.closed),
    closeKind: closeInfo?.kind ?? null,
    closeReason: closeInfo?.reason ?? null,
    idleTimeoutMs,
    lastCloseKind: lastCloseEvent?.kind ?? null,
    lastCloseReason: lastCloseEvent?.reason ?? null,
    lastClosedAt: lastCloseEvent?.at ?? null,
    lastUsedAt: entry.lastUsedAt,
    pendingCount: entry.session.pending?.size ?? 0,
    serverId: entry.serverId,
  };
}

function addRestartStatus(status, restartStatus) {
  return {
    ...status,
    nextRestartAt: restartStatus?.nextRestartAt ?? null,
    restartConsecutiveFailures: restartStatus?.consecutiveFailures ?? 0,
    restartLastError: restartStatus?.lastError ?? null,
    restartLastFailureAt: restartStatus?.lastFailureAt ?? null,
    restartLastStartedAt: restartStatus?.lastRestartAt ?? null,
    restartStatus: restartStatus?.status ?? 'unknown',
    restartWaitMs: restartStatus?.restartWaitMs ?? 0,
  };
}

function createClosedSessionStatus(serverId, idleTimeoutMs, lastCloseEvent, restartStatus) {
  return addRestartStatus({
    closed: true,
    closeKind: lastCloseEvent?.kind ?? null,
    closeReason: lastCloseEvent?.reason ?? null,
    idleTimeoutMs,
    lastCloseKind: lastCloseEvent?.kind ?? null,
    lastCloseReason: lastCloseEvent?.reason ?? null,
    lastClosedAt: lastCloseEvent?.at ?? null,
    lastUsedAt: null,
    pendingCount: 0,
    serverId,
  }, restartStatus);
}

function createSessionPoolStatuses(entries, lastCloseEvents, restartPolicy, idleTimeoutMs) {
  const statuses = [...entries.values()].map((entry) => addRestartStatus(
    createSessionStatus(entry, idleTimeoutMs, lastCloseEvents.get(entry.serverId)),
    restartPolicy.getStatus(entry.serverId),
  ));

  for (const restartStatus of restartPolicy.listStatuses()) {
    if (!entries.has(restartStatus.serverId) && shouldExposeClosedRestartStatus(restartStatus)) {
      statuses.push(createClosedSessionStatus(
        restartStatus.serverId,
        idleTimeoutMs,
        lastCloseEvents.get(restartStatus.serverId),
        restartStatus,
      ));
    }
  }

  return statuses;
}

module.exports = {
  createSessionPoolStatuses,
};
