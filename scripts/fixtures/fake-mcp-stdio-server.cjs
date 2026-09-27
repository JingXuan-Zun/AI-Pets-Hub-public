const readline = require('readline');
const fs = require('fs');

const spawnCountPath = process.env.FAKE_MCP_SPAWN_COUNT_PATH || '';
if (spawnCountPath) {
  const previousCount = fs.existsSync(spawnCountPath)
    ? Number(fs.readFileSync(spawnCountPath, 'utf8'))
    : 0;
  fs.writeFileSync(spawnCountPath, `${Number.isFinite(previousCount) ? previousCount + 1 : 1}`, 'utf8');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handleRequest(message) {
  if (message.method === 'initialize') {
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        capabilities: { tools: {} },
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'fake-mcp', version: '0.0.1' },
      },
    });
    return;
  }

  if (message.method === 'tools/list') {
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        tools: [
          {
            description: 'Echo a text value.',
            inputSchema: {
              properties: { text: { type: 'string' } },
              type: 'object',
            },
            name: 'echo',
            title: 'Echo',
          },
        ],
      },
    });
    return;
  }

  if (message.method === 'tools/call') {
    const args = message.params?.arguments ?? {};
    const response = {
      id: message.id,
      jsonrpc: '2.0',
      result: {
        content: [{ text: `echo:${args.text ?? ''}`, type: 'text' }],
        structuredContent: { echoed: args.text ?? '' },
      },
    };
    const delayMs = Number(args.delayMs);
    if (Number.isFinite(delayMs) && delayMs > 0) {
      setTimeout(() => send(response), delayMs);
      return;
    }

    send(response);
    return;
  }

  if (message.id != null) {
    send({
      error: { code: -32601, message: `Unknown method ${message.method}` },
      id: message.id,
      jsonrpc: '2.0',
    });
  }
}

rl.on('line', (line) => {
  if (!line.trim()) {
    return;
  }

  handleRequest(JSON.parse(line));
});
