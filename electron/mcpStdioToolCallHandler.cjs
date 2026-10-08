const { resolveMcpToolCallRequest } = require('./mcpStdioCallRequest.cjs');
const { completeMcpToolCall, failMcpToolCall, cleanupMcpToolCall } = require('./mcpStdioCallResults.cjs');
const { discoverMcpCallSchemaTools, checkMcpCallSchema } = require('./mcpStdioCallSchema.cjs');
const { checkMcpCallCooldown, checkMcpCallFieldPolicy } = require('./mcpStdioCallPreflight.cjs');
const { runMcpStdioToolCall } = require('./mcpStdioToolCallRunner.cjs');

function createMcpToolCallHandler({ projectRoot, log, history, health, sessionPool, activeToolCalls }) {
  async function callTool(request = {}) {
    const callContext = resolveMcpToolCallRequest(projectRoot, request);
    if (callContext.rejected) {
      return callContext.rejected;
    }
    const { name, requestId, server, serverId } = callContext;
    const cooldownResult = checkMcpCallCooldown(server, health, history, callContext);
    if (cooldownResult) {
      return cooldownResult;
    }
    const denied = checkMcpCallFieldPolicy(projectRoot, request, history, callContext);
    if (denied) {
      return denied;
    }

    const discoveredTools = await discoverMcpCallSchemaTools(server, sessionPool, log);
    const schemaRejected = checkMcpCallSchema(discoveredTools, server, request, history, callContext);
    if (schemaRejected) {
      return schemaRejected;
    }

    const sessionRef = { current: null };
    const clearActiveToolCallRef = { current: () => {} };
    try {
      history?.recordToolCallStart?.({ requestId, serverId, toolName: name });

      const result = await runMcpStdioToolCall({
        activeToolCalls,
        arguments: request.arguments,
        clearActiveToolCallRef,
        log,
        name,
        requestId,
        server,
        serverId,
        sessionPool,
        sessionRef,
      });
      return completeMcpToolCall(result, server, health, history, callContext);
    } catch (error) {
      return failMcpToolCall(error, server, health, history, callContext);
    } finally {
      cleanupMcpToolCall(clearActiveToolCallRef, sessionRef);
    }
  }

  return callTool;
}

module.exports = { createMcpToolCallHandler };
