import { strict as assert } from 'node:assert';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type McpService = {
  callTool: (request: Record<string, unknown>) => Promise<{
    content: Array<{ text: string; type: string }>;
    isError?: boolean;
    structuredContent?: Record<string, unknown> | null;
  }>;
  listTools: (request?: Record<string, unknown>) => Promise<{
    ok: boolean;
    tools: Array<{ name: string; serverId: string; title: string }>;
  }>;
};

const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [
    {
      args: [fakeServerPath],
      command: process.execPath,
      id: 'fake',
      title: 'Fake MCP',
    },
  ],
});

const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};

const service = createMcpStdioClientService({ projectRoot });
const listResult = await service.listTools({ serverId: 'fake' });
assert.equal(listResult.ok, true);
assert.equal(listResult.tools.length, 1);
assert.equal(listResult.tools[0]?.serverId, 'fake');
assert.equal(listResult.tools[0]?.name, 'echo');

const callResult = await service.callTool({
  arguments: { text: 'hello' },
  name: 'echo',
  serverId: 'fake',
});
assert.equal(callResult.isError, false);
assert.equal(callResult.content[0]?.text, 'echo:hello');
assert.equal(callResult.structuredContent?.echoed, 'hello');

const invalidCallResult = await service.callTool({
  arguments: { text: 42 },
  name: 'echo',
  serverId: 'fake',
});
assert.equal(invalidCallResult.isError, true);
assert.equal(invalidCallResult.structuredContent?.schemaValidation?.error, 'mcp_tool_arguments_schema_invalid');

console.log('agent MCP stdio client smoke passed');
