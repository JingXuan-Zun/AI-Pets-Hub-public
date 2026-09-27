import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type McpService = {
  callTool: (request: Record<string, unknown>) => Promise<{
    content: Array<{ text: string; type: string }>;
    isError?: boolean;
  }>;
  dispose: () => number;
  getSessionStatus: () => Array<{
    closed: boolean;
    idleTimeoutMs?: number;
    lastCloseKind?: string | null;
    lastCloseReason?: string | null;
    lastClosedAt?: number | null;
    lastUsedAt?: number;
    pendingCount: number;
    restartConsecutiveFailures?: number;
    serverId: string;
  }>;
  listTools: (request?: Record<string, unknown>) => Promise<{
    ok: boolean;
    tools: Array<{ name: string; serverId: string }>;
  }>;
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-reuse-'));
const spawnCountPath = path.join(tempRoot, 'spawn-count.txt');
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');

process.env.FAKE_MCP_SPAWN_COUNT_PATH = spawnCountPath;
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [
    {
      args: [fakeServerPath],
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
      id: 'reuse-fake',
      title: 'Reuse Fake MCP',
    },
  ],
});

const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};

function readSpawnCount() {
  return Number(fs.readFileSync(spawnCountPath, 'utf8'));
}

const service = createMcpStdioClientService({
  idleSessionTimeoutMs: 60,
  projectRoot,
  reuseSessions: true,
});

const listResult = await service.listTools({ serverId: 'reuse-fake' });
assert.equal(listResult.ok, true);
assert.equal(listResult.tools[0]?.name, 'echo');
assert.equal(readSpawnCount(), 1);
assert.deepEqual(service.getSessionStatus().map((status) => status.serverId), ['reuse-fake']);

const callResult = await service.callTool({
  arguments: { text: 'pooled' },
  name: 'echo',
  serverId: 'reuse-fake',
});
assert.equal(callResult.isError, false);
assert.equal(callResult.content[0]?.text, 'echo:pooled');
assert.equal(readSpawnCount(), 1);
assert.equal(service.getSessionStatus()[0]?.closed, false);
assert.equal(service.getSessionStatus()[0]?.idleTimeoutMs, 60);
assert.equal(typeof service.getSessionStatus()[0]?.lastUsedAt, 'number');
assert.equal(service.getSessionStatus()[0]?.restartConsecutiveFailures, 0);

await new Promise((resolve) => setTimeout(resolve, 140));
assert.equal(service.getSessionStatus().length, 0);

assert.equal(service.dispose(), 0);
assert.equal(service.getSessionStatus().length, 0);

const secondListResult = await service.listTools({ serverId: 'reuse-fake' });
assert.equal(secondListResult.tools[0]?.name, 'echo');
assert.equal(readSpawnCount(), 2);
assert.equal(service.getSessionStatus()[0]?.lastCloseKind, 'idle-timeout');
assert.equal(service.getSessionStatus()[0]?.lastCloseReason, 'idle-timeout');
assert.equal(typeof service.getSessionStatus()[0]?.lastClosedAt, 'number');
assert.equal(service.dispose(), 1);

console.log('agent MCP session reuse smoke passed');
