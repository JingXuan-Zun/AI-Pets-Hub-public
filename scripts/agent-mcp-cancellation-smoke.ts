import { strict as assert } from 'node:assert';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type McpService = {
  callTool: (request: Record<string, unknown>) => Promise<{
    content: Array<{ text: string; type: string }>;
    isError?: boolean;
  }>;
  cancelToolCall: (request?: { requestId?: string }) => {
    cancelled: boolean;
    ok?: boolean;
    requestId?: string;
  };
};

const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [
    {
      args: [fakeServerPath],
      command: process.execPath,
      id: 'fake-cancel',
      title: 'Fake Cancel MCP',
    },
  ],
});

const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};

const service = createMcpStdioClientService({ projectRoot });
const requestId = `cancel-smoke-${Date.now()}`;
const pendingCall = service.callTool({
  arguments: { delayMs: 5000, text: 'slow' },
  name: 'echo',
  requestId,
  serverId: 'fake-cancel',
});

await new Promise((resolve) => setTimeout(resolve, 500));
const cancelResult = service.cancelToolCall({ requestId });
assert.equal(cancelResult.cancelled, true);
assert.equal(cancelResult.ok, true);

const result = await pendingCall;
assert.equal(result.isError, true);
assert.match(result.content[0]?.text ?? '', /closed|exited|cancelled/i);

console.log('agent MCP cancellation smoke passed');
