const { normalizeMcpTool } = require('./mcpServerConfigLoader.cjs');
const { sendRpc, withMcpSession } = require('./mcpStdioSession.cjs');
const { listToolsWithPooledSession } = require('./mcpStdioToolDiscovery.cjs');
const { validateMcpToolArguments } = require('./mcpArgumentSchemaValidation.cjs');
const { createSchemaRejectedToolCallResult } = require('./mcpStdioClientRules.cjs');
const { recordMcpRejectedToolCall } = require('./mcpStdioCallPreflight.cjs');

function discoverMcpCallSchemaTools(server, sessionPool, log) {
  return sessionPool
    ? listToolsWithPooledSession(sessionPool, server)
    : withMcpSession(server, log, (session) => sendRpc(session, 'tools/list', {}, server.timeoutMs));
}

function checkMcpCallSchema(discoveredTools, server, request, history, context) {
  const tool = (Array.isArray(discoveredTools?.tools) ? discoveredTools.tools : [])
    .map((candidate) => normalizeMcpTool(server, candidate))
    .find((candidate) => candidate.name === context.name);
  if (!tool) {
    const unavailable = createSchemaRejectedToolCallResult({
      error: 'mcp_tool_schema_unavailable',
      errors: [],
      ok: false,
      truncated: false,
    });
    return recordMcpRejectedToolCall(history, context, unavailable, 'schema-unavailable');
  }
  const schemaValidation = validateMcpToolArguments(tool.inputSchema, request.arguments ?? {});
  if (!schemaValidation.ok) {
    const rejected = createSchemaRejectedToolCallResult(schemaValidation);
    return recordMcpRejectedToolCall(history, context, rejected, 'schema-rejected');
  }

  return null;
}

module.exports = { discoverMcpCallSchemaTools, checkMcpCallSchema };
