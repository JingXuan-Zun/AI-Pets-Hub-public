// Remote MCP servers over Streamable HTTP (the transport most hosted MCP servers use): JSON-RPC
// POSTed to one URL, answered as JSON or as a short event stream. The server may hand out a
// session id at initialize; it is sent back on every later request and dropped when the server
// says the session expired. Headers from the config (often an API key) are sent, never logged.

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'ai-desktop-pet', version: '1' };

const sessions = new Map();
let nextRequestId = 1;

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function sessionKey(server) {
  return `${server.id}\n${server.url}`;
}

function createTimeoutSignal(timeoutMs, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`MCP server timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort(signal.reason ?? new Error('MCP call cancelled'));
  signal?.addEventListener?.('abort', onAbort, { once: true });
  return {
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    },
    signal: controller.signal,
  };
}

/** The JSON-RPC message answering `id`, from a JSON body or an event-stream body. */
async function readRpcResponse(response, id) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();
  if (!contentType.includes('text/event-stream')) {
    return text.trim() ? JSON.parse(text) : null;
  }
  const messages = [];
  for (const block of text.split(/\r?\n\r?\n/u)) {
    const data = block.split(/\r?\n/u).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!data) continue;
    try {
      messages.push(...[].concat(JSON.parse(data)));
    } catch {
      // Not JSON (comments, keep-alives): skip.
    }
  }
  return messages.find((message) => message && message.id === id) ?? null;
}

async function post(server, body, { sessionId, signal }) {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    ...(server.headers || {}),
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    ...(body.method !== 'initialize' ? { 'MCP-Protocol-Version': PROTOCOL_VERSION } : {}),
  };
  return fetch(server.url, { body: JSON.stringify(body), headers, method: 'POST', redirect: 'error', signal });
}

async function rpcOnce(server, method, params, session, signal) {
  const id = nextRequestId++;
  const response = await post(server, { id, jsonrpc: '2.0', method, params }, { sessionId: session?.sessionId, signal });
  if (response.status === 404 && session?.sessionId) {
    const error = new Error('MCP session expired');
    error.sessionExpired = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`MCP server answered HTTP ${response.status}${response.status === 401 || response.status === 403 ? ' (check the API key or token in this server\'s headers)' : ''}`);
  }
  const message = await readRpcResponse(response, id);
  if (!message) throw new Error(`MCP server sent no answer to ${method}`);
  if (message.error) throw new Error(message.error.message || `MCP ${method} failed`);
  return { response, result: message.result ?? {} };
}

async function initialize(server, signal) {
  const { response, result } = await rpcOnce(server, 'initialize', {
    capabilities: {},
    clientInfo: CLIENT_INFO,
    protocolVersion: PROTOCOL_VERSION,
  }, null, signal);
  const session = { serverInfo: result.serverInfo ?? null, sessionId: response.headers.get('mcp-session-id') || '' };
  // Tell the server we are ready; it answers 202 with no body.
  await post(server, { jsonrpc: '2.0', method: 'notifications/initialized' }, { sessionId: session.sessionId, signal })
    .then((reply) => reply.text())
    .catch(() => {});
  sessions.set(sessionKey(server), session);
  return session;
}

async function request(server, method, params, options = {}) {
  if (!isHttpUrl(server.url)) throw new Error('MCP server URL must start with http:// or https://');
  const timeout = createTimeoutSignal(server.timeoutMs || 15_000, options.signal);
  try {
    let session = sessions.get(sessionKey(server)) ?? await initialize(server, timeout.signal);
    try {
      return (await rpcOnce(server, method, params, session, timeout.signal)).result;
    } catch (error) {
      if (!error?.sessionExpired) throw error;
      sessions.delete(sessionKey(server));
      session = await initialize(server, timeout.signal);
      return (await rpcOnce(server, method, params, session, timeout.signal)).result;
    }
  } finally {
    timeout.dispose();
  }
}

async function listHttpMcpTools(server) {
  const tools = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const result = await request(server, 'tools/list', cursor ? { cursor } : {});
    tools.push(...(Array.isArray(result.tools) ? result.tools : []));
    cursor = typeof result.nextCursor === 'string' && result.nextCursor ? result.nextCursor : undefined;
    if (!cursor) break;
  }
  return { tools };
}

function callHttpMcpTool(server, name, args, signal) {
  return request(server, 'tools/call', { arguments: args, name }, { signal });
}

function forgetHttpMcpSession(server) {
  sessions.delete(sessionKey(server));
}

module.exports = { callHttpMcpTool, forgetHttpMcpSession, isHttpUrl, listHttpMcpTools, readRpcResponse };
