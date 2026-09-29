const fs = require('fs');
const path = require('path');
const {
  loadExternalMcpServers,
  normalizeMcpTool,
} = require('./mcpServerConfigLoader.cjs');
const {
  closeMcpProcess,
  createMcpProcess,
  initializeMcpSession,
  sendRpc,
} = require('./mcpStdioSession.cjs');
const { classifyMcpServerCompatibility } = require('./mcpServerCompatibility.cjs');

const SENSITIVE_TEXT_PATTERN = /(token|password|secret|apikey|api_key|authorization)\s*[=:]\s*[^,\s}]+/giu;

function trimSnippet(value, limit = 1200) {
  const text = String(value ?? '')
    .replace(SENSITIVE_TEXT_PATTERN, '$1=[redacted]')
    .trim();
  if (text.length <= limit) {
    return text;
  }

  return text.slice(-limit);
}

function looksLikeExecutablePath(command) {
  return command.includes('/') || command.includes('\\') || path.isAbsolute(command);
}

function getPathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function createBaseDiagnostic(server) {
  return {
    command: server.command,
    commandPathExists: looksLikeExecutablePath(server.command) ? getPathExists(server.command) : null,
    cwd: server.cwd,
    cwdExists: getPathExists(server.cwd),
    durationMs: 0,
    error: null,
    ok: false,
    serverId: server.id,
    stderrSnippet: '',
    timeoutMs: server.timeoutMs,
    toolCount: 0,
    tools: [],
  };
}

function createUnknownServerDiagnostic(serverId) {
  return {
    command: '',
    commandPathExists: null,
    cwd: '',
    cwdExists: false,
    durationMs: 0,
    error: `Unknown MCP server: ${serverId}`,
    ok: false,
    serverId,
    stderrSnippet: '',
    timeoutMs: 0,
    toolCount: 0,
    tools: [],
  };
}

async function inspectServer(server, log) {
  const startedAt = Date.now();
  const diagnostic = createBaseDiagnostic(server);
  if (!diagnostic.cwdExists) {
    return {
      ...diagnostic,
      error: `Working directory does not exist: ${server.cwd}`,
    };
  }

  let state = null;
  try {
    state = createMcpProcess(server, log);
    await initializeMcpSession(state, server);
    const result = await sendRpc(state, 'tools/list', {}, server.timeoutMs);
    const tools = (Array.isArray(result.tools) ? result.tools : [])
      .map((tool) => normalizeMcpTool(server, tool))
      .filter((tool) => tool.name);
    return {
      ...diagnostic,
      durationMs: Date.now() - startedAt,
      ok: true,
      stderrSnippet: trimSnippet(state.stderr),
      toolCount: tools.length,
      tools,
    };
  } catch (error) {
    return {
      ...diagnostic,
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      stderrSnippet: trimSnippet(state?.stderr),
    };
  } finally {
    if (state) {
      closeMcpProcess(state);
    }
  }
}

function createMcpServerDiagnosticsService(options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, '..');
  const log = typeof options.log === 'function' ? options.log : null;
  const history = options.history || null;
  const health = options.health || null;

  function finish(result) {
    const finalized = {
      ...result,
      compatibility: classifyMcpServerCompatibility(result),
    };
    history?.recordDiagnostic?.(finalized);
    if (finalized.ok) {
      health?.recordSuccess?.(finalized.serverId);
    } else if (result?.serverId) {
      health?.recordFailure?.(finalized.serverId, finalized.error || 'MCP server diagnostic failed.');
    }
    return finalized;
  }

  async function inspect(request = {}) {
    const serverId = typeof request.serverId === 'string' ? request.serverId.trim() : '';
    if (!serverId) {
      return finish(createUnknownServerDiagnostic(''));
    }

    const server = loadExternalMcpServers(projectRoot).find((candidate) => candidate.id === serverId);
    if (!server) {
      return finish(createUnknownServerDiagnostic(serverId));
    }

    return finish(await inspectServer(server, log));
  }

  return { inspect };
}

module.exports = {
  createMcpServerDiagnosticsService,
};
