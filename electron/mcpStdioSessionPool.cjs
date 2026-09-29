const {
  closeMcpProcess,
  createMcpProcess,
  initializeMcpSession,
  sendRpc,
} = require('./mcpStdioSession.cjs');
const { normalizeMcpSessionCloseReason } = require('./mcpStdioSessionCloseReason.cjs');
const { createSessionPoolStatuses } = require('./mcpStdioSessionPoolStatus.cjs');
const { createMcpStdioSessionRestartPolicy } = require('./mcpStdioSessionRestartPolicy.cjs');

const DEFAULT_IDLE_TIMEOUT_MS = 300_000;

function normalizeIdleTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_IDLE_TIMEOUT_MS;
  }

  return Math.max(0, Math.round(parsed));
}

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

function shouldRecordRestartFailure(closeEvent) {
  return closeEvent
    && !['app-quit', 'cancelled', 'client-dispose', 'config-save', 'idle-timeout', 'manual-reset', 'replaced'].includes(closeEvent.kind);
}

function shouldResetRestartPolicy(reason) {
  return ['app-quit', 'client-dispose', 'config-save', 'manual-reset'].includes(String(reason ?? ''));
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

function clearEntryIdleTimer(entry) {
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }
}

function createMcpStdioSessionPool(options = {}) {
  const log = typeof options.log === 'function' ? options.log : null;
  const history = options.history || null;
  const idleTimeoutMs = normalizeIdleTimeoutMs(options.idleTimeoutMs);
  const entries = new Map();
  const lastCloseEvents = new Map();
  const restartPolicy = options.restartPolicy || createMcpStdioSessionRestartPolicy({
    baseBackoffMs: options.restartBackoffMs,
    maxBackoffMs: options.maxRestartBackoffMs,
    now: options.now,
  });

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

  async function runRpc(server, method, params, timeoutMs) {
    const entry = getEntry(server);
    clearEntryIdleTimer(entry);
    const run = entry.inFlight
      .catch(() => undefined)
      .then(async () => {
        await entry.ready;
        const recovering = restartPolicy.getStatus(server.id).consecutiveFailures > 0;
        const result = await sendRpc(entry.session, method, params, timeoutMs);
        restartPolicy.recordSuccess(server.id);
        if (recovering) {
          history?.recordSessionEvent?.({
            ok: true,
            serverId: server.id,
            status: 'restart-recovered',
          });
        }
        return result;
      });
    entry.inFlight = run;

    try {
      const result = await run;
      entry.lastUsedAt = Date.now();
      scheduleIdleEviction(server.id, entry);
      return result;
    } catch (error) {
      if (entries.get(server.id) === entry) {
        const discarded = discardEntry(server.id, `rpc-failed:${method}`);
        recordRestartFailure(server.id, discarded.closeEvent, error);
      }
      throw error;
    }
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

  return {
    discard,
    dispose,
    getStatus,
    runRpc,
  };
}

module.exports = {
  createMcpStdioSessionPool,
};
