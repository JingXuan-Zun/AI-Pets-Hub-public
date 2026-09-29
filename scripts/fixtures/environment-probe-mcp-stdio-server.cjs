const readline = require('node:readline');

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const lines = readline.createInterface({ input: process.stdin });
lines.on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (!message.id) return;
  if (message.method === 'initialize') {
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        capabilities: { tools: {} },
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'environment-probe', version: '1.0.0' },
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
          description: 'Reports presence of bounded test environment keys.',
          inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
          name: 'inspect_environment',
        }],
      },
    });
    return;
  }
  if (message.method === 'tools/call' && message.params?.name === 'inspect_environment') {
    const evidence = {
      desktopPetConfigPresent: Boolean(process.env.DESKTOP_PET_MCP_SERVERS_JSON),
      explicitServerKeyPresent: process.env.EXPLICIT_API_KEY === 'explicit-test-value',
      hostKeyPresent: Boolean(process.env.HOST_API_KEY),
      pathPresent: Boolean(process.env.PATH),
    };
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        content: [{ text: JSON.stringify(evidence), type: 'text' }],
        structuredContent: evidence,
      },
    });
  }
});
