const { loadExternalMcpServers } = require('./mcpServerConfigLoader.cjs');
const { createTextContent } = require('./mcpStdioClientRules.cjs');

function resolveMcpToolCallRequest(projectRoot, request) {
  const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
  const name = typeof request.name === 'string' ? request.name.trim() : '';
  const server = loadExternalMcpServers(projectRoot).find((candidate) => candidate.id === serverId);
  if (!server || !name) {
    return {
      rejected: {
        content: [createTextContent(`Unknown MCP server/tool: ${serverId}/${name}`)],
        isError: true,
        structuredContent: null,
      },
    };
  }
  const requestId = typeof request.requestId === 'string' ? request.requestId.trim() : '';
  const startedAt = Date.now();
  return { name, requestId, server, serverId, startedAt };
}

module.exports = { resolveMcpToolCallRequest };
