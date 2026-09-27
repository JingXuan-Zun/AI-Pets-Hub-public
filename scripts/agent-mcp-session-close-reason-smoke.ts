import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type McpSessionStatus = {
  closeKind?: string | null;
  closeReason?: string | null;
  lastCloseKind?: string | null;
  lastCloseReason?: string | null;
  lastClosedAt?: number | null;
  serverId: string;
};

type McpService = {
  dispose: (reason?: string) => number;
  getSessionStatus: () => McpSessionStatus[];
  listTools: (request?: Record<string, unknown>) => Promise<{ tools: Array<{ name: string }> }>;
  resetSession: (request?: { serverId?: string }) => DesktopPetMcpSessionResetResultLike;
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-close-reason-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');

const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};

function configureServer(id: string, args: string[]) {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    servers: [{
      args,
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: path.join(tempRoot, `${id}-spawn-count.txt`) },
      id,
      title: 'Close Reason Fake MCP',
    }],
  });
}

configureServer('close-reason-fake', [fakeServerPath]);
const service = createMcpStdioClientService({
  idleSessionTimeoutMs: 5000,
  projectRoot,
  reuseSessions: true,
});

assert.equal((await service.listTools({ serverId: 'close-reason-fake' })).tools[0]?.name, 'echo');
assert.equal(service.getSessionStatus()[0]?.lastCloseKind, null);

configureServer('close-reason-fake', [fakeServerPath, 'replacement']);
assert.equal((await service.listTools({ serverId: 'close-reason-fake' })).tools[0]?.name, 'echo');
assert.equal(service.getSessionStatus()[0]?.lastCloseKind, 'replaced');
assert.equal(service.getSessionStatus()[0]?.lastCloseReason, 'replaced');
assert.equal(typeof service.getSessionStatus()[0]?.lastClosedAt, 'number');

const resetResult = service.resetSession({ serverId: 'close-reason-fake' });
assert.equal(resetResult.closedCount, 1);
assert.equal(resetResult.closeKind, 'manual-reset');
assert.equal(resetResult.closeReason, 'manual-reset');

assert.equal((await service.listTools({ serverId: 'close-reason-fake' })).tools[0]?.name, 'echo');
assert.equal(service.getSessionStatus()[0]?.lastCloseKind, 'manual-reset');
assert.equal(service.dispose('app-quit'), 1);

assert.equal((await service.listTools({ serverId: 'close-reason-fake' })).tools[0]?.name, 'echo');
assert.equal(service.getSessionStatus()[0]?.lastCloseKind, 'app-quit');
assert.equal(service.dispose(), 1);

configureServer('idle-reason-fake', [fakeServerPath]);
const idleService = createMcpStdioClientService({
  idleSessionTimeoutMs: 30,
  projectRoot,
  reuseSessions: true,
});

assert.equal((await idleService.listTools({ serverId: 'idle-reason-fake' })).tools[0]?.name, 'echo');
await new Promise((resolve) => setTimeout(resolve, 100));
assert.equal(idleService.getSessionStatus().length, 0);
assert.equal((await idleService.listTools({ serverId: 'idle-reason-fake' })).tools[0]?.name, 'echo');
assert.equal(idleService.getSessionStatus()[0]?.lastCloseKind, 'idle-timeout');
assert.equal(idleService.dispose(), 1);

console.log('agent MCP session close reason smoke passed');
