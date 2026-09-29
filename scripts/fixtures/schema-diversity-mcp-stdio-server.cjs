const fs = require('fs');
const readline = require('readline');

const callCountPath = process.env.SCHEMA_DIVERSITY_MCP_CALL_COUNT_PATH || '';
const tools = [
  {
    description: 'Draft 7 local-reference test tool.',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      definitions: {
        request: {
          additionalProperties: false,
          properties: {
            operation: { enum: ['inspect'], type: 'string' },
            resourceId: { minLength: 1, type: 'string' },
          },
          required: ['operation', 'resourceId'],
          type: 'object',
        },
      },
      allOf: [{ $ref: '#/definitions/request' }],
    },
    name: 'draft7_ref',
  },
  {
    description: 'Draft 2019 nested-definition test tool.',
    inputSchema: {
      $defs: {
        payload: {
          additionalProperties: false,
          properties: { enabled: { type: 'boolean' } },
          required: ['enabled'],
          type: 'object',
        },
      },
      $schema: 'https://json-schema.org/draft/2019-09/schema',
      properties: {
        payload: { $ref: '#/$defs/payload' },
        tags: { items: { type: 'string' }, type: 'array' },
      },
      required: ['payload'],
      type: 'object',
      unevaluatedProperties: false,
    },
    name: 'draft2019_nested',
  },
  {
    description: 'Draft 2020 fixed-tuple test tool.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      additionalProperties: false,
      properties: {
        tuple: {
          items: false,
          maxItems: 2,
          minItems: 2,
          prefixItems: [{ type: 'string' }, { minimum: 0, type: 'integer' }],
          type: 'array',
        },
      },
      required: ['tuple'],
      type: 'object',
    },
    name: 'draft2020_tuple',
  },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function recordCall() {
  if (!callCountPath) return;
  const previous = fs.existsSync(callCountPath) ? Number(fs.readFileSync(callCountPath, 'utf8')) : 0;
  fs.writeFileSync(callCountPath, String(Number.isFinite(previous) ? previous + 1 : 1), 'utf8');
}

function handleRequest(message) {
  if (message.method === 'initialize') {
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        capabilities: { tools: {} },
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'schema-diversity-mcp', version: '0.0.1' },
      },
    });
    return;
  }
  if (message.method === 'tools/list') {
    send({ id: message.id, jsonrpc: '2.0', result: { tools } });
    return;
  }
  if (message.method === 'tools/call') {
    recordCall();
    send({
      id: message.id,
      jsonrpc: '2.0',
      result: {
        content: [{ text: `called:${message.params?.name || ''}`, type: 'text' }],
        structuredContent: {
          arguments: message.params?.arguments ?? {},
          toolName: message.params?.name || '',
        },
      },
    });
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
  if (line.trim()) handleRequest(JSON.parse(line));
});
