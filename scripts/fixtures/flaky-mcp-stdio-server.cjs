const fs = require('fs');
const readline = require('readline');

const statePath = process.env.FLAKY_MCP_STATE_PATH || '';
const shouldFail = statePath && !fs.existsSync(statePath);

if (shouldFail) {
  fs.writeFileSync(statePath, 'failed-once\n', 'utf8');
  process.exit(23);
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
        serverInfo: { name: 'flaky-mcp', version: '0.0.1' },
      },
    });
    return;
  }

  if (message.method === 'tools/list') {
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        tools: [{
          description: 'Recover after one failed process start.',
          inputSchema: { type: 'object' },
          name: 'recovered',
          title: 'Recovered',
        }],
      },
    });
    return;
  }

  if (message.method === 'tools/call') {
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        content: [{ text: 'recovered-call', type: 'text' }],
        structuredContent: { recovered: true },
      },
    });
  }
}

rl.on('line', (line) => {
  if (line.trim()) {
    handleRequest(JSON.parse(line));
  }
});
