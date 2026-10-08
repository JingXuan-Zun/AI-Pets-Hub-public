function createMcpSessionManagement(sessionPool) {
  function dispose(reason = 'client-dispose') {
    return sessionPool?.dispose?.(reason) ?? 0;
  }

  function getSessionStatus() {
    return sessionPool?.getStatus?.() ?? [];
  }

  function resetSession(request = {}) {
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    if (!sessionPool) {
      return { closedCount: 0, ok: true, serverId };
    }

    const closeReason = 'manual-reset';
    const closedCount = serverId
      ? Number(Boolean(sessionPool.discard(serverId, closeReason)))
      : sessionPool.dispose(closeReason);
    return {
      closedAt: closedCount ? Date.now() : null,
      closedCount,
      closeKind: closedCount ? closeReason : null,
      closeReason: closedCount ? closeReason : null,
      ok: true,
      serverId,
    };
  }

  return { dispose, getSessionStatus, resetSession };
}

module.exports = { createMcpSessionManagement };
