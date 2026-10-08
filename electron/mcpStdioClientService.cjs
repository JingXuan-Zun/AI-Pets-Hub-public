const { createMcpToolCallHandler } = require('./mcpStdioToolCallHandler.cjs');
const path = require('path');
const { createMcpSessionManagement } = require('./mcpStdioSessionManagement.cjs');
const { cancelMcpToolCall } = require('./mcpStdioCancellation.cjs');
const { createMcpToolCatalog } = require('./mcpStdioToolCatalog.cjs');
const {
  loadExternalMcpServers,
  normalizeMcpTool,
} = require('./mcpServerConfigLoader.cjs');
const { createMcpStdioSessionPool } = require('./mcpStdioSessionPool.cjs');

function createMcpStdioClientService(options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, '..');
  const log = typeof options.log === 'function' ? options.log : null;
  const history = options.history || null;
  const health = options.health || null;
  const sessionPool = options.reuseSessions
    ? (options.sessionPool || createMcpStdioSessionPool({
      history,
      idleTimeoutMs: options.idleSessionTimeoutMs,
      log,
    }))
    : null;
  const activeToolCalls = new Map();
  const { dispose, getSessionStatus, resetSession } = createMcpSessionManagement(sessionPool);
  const { listServers, listTools } = createMcpToolCatalog(projectRoot, log, history, health, sessionPool);

  const callTool = createMcpToolCallHandler({
    projectRoot,
    log,
    history,
    health,
    sessionPool,
    activeToolCalls,
  });

  function cancelToolCall(request = {}) {
    return cancelMcpToolCall(activeToolCalls, history, request);
  }

  return {
    callTool,
    cancelToolCall,
    dispose,
    getSessionStatus,
    listServers,
    listTools,
    resetSession,
  };
}

module.exports = {
  createMcpStdioClientService,
  loadExternalMcpServers,
  normalizeMcpTool,
};
