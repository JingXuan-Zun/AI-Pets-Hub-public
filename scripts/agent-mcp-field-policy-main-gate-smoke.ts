import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-field-policy-main-gate-'));
const spawnCountPath = path.join(tempRoot, 'spawn-count.txt');
const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  policies: {
    tools: {
      'field-policy-server/echo': {
        fields: { '/text': { mode: 'deny', values: ['blocked'] } },
        mode: 'allow',
      },
    },
  },
  servers: [{
    args: [projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs')],
    command: process.execPath,
    env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
    id: 'field-policy-server',
    timeoutMs: 2_000,
  }],
});

try {
  const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
    createMcpStdioClientService: (options: Record<string, unknown>) => {
      callTool: (request: Record<string, unknown>) => Promise<DesktopPetMcpToolCallResultLike>;
    };
  };
  const service = createMcpStdioClientService({ projectRoot });
  const denied = await service.callTool({
    arguments: { text: 'blocked' },
    name: 'echo',
    serverId: 'field-policy-server',
  });
  assert.equal(denied.isError, true);
  assert.equal(denied.structuredContent?.fieldPolicy?.error, 'mcp_field_policy_denied');
  assert.equal(fs.existsSync(spawnCountPath), false);
  assert.equal(JSON.stringify(denied).includes('blocked'), false);

  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    policies: { tools: { 'field-policy-server/echo': 'invalid' } },
    servers: [{
      args: [projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs')],
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
      id: 'field-policy-server',
      timeoutMs: 2_000,
    }],
  });
  const malformed = await service.callTool({
    arguments: { text: 'allowed' },
    name: 'echo',
    serverId: 'field-policy-server',
  });
  assert.equal(malformed.isError, true);
  assert.equal(malformed.structuredContent?.fieldPolicy?.error, 'mcp_field_policy_invalid');
  assert.equal(fs.existsSync(spawnCountPath), false);

  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    policies: {
      tools: {
        'field-policy-server/echo': {
          fields: { '/items': { mode: 'deny-items', values: ['blocked-item'] } },
          mode: 'allow',
        },
      },
    },
    servers: [{
      args: [projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs')],
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
      id: 'field-policy-server',
      timeoutMs: 2_000,
    }],
  });
  const deniedArrayItem = await service.callTool({
    arguments: { items: ['safe', 'blocked-item'], text: 'allowed' },
    name: 'echo',
    serverId: 'field-policy-server',
  });
  assert.equal(deniedArrayItem.isError, true);
  assert.equal(deniedArrayItem.structuredContent?.fieldPolicy?.mode, 'deny-items');
  assert.equal(JSON.stringify(deniedArrayItem).includes('blocked-item'), false);
  assert.equal(fs.existsSync(spawnCountPath), false);

  const allowedArrayItem = await service.callTool({
    arguments: { items: ['safe'], text: 'allowed' },
    name: 'echo',
    serverId: 'field-policy-server',
  });
  assert.equal(allowedArrayItem.isError, false);
  assert.equal(allowedArrayItem.structuredContent?.echoed, 'allowed');
  assert.equal(fs.existsSync(spawnCountPath), true);

  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    policies: {
      tools: {
        'field-policy-server/echo': {
          fields: { '/text': { mode: 'deny', values: ['blocked'] } },
          mode: 'allow',
        },
      },
    },
    servers: [{
      args: [projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs')],
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
      id: 'field-policy-server',
      timeoutMs: 2_000,
    }],
  });

  const allowed = await service.callTool({
    arguments: { text: 'allowed' },
    name: 'echo',
    serverId: 'field-policy-server',
  });
  assert.equal(allowed.isError, false);
  assert.equal(allowed.structuredContent?.echoed, 'allowed');
  assert.equal(fs.existsSync(spawnCountPath), true);
} finally {
  if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
  await new Promise((resolve) => setTimeout(resolve, 200));
  fs.rmSync(tempRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
}

console.log('agent MCP field policy main gate smoke passed');
