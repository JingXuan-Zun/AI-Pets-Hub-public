import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, projectRoot, readProjectFile } from './smokeTestHarness.ts';

type McpService = {
  dispose: () => number;
  getSessionStatus: () => DesktopPetMcpSessionStatusLike[];
  listTools: (request?: Record<string, unknown>) => Promise<{ tools: Array<{ name: string }> }>;
  resetSession: (request?: { serverId?: string }) => DesktopPetMcpSessionResetResultLike;
};

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-session-ui-'));
const spawnCountPath = path.join(tempRoot, 'spawn-count.txt');
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');

process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
  servers: [{
    args: [fakeServerPath],
    command: process.execPath,
    env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
    id: 'session-ui-fake',
    title: 'Session UI Fake MCP',
  }],
});

const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
  createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
};

const service = createMcpStdioClientService({
  idleSessionTimeoutMs: 5000,
  projectRoot,
  reuseSessions: true,
});

assert.equal((await service.listTools({ serverId: 'session-ui-fake' })).tools[0]?.name, 'echo');
assert.equal(service.getSessionStatus()[0]?.serverId, 'session-ui-fake');
assert.equal(service.getSessionStatus()[0]?.idleTimeoutMs, 5000);

const resetOne = service.resetSession({ serverId: 'session-ui-fake' });
assert.equal(resetOne.ok, true);
assert.equal(resetOne.closedCount, 1);
assert.equal(resetOne.closeKind, 'manual-reset');
assert.equal(resetOne.closeReason, 'manual-reset');
assert.equal(typeof resetOne.closedAt, 'number');
assert.equal(service.getSessionStatus().length, 0);

await service.listTools({ serverId: 'session-ui-fake' });
assert.equal(service.resetSession().closedCount, 1);
assert.equal(service.dispose(), 0);

const ipcSource = readProjectFile('electron/ipcHandlers.cjs');
const preloadSource = readProjectFile('electron/preload.cjs');
const bridgeSource = readProjectFile('src/desktopShellBridge.ts');
const runtimeSource = readProjectFile('src/desktopShellRuntime.ts');
const panelSource = readProjectFile('src/components/settings/SettingsMcpSessionPoolPanel.tsx');
const sectionSource = readProjectFile('src/components/settings/SettingsMcpSection.tsx');
const advancedWorkspaceSource = readProjectFile('src/components/settings/SettingsMcpAdvancedWorkspace.tsx');
const operationalPanelsSource = readProjectFile('src/components/settings/SettingsMcpOperationalPanels.tsx');

assert.match(ipcSource, /desktop-pet:get-mcp-session-status/u);
assert.match(ipcSource, /desktop-pet:reset-mcp-session/u);
assert.match(preloadSource, /getMcpSessionStatus/u);
assert.match(bridgeSource, /resetMcpSession/u);
assert.match(runtimeSource, /getMcpSessionStatus/u);
assert.match(panelSource, /MCP sessions/u);
assert.match(panelSource, /Reset all MCP sessions/u);
assert.match(panelSource, /last close/u);
assert.match(panelSource, /restartStatus/u);
assert.match(panelSource, /onShowHistory/u);
assert.match(sectionSource, /<SettingsMcpAdvancedWorkspace\b/u);
assert.match(advancedWorkspaceSource, /<SettingsMcpOperationalPanels\b/u);
assert.match(operationalPanelsSource, /SettingsMcpSessionPoolPanel/u);
assert.match(operationalPanelsSource, /selectHistoryServer/u);

console.log('agent MCP session pool UI smoke passed');
