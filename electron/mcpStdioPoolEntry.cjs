const { createMcpProcess, initializeMcpSession } = require('./mcpStdioSession.cjs');

function createSessionKey(server) {
  return [
    server.id,
    server.command,
    JSON.stringify(server.args ?? []),
    server.cwd,
  ].join('\u001f');
}

function createPoolEntry(server, log) {
  const session = createMcpProcess(server, log);
  return {
    inFlight: Promise.resolve(),
    idleTimer: null,
    key: createSessionKey(server),
    lastUsedAt: Date.now(),
    ready: initializeMcpSession(session, server),
    serverId: server.id,
    session,
  };
}

function shouldReuseEntry(entry, server) {
  return entry
    && !entry.session.closed
    && entry.key === createSessionKey(server);
}

function createMcpPoolEntryGetter({ entries, log, history, restartPolicy, discardEntry, recordRestartFailure, scheduleIdleEviction }) {
  function getEntry(server) {
    const current = entries.get(server.id);
    if (shouldReuseEntry(current, server)) {
      return current;
    }

    const configChanged = current && current.key !== createSessionKey(server);
    const discarded = discardEntry(server.id, 'replaced');
    if (configChanged) {
      restartPolicy.reset(server.id);
    } else {
      recordRestartFailure(server.id, discarded.closeEvent);
    }

    const gate = restartPolicy.getGate(server.id);
    if (!gate.allowed) {
      history?.recordSessionEvent?.({
        error: gate.reason,
        ok: false,
        retryAfterMs: gate.waitMs,
        serverId: server.id,
        status: 'restart-blocked',
      });
      throw new Error(`${gate.reason}${gate.waitMs ? ` Retry in ${Math.ceil(gate.waitMs)}ms.` : ''}`);
    }

    restartPolicy.recordStart(server.id);
    const next = createPoolEntry(server, log);
    entries.set(server.id, next);
    scheduleIdleEviction(server.id, next);
    return next;
  }

  return getEntry;
}

module.exports = { createMcpPoolEntryGetter };
