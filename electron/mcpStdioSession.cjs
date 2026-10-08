const { execFileSync, spawn } = require('child_process');
const { createMcpChildEnvironment } = require('./mcpChildEnvironment.cjs');
const { createMcpStdioSpawnSpec } = require('./mcpStdioSpawnSpec.cjs');

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SENSITIVE_TEXT_PATTERN = /(token|password|secret|apikey|api_key)\s*[=:]\s*[^,\s}]+/giu;

function createRpcMessage(id, method, params) {
  return `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
}

function createNotificationMessage(method, params = {}) {
  return `${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`;
}

function rejectAllPending(state, error) {
  for (const pending of state.pending.values()) {
    clearTimeout(pending.timeoutId);
    pending.reject(error);
  }
  state.pending.clear();
}

function closePendingOnProcessEnd(state, error) {
  const wasClosed = Boolean(state.closed);
  state.closed = true;
  state.closeReason = state.closeReason || error.message;
  if (!wasClosed) {
    rejectAllPending(state, error);
  }
}

function compactStdioText(value, limit = 360) {
  const text = String(value ?? '')
    .replace(SENSITIVE_TEXT_PATTERN, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function createMcpProcessError(state, message) {
  const stderr = compactStdioText(state.stderr);
  return new Error(stderr ? `${message}; stderr=${stderr}` : message);
}

function createMcpSpawnErrorContext(server, spawnSpec) {
  return [
    `server=${server.id}`,
    `spawnCommand=${spawnSpec.command}`,
    `serverCommand=${server.command}`,
    `cwd=${server.cwd}`,
    `platform=${process.platform}`,
  ].join(' ');
}

function createMcpSpawnError(server, spawnSpec, error) {
  const message = error?.message || String(error ?? 'spawn failed');
  return new Error(`${message}; ${createMcpSpawnErrorContext(server, spawnSpec)}`);
}

function handleRpcLine(state, line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  const pending = state.pending.get(message.id);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  state.pending.delete(message.id);
  if (message.error) {
    pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
    return;
  }

  pending.resolve(message.result ?? {});
}

function handleStdoutChunk(state, chunk) {
  state.stdoutBuffer += chunk;
  let newlineIndex = state.stdoutBuffer.indexOf('\n');
  while (newlineIndex >= 0) {
    const line = state.stdoutBuffer.slice(0, newlineIndex).trim();
    state.stdoutBuffer = state.stdoutBuffer.slice(newlineIndex + 1);
    if (line) {
      handleRpcLine(state, line);
    }
    newlineIndex = state.stdoutBuffer.indexOf('\n');
  }
}

function createMcpProcess(server, log) {
  const spawnSpec = createMcpStdioSpawnSpec(server);
  const child = spawn(spawnSpec.command, spawnSpec.args, {
    cwd: server.cwd,
    env: createMcpChildEnvironment(server.env),
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const state = { child, nextId: 1, pending: new Map(), stderr: '', stdoutBuffer: '' };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => handleStdoutChunk(state, chunk));
  child.stderr.on('data', (chunk) => {
    state.stderr = `${state.stderr}${chunk}`.slice(-4000);
  });
  child.on('error', (error) => closePendingOnProcessEnd(
    state,
    createMcpSpawnError(server, spawnSpec, error),
  ));
  child.on('close', (code, signal) => {
    closePendingOnProcessEnd(
      state,
      createMcpProcessError(state, `MCP server exited code=${code ?? 'null'} signal=${signal ?? 'null'}`),
    );
  });
  log?.('spawned MCP stdio server', { id: server.id, command: spawnSpec.command });

  return state;
}

function sendRpc(state, method, params, timeoutMs) {
  if (state.closed) {
    return Promise.reject(new Error(`MCP session already closed: ${state.closeReason || 'closed'}`));
  }

  const id = state.nextId;
  state.nextId += 1;
  const request = createRpcMessage(id, method, params);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      state.pending.delete(id);
      closeMcpProcess(state, `timeout:${method}`);
      reject(createMcpProcessError(state, `MCP request timed out: ${method}`));
    }, timeoutMs);
    state.pending.set(id, { reject, resolve, timeoutId });
    state.child.stdin.write(request, 'utf8', (error) => {
      if (!error) {
        return;
      }

      clearTimeout(timeoutId);
      state.pending.delete(id);
      reject(error);
    });
  });
}

async function initializeMcpSession(state, server) {
  await sendRpc(state, 'initialize', {
    capabilities: {},
    clientInfo: { name: 'ai-desktop-pet', version: '0.0.1' },
    protocolVersion: MCP_PROTOCOL_VERSION,
  }, server.timeoutMs);
  state.child.stdin.write(createNotificationMessage('notifications/initialized'), 'utf8');
}

function closeMcpProcess(state, reason = 'close') {
  if (state.closed) {
    return false;
  }

  state.closed = true;
  state.closeReason = String(reason || 'close');
  try {
    state.child.stdin.end();
  } catch {
    // Ignore close errors.
  }

  rejectAllPending(state, new Error(`MCP session closed: ${reason}`));
  if (process.platform === 'win32' && state.child.pid) {
    try {
      execFileSync('taskkill', ['/pid', String(state.child.pid), '/T', '/F'], { stdio: 'ignore' });
      return true;
    } catch {
      // Fall through to the direct kill below.
    }
  }
  return state.child.kill();
}

async function withMcpSession(server, log, callback) {
  const state = createMcpProcess(server, log);
  try {
    await initializeMcpSession(state, server);
    return await callback(state);
  } finally {
    closeMcpProcess(state);
  }
}

module.exports = {
  closeMcpProcess,
  createMcpProcess,
  initializeMcpSession,
  sendRpc,
  withMcpSession,
};
