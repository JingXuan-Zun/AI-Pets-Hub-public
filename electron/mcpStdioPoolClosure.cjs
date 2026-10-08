const { closeMcpProcess } = require('./mcpStdioSession.cjs');
const { normalizeMcpSessionCloseReason } = require('./mcpStdioSessionCloseReason.cjs');
const { clearEntryIdleTimer } = require('./mcpStdioIdleEviction.cjs');

function shouldRecordRestartFailure(closeEvent) {
  return closeEvent
    && !['app-quit', 'cancelled', 'client-dispose', 'config-save', 'idle-timeout', 'manual-reset', 'replaced'].includes(closeEvent.kind);
}

function createCloseEvent(serverId, reason) {
  const normalized = normalizeMcpSessionCloseReason(reason);
  return {
    at: Date.now(),
    kind: normalized.kind,
    reason: normalized.reason,
    serverId,
  };
}

function closeEntry(entry, reason) {
  if (!entry) {
    return false;
  }

  clearEntryIdleTimer(entry);
  return closeMcpProcess(entry.session, reason);
}

function createMcpPoolClosure({ entries, lastCloseEvents, restartPolicy, history }) {
  function getEntryCloseReason(entry, fallbackReason) {
    return entry.session.closed
      ? (entry.session.closeReason || fallbackReason)
      : fallbackReason;
  }

  function discardEntry(serverId, reason = 'discarded') {
    const entry = entries.get(serverId);
    entries.delete(serverId);
    if (!entry) {
      return { closeEvent: null, closed: false };
    }

    const closeReason = getEntryCloseReason(entry, reason);
    const closeEvent = createCloseEvent(serverId, closeReason);
    lastCloseEvents.set(serverId, closeEvent);
    return {
      closeEvent,
      closed: closeEntry(entry, closeEvent.reason),
    };
  }

  function recordRestartFailure(serverId, closeEvent, error) {
    if (shouldRecordRestartFailure(closeEvent)) {
      const status = restartPolicy.recordFailure(serverId, error || closeEvent.reason);
      history?.recordSessionEvent?.({
        closeKind: closeEvent.kind,
        error: status.lastError,
        ok: false,
        retryAfterMs: status.restartWaitMs,
        serverId,
        status: 'restart-cooldown',
      });
    }
  }

  return { discardEntry, recordRestartFailure };
}

module.exports = { createMcpPoolClosure };
