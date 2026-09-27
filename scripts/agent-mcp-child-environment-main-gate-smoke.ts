import assert from 'node:assert/strict';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
const previousHostKey = process.env.HOST_API_KEY;
process.env.HOST_API_KEY = 'host-only-test-value';
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [{
    args: [projectPath('scripts/fixtures/environment-probe-mcp-stdio-server.cjs')],
    command: process.execPath,
    env: { EXPLICIT_API_KEY: 'explicit-test-value' },
    id: 'environment-probe',
    timeoutMs: 2_000,
  }],
});

try {
  const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
    createMcpStdioClientService: (options: Record<string, unknown>) => {
      callTool: (request: Record<string, unknown>) => Promise<DesktopPetMcpToolCallResultLike>;
      dispose: (reason?: string) => number;
    };
  };
  const service = createMcpStdioClientService({ projectRoot, reuseSessions: true });
  try {
    const result = await service.callTool({
      arguments: {},
      name: 'inspect_environment',
      serverId: 'environment-probe',
    });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, {
      desktopPetConfigPresent: false,
      explicitServerKeyPresent: true,
      hostKeyPresent: false,
      pathPresent: true,
    });
  } finally {
    service.dispose('child-environment-main-gate-smoke-complete');
  }
} finally {
  if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
  if (previousHostKey === undefined) delete process.env.HOST_API_KEY;
  else process.env.HOST_API_KEY = previousHostKey;
}

console.log('agent MCP child environment main gate smoke passed');
