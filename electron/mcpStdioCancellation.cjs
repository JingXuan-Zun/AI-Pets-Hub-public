function cancelMcpToolCall(activeToolCalls, history, request) {
  const requestId = typeof request.requestId === 'string' ? request.requestId.trim() : '';
  const activeCall = requestId ? activeToolCalls.get(requestId) : null;
  if (!requestId || !activeCall) {
    const result = { cancelled: false, error: 'No active MCP tool call matched the requestId.', requestId };
    history?.recordCancellation?.(result);
    return result;
  }

  const cancelled = activeCall.close();
  activeToolCalls.delete(requestId);
  const result = {
    cancelled,
    ok: cancelled,
    requestId,
    serverId: activeCall.serverId,
    toolName: activeCall.name,
  };
  history?.recordCancellation?.(result);
  return result;
}

module.exports = { cancelMcpToolCall };
