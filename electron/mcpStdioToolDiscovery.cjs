const { normalizeMcpTool } = require('./mcpServerConfigLoader.cjs');
const { sendRpc, withMcpSession } = require('./mcpStdioSession.cjs');

function recordListFailure(history, server, startedAt, error) {
  history?.recordDiagnostic?.({
    durationMs: Date.now() - startedAt,
    error: error?.message || String(error),
    ok: false,
    serverId: server.id,
    status: 'error',
    toolCount: 0,
  });
}

async function listToolsForServer(server, log, history, health, sessionPool = null) {
  const retryGate = health?.getRetryGate?.(server.id);
  if (retryGate && !retryGate.allowed) {
    return [];
  }

  const startedAt = Date.now();
  try {
    const result = sessionPool
      ? await listToolsWithPooledSession(sessionPool, server)
      : await withMcpSession(server, log, (session) => (
        sendRpc(session, 'tools/list', {}, server.timeoutMs)
      ));
    const tools = (Array.isArray(result.tools) ? result.tools : [])
      .map((tool) => normalizeMcpTool(server, tool))
      .filter((tool) => tool.name);
    health?.recordSuccess?.(server.id);
    return tools;
  } catch (error) {
    health?.recordFailure?.(server.id, error);
    recordListFailure(history, server, startedAt, error);
    return [];
  }
}

function listToolsWithPooledSession(sessionPool, server) {
  return sessionPool.runRpc(server, 'tools/list', {}, server.timeoutMs);
}

module.exports = { listToolsForServer, listToolsWithPooledSession };
