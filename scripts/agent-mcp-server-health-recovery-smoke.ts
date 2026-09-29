import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type HealthStatus = {
  consecutiveFailures: number;
  lastError?: string | null;
  lastRecoveryAt?: number | null;
  nextRetryAt?: number | null;
  serverId: string;
  status: string;
};

type HealthService = {
  getStatus: (serverId: string) => HealthStatus;
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-health-'));
const flakyStatePath = path.join(tempRoot, 'flaky-state.txt');
const flakyServerPath = projectPath('scripts/fixtures/flaky-mcp-stdio-server.cjs');

process.env.FLAKY_MCP_STATE_PATH = flakyStatePath;
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [
    {
      args: [flakyServerPath],
      command: process.execPath,
      id: 'flaky-health',
      timeoutMs: 1000,
      title: 'Flaky Health MCP',
    },
  ],
});

const { createMcpServerHealthService } = await import('../electron/mcpServerHealthService.cjs') as {
  createMcpServerHealthService: (options?: Record<string, unknown>) => HealthService;
};
const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => {
    callTool: (request: Record<string, unknown>) => Promise<DesktopPetMcpToolCallResultLike>;
    listTools: (request?: Record<string, unknown>) => Promise<DesktopPetMcpToolListResultLike>;
  };
};
const { createMcpServerDiagnosticsService } = await import('../electron/mcpServerDiagnosticsService.cjs') as {
  createMcpServerDiagnosticsService: (options: Record<string, unknown>) => {
    inspect: (request?: { serverId?: string }) => Promise<DesktopPetMcpServerDiagnosticLike>;
  };
};

const health = createMcpServerHealthService({ baseBackoffMs: 10_000, maxBackoffMs: 10_000 });
const client = createMcpStdioClientService({ health, projectRoot });
const diagnostics = createMcpServerDiagnosticsService({ health, projectRoot });

const failedList = await client.listTools({ serverId: 'flaky-health' });
assert.equal(failedList.ok, true);
assert.equal(failedList.tools.length, 0);
assert.equal(health.getStatus('flaky-health').status, 'unhealthy');
assert.equal(health.getStatus('flaky-health').consecutiveFailures, 1);
assert.match(health.getStatus('flaky-health').lastError ?? '', /code=23/u);

const cooledList = await client.listTools({ serverId: 'flaky-health' });
assert.equal(cooledList.ok, true);
assert.equal(cooledList.tools.length, 0);
assert.equal(health.getStatus('flaky-health').consecutiveFailures, 1);
assert.equal(cooledList.serverHealth?.[0]?.status, 'unhealthy');

const cooldownCall = await client.callTool({
  name: 'recovered',
  serverId: 'flaky-health',
});
assert.equal(cooldownCall.isError, true);
assert.match(cooldownCall.content[0]?.text ?? '', /cooling down/u);
assert.equal(cooldownCall.structuredContent?.mcpServerHealth?.status, 'unhealthy');

const recoveredDiagnostic = await diagnostics.inspect({ serverId: 'flaky-health' });
assert.equal(recoveredDiagnostic.ok, true);
assert.equal(recoveredDiagnostic.toolCount, 1);
assert.equal(health.getStatus('flaky-health').status, 'ok');
assert.equal(typeof health.getStatus('flaky-health').lastRecoveryAt, 'number');

const recoveredList = await client.listTools({ serverId: 'flaky-health' });
assert.equal(recoveredList.ok, true);
assert.equal(recoveredList.tools[0]?.name, 'recovered');

const recoveredCall = await client.callTool({
  name: 'recovered',
  serverId: 'flaky-health',
});
assert.equal(recoveredCall.isError, false);
assert.equal(recoveredCall.structuredContent?.recovered, true);

console.log('agent MCP server health recovery smoke passed');
