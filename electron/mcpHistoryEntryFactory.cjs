const SENSITIVE_TEXT_PATTERN = /(token|password|secret|apikey|api_key)\s*[=:]\s*[^,\s}]+/giu;

function compactText(value, limit = 480) {
  const text = String(value ?? '')
    .replace(SENSITIVE_TEXT_PATTERN, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function createMcpDiagnosticHistoryEntry(result) {
  return {
    durationMs: Number(result?.durationMs ?? 0),
    error: result?.ok ? null : compactText(result?.error),
    ok: Boolean(result?.ok),
    serverId: String(result?.serverId ?? ''),
    status: result?.ok ? 'ok' : 'error',
    toolCount: Number(result?.toolCount ?? 0),
    type: 'diagnostic',
  };
}

function createMcpToolCallStartHistoryEntry(call) {
  return {
    ok: null,
    requestId: String(call?.requestId ?? ''),
    serverId: String(call?.serverId ?? ''),
    status: 'started',
    toolName: String(call?.toolName ?? call?.name ?? ''),
    type: 'tool-call',
  };
}

function createMcpToolCallResultHistoryEntry(call) {
  return {
    durationMs: Number(call?.durationMs ?? 0),
    error: call?.ok ? null : compactText(call?.error),
    ok: Boolean(call?.ok),
    requestId: String(call?.requestId ?? ''),
    serverId: String(call?.serverId ?? ''),
    status: call?.ok ? 'ok' : String(call?.status ?? 'error'),
    toolName: String(call?.toolName ?? call?.name ?? ''),
    type: 'tool-call',
  };
}

function createMcpCancellationHistoryEntry(result) {
  return {
    error: result?.cancelled ? null : compactText(result?.error),
    ok: Boolean(result?.ok ?? result?.cancelled),
    requestId: String(result?.requestId ?? ''),
    serverId: String(result?.serverId ?? ''),
    status: result?.cancelled ? 'cancelled' : 'missed',
    toolName: String(result?.toolName ?? ''),
    type: 'cancellation',
  };
}

function createMcpSessionHistoryEntry(event) {
  return {
    closeKind: event?.closeKind ? String(event.closeKind) : null,
    error: event?.error ? compactText(event.error) : null,
    ok: Boolean(event?.ok),
    retryAfterMs: Number.isFinite(Number(event?.retryAfterMs))
      ? Math.max(0, Math.round(Number(event.retryAfterMs)))
      : null,
    serverId: String(event?.serverId ?? ''),
    status: String(event?.status ?? event?.event ?? 'unknown'),
    type: 'session',
  };
}

module.exports = {
  compactText,
  createMcpCancellationHistoryEntry,
  createMcpDiagnosticHistoryEntry,
  createMcpSessionHistoryEntry,
  createMcpToolCallResultHistoryEntry,
  createMcpToolCallStartHistoryEntry,
};
