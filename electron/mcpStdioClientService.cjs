const path = require('path');
const {
  loadExternalMcpPolicyConfig,
  loadExternalMcpServers,
  normalizeMcpTool,
  parseJsonObject,
} = require('./mcpServerConfigLoader.cjs');
const {
  sendRpc,
  withMcpSession,
} = require('./mcpStdioSession.cjs');
const { createMcpStdioSessionPool } = require('./mcpStdioSessionPool.cjs');
const {
  closeOneShotSession,
  runMcpStdioToolCall,
} = require('./mcpStdioToolCallRunner.cjs');
const { validateMcpToolArguments } = require('./mcpArgumentSchemaValidation.cjs');
const { evaluateMcpFieldPolicy } = require('./mcpFieldPolicy.cjs');

function createTextContent(text) {
  return { text: String(text ?? ''), type: 'text' };
}

function normalizeToolContent(item) {
  if (item?.type === 'text') {
    return createTextContent(item.text);
  }

  return { text: JSON.stringify(item ?? null), type: 'json' };
}

function normalizeToolCallResult(result) {
  const content = Array.isArray(result?.content)
    ? result.content.map(normalizeToolContent)
    : [createTextContent(JSON.stringify(result ?? {}))];

  return {
    content,
    isError: Boolean(result?.isError),
    structuredContent: parseJsonObject(result?.structuredContent, null),
  };
}

function inferMcpCallErrorStatus(error) {
  const message = error?.message || String(error ?? '');
  if (/timed out|timeout/i.test(message)) {
    return 'timeout';
  }

  if (/cancelled|canceled|closed/i.test(message)) {
    return 'cancelled';
  }

  return 'error';
}

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

function createCooldownToolCallResult(server, retryGate) {
  const waitMs = Math.max(0, Math.round(Number(retryGate.waitMs ?? 0)));
  const reason = retryGate.reason || `MCP server ${server.id} is cooling down after failure.`;
  return {
    content: [createTextContent(`${reason}${waitMs ? ` Retry in ${waitMs}ms.` : ''}`)],
    isError: true,
    structuredContent: {
      mcpServerHealth: retryGate.status,
      retryAfterMs: waitMs,
    },
  };
}

function createSchemaRejectedToolCallResult(validation) {
  return {
    content: [{ text: 'MCP tool arguments did not pass bounded JSON Schema validation; external call was not started.', type: 'text' }],
    isError: true,
    structuredContent: { schemaValidation: validation },
  };
}

function createFieldPolicyDeniedToolCallResult(decision) {
  return {
    content: [{ text: decision.reason, type: 'text' }],
    isError: true,
    structuredContent: { fieldPolicy: decision },
  };
}

function shouldRecordServerFailure(status) {
  return status === 'error' || status === 'timeout';
}

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

  async function callTool(request = {}) {
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    const name = typeof request.name === 'string' ? request.name.trim() : '';
    const server = loadExternalMcpServers(projectRoot).find((candidate) => candidate.id === serverId);
    if (!server || !name) {
      return {
        content: [createTextContent(`Unknown MCP server/tool: ${serverId}/${name}`)],
        isError: true,
        structuredContent: null,
      };
    }

    const requestId = typeof request.requestId === 'string' ? request.requestId.trim() : '';
    const startedAt = Date.now();
    const retryGate = health?.getRetryGate?.(server.id);
    if (retryGate && !retryGate.allowed) {
      const cooldownResult = createCooldownToolCallResult(server, retryGate);
      history?.recordToolCallResult?.({
        durationMs: 0,
        error: cooldownResult.content[0]?.text ?? '',
        ok: false,
        requestId,
        serverId,
        status: 'cooldown',
        toolName: name,
      });
      return cooldownResult;
    }

    const fieldPolicyDecision = evaluateMcpFieldPolicy(loadExternalMcpPolicyConfig(projectRoot), {
      arguments: request.arguments ?? {},
      serverId,
      toolName: name,
    });
    if (!fieldPolicyDecision.allowed) {
      const denied = createFieldPolicyDeniedToolCallResult(fieldPolicyDecision);
      history?.recordToolCallResult?.({
        durationMs: Date.now() - startedAt,
        error: denied.content[0]?.text ?? '',
        ok: false,
        requestId,
        serverId,
        status: 'field-policy-denied',
        toolName: name,
      });
      return denied;
    }

    const discoveredTools = sessionPool
      ? await listToolsWithPooledSession(sessionPool, server)
      : await withMcpSession(server, log, (session) => sendRpc(session, 'tools/list', {}, server.timeoutMs));
    const tool = (Array.isArray(discoveredTools?.tools) ? discoveredTools.tools : [])
      .map((candidate) => normalizeMcpTool(server, candidate))
      .find((candidate) => candidate.name === name);
    if (!tool) {
      const unavailable = createSchemaRejectedToolCallResult({
        error: 'mcp_tool_schema_unavailable',
        errors: [],
        ok: false,
        truncated: false,
      });
      history?.recordToolCallResult?.({
        durationMs: Date.now() - startedAt,
        error: unavailable.content[0]?.text ?? '',
        ok: false,
        requestId,
        serverId,
        status: 'schema-unavailable',
        toolName: name,
      });
      return unavailable;
    }
    const schemaValidation = validateMcpToolArguments(tool.inputSchema, request.arguments ?? {});
    if (!schemaValidation.ok) {
      const rejected = createSchemaRejectedToolCallResult(schemaValidation);
      history?.recordToolCallResult?.({
        durationMs: Date.now() - startedAt,
        error: rejected.content[0]?.text ?? '',
        ok: false,
        requestId,
        serverId,
        status: 'schema-rejected',
        toolName: name,
      });
      return rejected;
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
      const normalizedResult = normalizeToolCallResult(result);
      health?.recordSuccess?.(server.id);
      history?.recordToolCallResult?.({
        durationMs: Date.now() - startedAt,
        error: normalizedResult.content[0]?.text ?? '',
        ok: !normalizedResult.isError,
        requestId,
        serverId,
        status: normalizedResult.isError ? 'error' : 'ok',
        toolName: name,
      });
      return normalizedResult;
    } catch (error) {
      const status = inferMcpCallErrorStatus(error);
      if (shouldRecordServerFailure(status)) {
        health?.recordFailure?.(server.id, error);
      }
      history?.recordToolCallResult?.({
        durationMs: Date.now() - startedAt,
        error: error?.message || String(error),
        ok: false,
        requestId,
        serverId,
        status,
        toolName: name,
      });
      return {
        content: [createTextContent(error?.message || String(error))],
        isError: true,
        structuredContent: null,
      };
    } finally {
      clearActiveToolCallRef.current();
      closeOneShotSession(sessionRef);
    }
  }

  function cancelToolCall(request = {}) {
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

  function dispose(reason = 'client-dispose') {
    return sessionPool?.dispose?.(reason) ?? 0;
  }

  function getSessionStatus() {
    return sessionPool?.getStatus?.() ?? [];
  }

  function resetSession(request = {}) {
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    if (!sessionPool) {
      return { closedCount: 0, ok: true, serverId };
    }

    const closeReason = 'manual-reset';
    const closedCount = serverId
      ? Number(Boolean(sessionPool.discard(serverId, closeReason)))
      : sessionPool.dispose(closeReason);
    return {
      closedAt: closedCount ? Date.now() : null,
      closedCount,
      closeKind: closedCount ? closeReason : null,
      closeReason: closedCount ? closeReason : null,
      ok: true,
      serverId,
    };
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
