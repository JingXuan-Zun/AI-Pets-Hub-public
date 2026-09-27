import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-schema-diversity-main-gate-'));
const callCountPath = path.join(tempRoot, 'call-count.txt');
const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [{
    args: [projectPath('scripts/fixtures/schema-diversity-mcp-stdio-server.cjs')],
    command: process.execPath,
    env: { SCHEMA_DIVERSITY_MCP_CALL_COUNT_PATH: callCountPath },
    id: 'schema-diversity',
    timeoutMs: 2_000,
  }],
});

try {
  const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
    createMcpStdioClientService: (options: Record<string, unknown>) => {
      callTool: (request: Record<string, unknown>) => Promise<DesktopPetMcpToolCallResultLike>;
      listTools: (request: Record<string, unknown>) => Promise<{ tools: DesktopPetMcpToolLike[] }>;
    };
  };
  const service = createMcpStdioClientService({ projectRoot });
  const listed = await service.listTools({ serverId: 'schema-diversity' });
  assert.deepEqual(listed.tools.map((tool) => tool.name), [
    'draft7_ref',
    'draft2019_nested',
    'draft2020_tuple',
  ]);

  const invalid = await service.callTool({
    arguments: { operation: 'delete', resourceId: 'one' },
    name: 'draft7_ref',
    serverId: 'schema-diversity',
  });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent?.schemaValidation?.error, 'mcp_tool_arguments_schema_invalid');
  assert.equal(JSON.stringify(invalid).includes('delete'), false);
  assert.equal(fs.existsSync(callCountPath), false);

  const calls = [
    ['draft7_ref', { operation: 'inspect', resourceId: 'one' }],
    ['draft2019_nested', { payload: { enabled: true } }],
    ['draft2020_tuple', { tuple: ['one', 2] }],
  ] as const;
  for (const [name, argumentsValue] of calls) {
    const result = await service.callTool({
      arguments: argumentsValue,
      name,
      serverId: 'schema-diversity',
    });
    assert.equal(result.isError, false, `${name} should pass its declared schema`);
    assert.equal(result.structuredContent?.toolName, name);
  }
  assert.equal(fs.readFileSync(callCountPath, 'utf8'), '3');

  const invalidTuple = await service.callTool({
    arguments: { tuple: ['one', 2, 'extra'] },
    name: 'draft2020_tuple',
    serverId: 'schema-diversity',
  });
  assert.equal(invalidTuple.isError, true);
  assert.equal(fs.readFileSync(callCountPath, 'utf8'), '3');
} finally {
  if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
  await new Promise((resolve) => setTimeout(resolve, 200));
  fs.rmSync(tempRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
}

console.log('agent MCP schema diversity main gate smoke passed');
