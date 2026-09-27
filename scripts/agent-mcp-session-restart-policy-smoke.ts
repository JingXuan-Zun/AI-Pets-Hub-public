import { strict as assert } from 'node:assert';
import { projectRoot } from './smokeTestHarness.ts';

type McpSessionStatus = {
  closed: boolean;
  lastCloseKind?: string | null;
  nextRestartAt?: number | null;
  restartConsecutiveFailures?: number;
  restartStatus?: string;
  restartWaitMs?: number;
};

type McpService = {
  getSessionStatus: () => McpSessionStatus[];
  listTools: (request?: Record<string, unknown>) => Promise<{ tools: Array<{ name: string }> }>;
  resetSession: (request?: { serverId?: string }) => DesktopPetMcpSessionResetResultLike;
};

const serverId = 'restart-policy-exit';

process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [{
    args: ['-e', 'process.exit(31)'],
    command: process.execPath,
    id: serverId,
    timeoutMs: 1000,
    title: 'Restart Policy Exit MCP',
  }],
});

const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};
const { createMcpStdioSessionPool } = await import('../electron/mcpStdioSessionPool.cjs') as {
  createMcpStdioSessionPool: (options: Record<string, unknown>) => unknown;
};

const sessionPool = createMcpStdioSessionPool({
  maxRestartBackoffMs: 200,
  restartBackoffMs: 200,
});
const service = createMcpStdioClientService({
  projectRoot,
  reuseSessions: true,
  sessionPool,
});

const failedList = await service.listTools({ serverId });
assert.equal(failedList.tools.length, 0);

const failedStatus = service.getSessionStatus()[0];
assert.equal(failedStatus?.closed, true);
assert.equal(failedStatus?.lastCloseKind, 'process-exit');
assert.equal(failedStatus?.restartConsecutiveFailures, 1);
assert.equal(failedStatus?.restartStatus, 'cooldown');
assert.equal(typeof failedStatus?.nextRestartAt, 'number');
assert.ok((failedStatus?.restartWaitMs ?? 0) > 0);

const cooledList = await service.listTools({ serverId });
assert.equal(cooledList.tools.length, 0);
assert.equal(service.getSessionStatus()[0]?.restartConsecutiveFailures, 1);

await new Promise((resolve) => setTimeout(resolve, 260));
await service.listTools({ serverId });
assert.equal(service.getSessionStatus()[0]?.restartConsecutiveFailures, 2);

const resetResult = service.resetSession({ serverId });
assert.equal(resetResult.ok, true);
assert.equal(resetResult.closedCount, 0);
assert.equal(service.getSessionStatus().length, 0);

console.log('agent MCP session restart policy smoke passed');
