import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectRoot } from './smokeTestHarness.ts';

type McpHistoryService = {
  listHistory: (request?: { limit?: number; serverId?: string }) => {
    entries: Array<{
      closeKind?: string | null;
      retryAfterMs?: number | null;
      serverId?: string;
      status: string;
      type: string;
    }>;
  };
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-session-history-'));
const historyStoragePath = path.join(tempRoot, 'mcp-history.v1.json');
const serverId = 'session-history-exit';

process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [{
    args: ['-e', 'process.exit(41)'],
    command: process.execPath,
    id: serverId,
    timeoutMs: 1000,
    title: 'Session History Exit MCP',
  }],
});

const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs') as {
  createMcpHistoryService: (options?: Record<string, unknown>) => McpHistoryService;
};
const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => {
    listTools: (request?: Record<string, unknown>) => Promise<{ tools: Array<{ name: string }> }>;
  };
};
const { createMcpStdioSessionPool } = await import('../electron/mcpStdioSessionPool.cjs') as {
  createMcpStdioSessionPool: (options: Record<string, unknown>) => unknown;
};

const history = createMcpHistoryService({ storagePath: historyStoragePath });
const sessionPool = createMcpStdioSessionPool({
  history,
  maxRestartBackoffMs: 250,
  restartBackoffMs: 250,
});
const service = createMcpStdioClientService({
  history,
  projectRoot,
  reuseSessions: true,
  sessionPool,
});

assert.equal((await service.listTools({ serverId })).tools.length, 0);
assert.equal((await service.listTools({ serverId })).tools.length, 0);

const entries = history.listHistory({ limit: 8, serverId }).entries;
assert.ok(entries.some((entry) => entry.type === 'session' && entry.status === 'restart-cooldown'));
assert.ok(entries.some((entry) => entry.type === 'session' && entry.status === 'restart-blocked'));
assert.ok(entries.some((entry) => entry.closeKind === 'process-exit'));
assert.ok(entries.some((entry) => (entry.retryAfterMs ?? 0) > 0));

const storedText = fs.readFileSync(historyStoragePath, 'utf8');
assert.match(storedText, /"type": "session"/u);
assert.doesNotMatch(storedText, /DESKTOP_PET_MCP_SERVERS_JSON/u);

console.log('agent MCP session history correlation smoke passed');
