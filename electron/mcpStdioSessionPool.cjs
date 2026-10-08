const { createMcpPoolRpc } = require('./mcpStdioPoolRpc.cjs');
const { createMcpPoolControls } = require('./mcpStdioPoolControls.cjs');
const { createMcpPoolEntryGetter } = require('./mcpStdioPoolEntry.cjs');
const { createMcpPoolClosure } = require('./mcpStdioPoolClosure.cjs');
const { createMcpIdleEviction } = require('./mcpStdioIdleEviction.cjs');
const { createMcpStdioSessionRestartPolicy } = require('./mcpStdioSessionRestartPolicy.cjs');

const DEFAULT_IDLE_TIMEOUT_MS = 300_000;

function normalizeIdleTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_IDLE_TIMEOUT_MS;
  }

  return Math.max(0, Math.round(parsed));
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

  const { discardEntry, recordRestartFailure } = createMcpPoolClosure({ entries, lastCloseEvents, restartPolicy, history });
  const { discard, dispose, getStatus } = createMcpPoolControls({
    entries,
    lastCloseEvents,
    restartPolicy,
    idleTimeoutMs,
    discardEntry,
  });
  const { scheduleIdleEviction } = createMcpIdleEviction({ entries, idleTimeoutMs, discard });
  const getEntry = createMcpPoolEntryGetter({
    entries,
    log,
    history,
    restartPolicy,
    discardEntry,
    recordRestartFailure,
    scheduleIdleEviction,
  });

  const runRpc = createMcpPoolRpc({
    entries,
    getEntry,
    restartPolicy,
    history,
    scheduleIdleEviction,
    discardEntry,
    recordRestartFailure,
  });

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
