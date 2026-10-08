const {
  createTextContent,
  normalizeToolCallResult,
  inferMcpCallErrorStatus,
  shouldRecordServerFailure,
} = require('./mcpStdioClientRules.cjs');
const { closeOneShotSession } = require('./mcpStdioToolCallRunner.cjs');

function completeMcpToolCall(result, server, health, history, context) {
  const normalizedResult = normalizeToolCallResult(result);
  health?.recordSuccess?.(server.id);
  history?.recordToolCallResult?.({
    durationMs: Date.now() - context.startedAt,
    error: normalizedResult.content[0]?.text ?? '',
    ok: !normalizedResult.isError,
    requestId: context.requestId,
    serverId: context.serverId,
    status: normalizedResult.isError ? 'error' : 'ok',
    toolName: context.name,
  });
  return normalizedResult;
}

function failMcpToolCall(error, server, health, history, context) {
  const status = inferMcpCallErrorStatus(error);
  if (shouldRecordServerFailure(status)) {
    health?.recordFailure?.(server.id, error);
  }
  history?.recordToolCallResult?.({
    durationMs: Date.now() - context.startedAt,
    error: error?.message || String(error),
    ok: false,
    requestId: context.requestId,
    serverId: context.serverId,
    status,
    toolName: context.name,
  });
  return {
    content: [createTextContent(error?.message || String(error))],
    isError: true,
    structuredContent: null,
  };
}

function cleanupMcpToolCall(clearActiveToolCallRef, sessionRef) {
  clearActiveToolCallRef.current();
  closeOneShotSession(sessionRef);
}

module.exports = { completeMcpToolCall, failMcpToolCall, cleanupMcpToolCall };
