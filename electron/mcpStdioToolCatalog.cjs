const { loadExternalMcpServers } = require('./mcpServerConfigLoader.cjs');
const { listToolsForServer } = require('./mcpStdioToolDiscovery.cjs');

function createMcpToolCatalog(projectRoot, log, history, health, sessionPool) {
  function listServers() {
    return loadExternalMcpServers(projectRoot).map((server) => ({
      description: server.description,
      id: server.id,
      title: server.title,
    }));
  }

  async function listTools(request = {}) {
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    const servers = loadExternalMcpServers(projectRoot)
      .filter((server) => !serverId || server.id === serverId);
    const toolsByServer = await Promise.all(servers.map((server) => (
      sessionPool
        ? listToolsForServer(server, log, history, health, sessionPool)
        : listToolsForServer(server, log, history, health)
    )));

    return {
      ok: true,
      serverHealth: health?.listStatuses?.() ?? [],
      servers: listServers(),
      tools: toolsByServer.flat(),
    };
  }

  return { listServers, listTools };
}

module.exports = { createMcpToolCatalog };
