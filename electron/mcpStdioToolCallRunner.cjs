const { parseJsonObject } = require('./mcpServerConfigLoader.cjs');
const {
  closeMcpProcess,
  createMcpProcess,
  initializeMcpSession,
  sendRpc,
} = require('./mcpStdioSession.cjs');
const { callHttpMcpTool } = require('./mcpHttpClient.cjs');

function createActiveToolCall(activeToolCalls, requestId, serverId, name, close) {
  if (!requestId) {
    return () => {};
  }

  activeToolCalls.set(requestId, { close, name, serverId });
  return () => activeToolCalls.delete(requestId);
}

async function runWithPooledSession(options) {
  options.clearActiveToolCallRef.current = createActiveToolCall(
    options.activeToolCalls,
    options.requestId,
    options.serverId,
    options.name,
    () => options.sessionPool.discard(options.serverId, 'cancelled'),
  );
  return options.sessionPool.runRpc(options.server, 'tools/call', {
    arguments: parseJsonObject(options.arguments),
    name: options.name,
  }, options.server.timeoutMs);
}

async function runWithOneShotSession(options) {
  const session = createMcpProcess(options.server, options.log);
  options.sessionRef.current = session;
  options.clearActiveToolCallRef.current = createActiveToolCall(
    options.activeToolCalls,
    options.requestId,
    options.serverId,
    options.name,
    () => closeMcpProcess(session, 'cancelled'),
  );
  await initializeMcpSession(session, options.server);
  return sendRpc(session, 'tools/call', {
    arguments: parseJsonObject(options.arguments),
    name: options.name,
  }, options.server.timeoutMs);
}

async function runWithHttp(options) {
  const controller = new AbortController();
  options.clearActiveToolCallRef.current = createActiveToolCall(
    options.activeToolCalls,
    options.requestId,
    options.serverId,
    options.name,
    () => controller.abort(new Error('MCP call cancelled')),
  );
  return callHttpMcpTool(options.server, options.name, parseJsonObject(options.arguments), controller.signal);
}

async function runMcpStdioToolCall(options) {
  if (options.server.transport === 'http') return runWithHttp(options);
  return options.sessionPool
    ? runWithPooledSession(options)
    : runWithOneShotSession(options);
}

function closeOneShotSession(sessionRef) {
  if (!sessionRef.current) {
    return false;
  }

  return closeMcpProcess(sessionRef.current);
}

module.exports = {
  closeOneShotSession,
  runMcpStdioToolCall,
};
