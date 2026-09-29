import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type McpHistoryService = {
  listHistory: (request?: { limit?: number; serverId?: string }) => {
    entries: Array<{
      closeKind?: string | null;
      error?: string | null;
      ok?: boolean | null;
      retryAfterMs?: number | null;
      serverId?: string;
      status: string;
      toolName?: string;
      type: string;
    }>;
    totalCount: number;
  };
};

type McpSessionStatus = {
  closed: boolean;
  closeKind?: string | null;
  lastCloseKind?: string | null;
  pendingCount: number;
  restartConsecutiveFailures?: number;
  restartStatus?: string;
  restartWaitMs?: number;
  serverId: string;
};

type McpService = {
  callTool: (request: Record<string, unknown>) => Promise<{
    content: Array<{ text: string; type: string }>;
    isError?: boolean;
    structuredContent?: Record<string, unknown> | null;
  }>;
  dispose: (reason?: string) => number;
  getSessionStatus: () => McpSessionStatus[];
  listTools: (request?: Record<string, unknown>) => Promise<{
    ok: boolean;
    tools: Array<{ name: string; serverId: string }>;
  }>;
  resetSession: (request?: { serverId?: string }) => DesktopPetMcpSessionResetResultLike;
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-lifecycle-stress-'));
const historyStoragePath = path.join(tempRoot, 'mcp-history.v1.json');
const spawnCountPath = path.join(tempRoot, 'spawn-count.txt');
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
const serverId = 'lifecycle-stress-fake';
const cycleCount = 3;

process.env.FAKE_MCP_SPAWN_COUNT_PATH = spawnCountPath;
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [{
    args: [fakeServerPath],
    command: process.execPath,
    env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
    id: serverId,
    timeoutMs: 1000,
    title: 'Lifecycle Stress Fake MCP',
  }],
});

const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs') as {
  createMcpHistoryService: (options?: Record<string, unknown>) => McpHistoryService;
};
const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};
const { createMcpStdioSessionPool } = await import('../electron/mcpStdioSessionPool.cjs') as {
  createMcpStdioSessionPool: (options: Record<string, unknown>) => unknown;
};

function readSpawnCount() {
  return fs.existsSync(spawnCountPath)
    ? Number(fs.readFileSync(spawnCountPath, 'utf8'))
    : 0;
}

function getOnlyStatus(service: McpService) {
  const statuses = service.getSessionStatus().filter((status) => status.serverId === serverId);
  assert.ok(statuses.length <= 1, 'session status should not duplicate server rows');
  return statuses[0] ?? null;
}

async function assertHealthyCycle(service: McpService, cycle: number) {
  const listResult = await service.listTools({ serverId });
  assert.equal(listResult.ok, true);
  assert.equal(listResult.tools[0]?.name, 'echo');

  const callResult = await service.callTool({
    arguments: { text: `cycle-${cycle}` },
    name: 'echo',
    requestId: `lifecycle-stress-ok-${cycle}`,
    serverId,
  });
  assert.equal(callResult.isError, false);
  assert.equal(callResult.content[0]?.text, `echo:cycle-${cycle}`);

  const status = getOnlyStatus(service);
  assert.equal(status?.closed, false);
  assert.equal(status?.pendingCount, 0);
  assert.equal(status?.restartConsecutiveFailures, 0);
}

async function triggerTimeoutCycle(service: McpService, cycle: number) {
  const timeoutResult = await service.callTool({
    arguments: { delayMs: 2500, text: `timeout-${cycle}` },
    name: 'echo',
    requestId: `lifecycle-stress-timeout-${cycle}`,
    serverId,
  });

  assert.equal(timeoutResult.isError, true);
  assert.match(timeoutResult.content[0]?.text ?? '', /timed out|closed|exited/i);
}

async function assertCooldownAndBlockedList(service: McpService) {
  const cooldownStatus = getOnlyStatus(service);
  assert.equal(cooldownStatus?.closed, true);
  assert.equal(cooldownStatus?.restartStatus, 'cooldown');
  assert.equal(cooldownStatus?.restartConsecutiveFailures, 1);
  assert.ok((cooldownStatus?.restartWaitMs ?? 0) > 0);
  assert.ok(['rpc-failed', 'rpc-timeout'].includes(cooldownStatus?.lastCloseKind || cooldownStatus?.closeKind || ''));

  const blockedList = await service.listTools({ serverId });
  assert.equal(blockedList.ok, true);
  assert.equal(blockedList.tools.length, 0);
  assert.equal(getOnlyStatus(service)?.restartConsecutiveFailures, 1);
}

async function resetAndRecover(service: McpService, expectedClosedCount: number) {
  const resetResult = service.resetSession({ serverId });
  assert.equal(resetResult.ok, true);
  assert.equal(resetResult.closedCount, expectedClosedCount);
  assert.equal(getOnlyStatus(service), null);

  const recoveredList = await service.listTools({ serverId });
  assert.equal(recoveredList.tools[0]?.name, 'echo');

  const recoveredStatus = getOnlyStatus(service);
  assert.equal(recoveredStatus?.closed, false);
  assert.equal(recoveredStatus?.restartStatus, 'ok');
  assert.equal(recoveredStatus?.restartConsecutiveFailures, 0);
}

function assertHistory(history: McpHistoryService) {
  const entries = history.listHistory({ limit: 80, serverId }).entries;
  const sessionEntries = entries.filter((entry) => entry.type === 'session');
  const toolResults = entries.filter((entry) => entry.type === 'tool-call' && entry.status !== 'started');

  assert.ok(sessionEntries.filter((entry) => entry.status === 'restart-cooldown').length >= cycleCount);
  assert.ok(sessionEntries.filter((entry) => entry.status === 'restart-blocked').length >= cycleCount);
  assert.ok(toolResults.filter((entry) => entry.status === 'timeout').length >= cycleCount);
  assert.ok(toolResults.filter((entry) => entry.status === 'ok').length >= cycleCount * 2);
  assert.ok(entries.every((entry) => entry.serverId === serverId));
  assert.ok(entries.every((entry) => !String(entry.error ?? '').includes('echo:cycle-')));
  assert.ok(entries.every((entry) => !String(entry.error ?? '').includes('timeout-')));
  assert.ok(entries.some((entry) => (entry.retryAfterMs ?? 0) > 0));
}

const history = createMcpHistoryService({
  maxEntries: 120,
  storagePath: historyStoragePath,
});
const sessionPool = createMcpStdioSessionPool({
  history,
  maxRestartBackoffMs: 5000,
  restartBackoffMs: 5000,
});
const service = createMcpStdioClientService({
  history,
  projectRoot,
  reuseSessions: true,
  sessionPool,
});

for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
  await assertHealthyCycle(service, cycle);
  await triggerTimeoutCycle(service, cycle);
  await assertCooldownAndBlockedList(service);
  await resetAndRecover(service, 0);
  await assertHealthyCycle(service, cycle + 100);
  assert.ok(readSpawnCount() >= cycle + 1);
}

assertHistory(history);
assert.equal(service.dispose('client-dispose'), 1);
assert.equal(service.getSessionStatus().length, 0);
assert.equal(fs.existsSync(historyStoragePath), true);

console.log('agent MCP lifecycle stress smoke passed');
