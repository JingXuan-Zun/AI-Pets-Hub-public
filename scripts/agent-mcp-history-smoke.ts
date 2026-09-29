import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot } from './smokeTestHarness.ts';

type McpHistoryService = {
  clearHistory: (request?: { serverId?: string }) => {
    ok: boolean;
    removedCount: number;
    retentionLimit: number;
    totalCount: number;
  };
  exportHistory: (request?: { limit?: number; serverId?: string }) => {
    entryCount: number;
    fileName: string;
    mimeType: string;
    ok: boolean;
    text: string;
  };
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
    ok: boolean;
    retentionLimit?: number;
    totalCount: number;
  };
  recordDiagnostic: (result?: Record<string, unknown>) => void;
  recordSessionEvent: (event?: Record<string, unknown>) => void;
  setRetentionLimit: (request?: { limit?: number }) => {
    ok: boolean;
    removedCount: number;
    retentionLimit: number;
    totalCount: number;
  };
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-history-'));
const historyStoragePath = path.join(tempRoot, 'mcp-history.v1.json');
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [
    {
      args: [fakeServerPath],
      command: process.execPath,
      id: 'fake-history',
      title: 'Fake History MCP',
    },
    {
      command: path.join(tempRoot, 'missing-mcp-server.exe'),
      id: 'missing-context',
      title: 'Missing Context MCP',
    },
  ],
});

const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs') as {
  createMcpHistoryService: (options?: Record<string, unknown>) => McpHistoryService;
};
const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => {
    callTool: (request: Record<string, unknown>) => Promise<{ isError?: boolean }>;
    cancelToolCall: (request?: { requestId?: string }) => { cancelled: boolean; ok?: boolean };
  };
};
const { createMcpServerDiagnosticsService } = await import('../electron/mcpServerDiagnosticsService.cjs') as {
  createMcpServerDiagnosticsService: (options: Record<string, unknown>) => {
    inspect: (request?: { serverId?: string }) => Promise<DesktopPetMcpServerDiagnosticLike>;
  };
};

const history = createMcpHistoryService({ storagePath: historyStoragePath });
const client = createMcpStdioClientService({ history, projectRoot });
const diagnostics = createMcpServerDiagnosticsService({ history, projectRoot });

const diagnostic = await diagnostics.inspect({ serverId: 'fake-history' });
assert.equal(diagnostic.ok, true);

await client.listTools({ serverId: 'missing-context' });
const missingContextEntry = history.listHistory({ limit: 4 }).entries.find((entry) => (
  entry.type === 'diagnostic' && entry.serverId === 'missing-context'
));
assert.match(String(missingContextEntry?.error ?? ''), /spawn|ENOENT|EPERM/iu);
assert.match(String(missingContextEntry?.error ?? ''), /spawnCommand=/u);
assert.match(String(missingContextEntry?.error ?? ''), /serverCommand=/u);
assert.match(String(missingContextEntry?.error ?? ''), /cwd=/u);

history.recordSessionEvent({
  closeKind: 'process-exit',
  error: 'server exited with token=secret',
  ok: false,
  retryAfterMs: 1500,
  serverId: 'fake-history',
  status: 'restart-cooldown',
});

const callResult = await client.callTool({
  arguments: { text: 'tracked' },
  name: 'echo',
  requestId: 'history-call-ok',
  serverId: 'fake-history',
});
assert.equal(callResult.isError, false);

const pendingCall = client.callTool({
  arguments: { delayMs: 5000, text: 'slow' },
  name: 'echo',
  requestId: 'history-cancel',
  serverId: 'fake-history',
});
await new Promise((resolve) => setTimeout(resolve, 500));
const cancelResult = client.cancelToolCall({ requestId: 'history-cancel' });
assert.equal(cancelResult.cancelled, true);
await pendingCall;

const result = history.listHistory({ limit: 12 });
assert.equal(result.ok, true);
assert.ok(result.entries.some((entry) => entry.type === 'diagnostic' && entry.serverId === 'fake-history'));
assert.ok(result.entries.some((entry) => entry.type === 'tool-call' && entry.status === 'ok'));
assert.ok(result.entries.some((entry) => entry.type === 'cancellation' && entry.status === 'cancelled'));
assert.ok(result.entries.some((entry) => entry.type === 'session' && entry.status === 'restart-cooldown' && entry.closeKind === 'process-exit'));
assert.ok(result.entries.some((entry) => entry.type === 'tool-call' && entry.status === 'cancelled'));
assert.ok(result.entries.every((entry) => !String(entry.error ?? '').includes('tracked')));
assert.ok(result.entries.every((entry) => !String(entry.error ?? '').includes('secret')));
assert.equal(fs.existsSync(historyStoragePath), true);
assert.equal(fs.readFileSync(historyStoragePath, 'utf8').includes('tracked'), false);

const restoredHistory = createMcpHistoryService({ storagePath: historyStoragePath });
const restoredResult = restoredHistory.listHistory({ limit: 12, serverId: 'fake-history' });
assert.equal(restoredResult.ok, true);
assert.equal(restoredResult.totalCount >= 4, true);
assert.ok(restoredResult.entries.some((entry) => entry.type === 'diagnostic'));
assert.ok(restoredResult.entries.some((entry) => entry.type === 'cancellation'));
assert.ok(restoredResult.entries.some((entry) => entry.type === 'session'));

const exportResult = restoredHistory.exportHistory({ limit: 4, serverId: 'fake-history' });
assert.equal(exportResult.ok, true);
assert.equal(exportResult.entryCount, 4);
assert.equal(exportResult.mimeType, 'application/json');
assert.match(exportResult.fileName, /^mcp-history-/u);
assert.equal(exportResult.text.includes('tracked'), false);

const retentionResult = restoredHistory.setRetentionLimit({ limit: 2 });
assert.equal(retentionResult.ok, true);
assert.equal(retentionResult.retentionLimit, 2);
assert.equal(restoredHistory.listHistory({ limit: 12 }).entries.length, 2);
assert.equal(JSON.parse(fs.readFileSync(historyStoragePath, 'utf8')).retentionLimit, 2);
restoredHistory.recordDiagnostic({ durationMs: 1, ok: true, serverId: 'extra-history', toolCount: 0 });
assert.equal(restoredHistory.listHistory({ limit: 12 }).entries.length, 2);

const clearServerResult = restoredHistory.clearHistory({ serverId: 'fake-history' });
assert.equal(clearServerResult.ok, true);
assert.equal(clearServerResult.totalCount, 1);
const clearAllResult = restoredHistory.clearHistory();
assert.equal(clearAllResult.ok, true);
assert.equal(clearAllResult.totalCount, 0);
assert.equal(JSON.parse(fs.readFileSync(historyStoragePath, 'utf8')).entries.length, 0);

console.log('agent MCP history smoke passed');
