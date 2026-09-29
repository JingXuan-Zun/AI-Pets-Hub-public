const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handleInitialize(message) {
  send({
    id: message.id,
    jsonrpc: '2.0',
    result: {
      capabilities: { tools: {} },
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'desktop-pet-reference-mcp', version: '0.1.0' },
    },
  });
}

function handleListTools(message) {
  send({
    id: message.id,
    jsonrpc: '2.0',
    result: {
      tools: [{
        description: 'Echo a text value for local MCP reference-chain checks.',
        inputSchema: {
          properties: { text: { type: 'string' } },
          type: 'object',
        },
        name: 'reference_echo',
        title: 'Reference Echo',
      }],
    },
  });
}

function handleCallTool(message) {
  const args = message.params?.arguments ?? {};
  send({
    id: message.id,
    jsonrpc: '2.0',
    result: {
      content: [{ text: `reference:${args.text ?? ''}`, type: 'text' }],
      structuredContent: { echoed: args.text ?? '' },
    },
  });
}

function handleRequest(message) {
  if (message.method === 'initialize') {
    handleInitialize(message);
    return;
  }

  if (message.method === 'tools/list') {
    handleListTools(message);
    return;
  }

  if (message.method === 'tools/call') {
    handleCallTool(message);
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
  if (line.trim()) {
    handleRequest(JSON.parse(line));
  }
});
