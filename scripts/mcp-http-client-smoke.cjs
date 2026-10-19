// A fake Streamable HTTP MCP server, in process, to check the remote MCP client: initialize and
// session id, pagination, JSON and event-stream replies, header passing, an expired session,
// and a wrong key.
const assert = require('node:assert/strict');
const http = require('node:http');
const { callHttpMcpTool, forgetHttpMcpSession, listHttpMcpTools } = require('../electron/mcpHttpClient.cjs');
const { normalizeConfigServers } = require('../electron/mcpServerConfigLoader.cjs');
const { createMcpStdioSpawnSpec } = require('../electron/mcpStdioSpawnSpec.cjs');

let cases = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); cases += 1; };

const state = { initializeCount: 0, liveSession: 'session-1', seenKeys: [], seenProtocol: [] };
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    state.seenKeys.push(request.headers['x-api-key'] || '');
    if (request.headers['x-api-key'] !== 'good-key') {
      response.writeHead(401).end();
      return;
    }
    const message = JSON.parse(body);
    if (message.method === 'initialize') {
      state.initializeCount += 1;
      state.liveSession = `session-${state.initializeCount}`;
      response.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': state.liveSession });
      response.end(JSON.stringify({ id: message.id, jsonrpc: '2.0', result: { protocolVersion: '2025-06-18', serverInfo: { name: 'fake' } } }));
      return;
    }
    if (request.headers['mcp-session-id'] !== state.liveSession) {
      response.writeHead(404).end();
      return;
    }
    state.seenProtocol.push(request.headers['mcp-protocol-version'] || '');
    if (!('id' in message)) {
      response.writeHead(202).end();
      return;
    }
    if (message.method === 'tools/list') {
      const page = message.params?.cursor === 'page-2'
        ? { tools: [{ annotations: { readOnlyHint: true }, inputSchema: { type: 'object' }, name: 'search' }] }
        : { nextCursor: 'page-2', tools: [{ inputSchema: { type: 'object' }, name: 'echo' }] };
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ id: message.id, jsonrpc: '2.0', result: page }));
      return;
    }
    if (message.method === 'tools/call') {
      // Answer as an event stream with a progress notification first.
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: {} })}\n\n`);
      response.end(`event: message\ndata: ${JSON.stringify({ id: message.id, jsonrpc: '2.0', result: { content: [{ text: `echo:${message.params.arguments.text}`, type: 'text' }] } })}\n\n`);
      return;
    }
    response.writeHead(400).end();
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/mcp`;

  // README-style config: "mcpServers", a hosted server by URL, and a local one with bare npx.
  const [remote, local] = normalizeConfigServers({
    mcpServers: {
      fake: { headers: { 'x-api-key': 'good-key' }, url },
      files: { args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], command: 'npx', type: 'stdio' },
    },
  }, process.cwd());
  check([remote.id, remote.transport, remote.url], ['fake', 'http', url], 'mcpServers + url gives a hosted server');
  check([local.id, local.transport, local.command], ['files', 'stdio', 'npx'], 'mcpServers + command gives a local server');
  if (process.platform === 'win32') {
    check(/cmd\.exe$/iu.test(createMcpStdioSpawnSpec(local).command), true, 'bare npx starts through cmd.exe on Windows');
  }

  const listed = await listHttpMcpTools(remote);
  check(listed.tools.map((tool) => tool.name), ['echo', 'search'], 'tools from both pages');
  const called = await callHttpMcpTool(remote, 'echo', { text: 'hi' });
  check(called.content[0].text, 'echo:hi', 'event-stream answer read past the progress notification');
  check(state.initializeCount, 1, 'one initialize for list and call');
  check(state.seenProtocol.every((value) => value === '2025-06-18'), true, 'protocol version sent after initialize');

  state.liveSession = 'expired-on-server';
  const afterExpiry = await callHttpMcpTool(remote, 'echo', { text: 'again' });
  check([afterExpiry.content[0].text, state.initializeCount], ['echo:again', 2], 'expired session: initialize again and retry');

  forgetHttpMcpSession(remote);
  await assert.rejects(() => listHttpMcpTools({ ...remote, headers: { 'x-api-key': 'wrong' }, id: 'fake-wrong' }), /401.*API key/u);
  cases += 1;
  check(state.seenKeys.includes('good-key'), true, 'configured headers are sent');

  server.close();
  console.log(`mcp http client smoke ok: ${cases} checks`);
})().catch((error) => {
  server.close();
  console.error(error);
  process.exit(1);
});
