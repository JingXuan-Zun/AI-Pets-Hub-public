function clearEntryIdleTimer(entry) {
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }
}

function createMcpIdleEviction({ entries, idleTimeoutMs, discard }) {
  function evictIdleEntry(serverId, entry) {
    if (entries.get(serverId) !== entry || entry.session.closed) {
      return false;
    }

    if ((entry.session.pending?.size ?? 0) > 0) {
      scheduleIdleEviction(serverId, entry);
      return false;
    }

    return discard(serverId, 'idle-timeout');
  }

  function scheduleIdleEviction(serverId, entry) {
    if (idleTimeoutMs <= 0 || entry.session.closed) {
      return;
    }

    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
    }
    entry.idleTimer = setTimeout(() => {
      evictIdleEntry(serverId, entry);
    }, idleTimeoutMs);
    if (typeof entry.idleTimer.unref === 'function') {
      entry.idleTimer.unref();
    }
  }

  return { scheduleIdleEviction };
}

module.exports = { clearEntryIdleTimer, createMcpIdleEviction };
