const DIRECT_CLOSE_REASON_KINDS = new Set([
  'app-quit',
  'cancelled',
  'client-dispose',
  'config-save',
  'discarded',
  'idle-timeout',
  'manual-reset',
  'replaced',
]);

function normalizeMcpSessionCloseReason(reason) {
  const normalizedReason = String(reason || 'unknown').trim() || 'unknown';
  const separatorIndex = normalizedReason.indexOf(':');
  const prefix = separatorIndex >= 0
    ? normalizedReason.slice(0, separatorIndex)
    : normalizedReason;

  if (DIRECT_CLOSE_REASON_KINDS.has(prefix)) {
    return { kind: prefix, reason: normalizedReason };
  }

  if (prefix === 'rpc-failed') {
    return { kind: 'rpc-failed', reason: normalizedReason };
  }

  if (/timed out|timeout/i.test(normalizedReason)) {
    return { kind: 'rpc-timeout', reason: normalizedReason };
  }

  if (/exited/i.test(normalizedReason)) {
    return { kind: 'process-exit', reason: normalizedReason };
  }

  if (/cancelled|canceled/i.test(normalizedReason)) {
    return { kind: 'cancelled', reason: normalizedReason };
  }

  return { kind: 'unknown', reason: normalizedReason };
}

module.exports = {
  normalizeMcpSessionCloseReason,
};
