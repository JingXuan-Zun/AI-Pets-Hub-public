import { strict as assert } from 'node:assert';
import {
  createMcpServerCheckStateFromDiagnostic,
  createMcpServerCheckStateFromError,
  runSettingsMcpDiagnosticsBatch,
} from '../src/components/settings/settingsMcpDiagnosticsBatch';
import { type SettingsMcpServerDraft } from '../src/components/settings/settingsMcpConfigFormUtils';
import { projectRoot } from './smokeTestHarness.ts';

function createServer(id: string): SettingsMcpServerDraft {
  return {
    argsText: '',
    command: 'node',
    cwd: '',
    envJson: '{}',
    id,
    title: id,
  };
}

const okDiagnostic: DesktopPetMcpServerDiagnosticLike = {
  command: 'node',
  commandPathExists: true,
  cwd: projectRoot,
  cwdExists: true,
  durationMs: 25,
  ok: true,
  serverId: 'ok-server',
  stderrSnippet: '',
  timeoutMs: 15_000,
  toolCount: 1,
  tools: [{
    description: 'Echo text.',
    inputSchema: { type: 'object' },
    name: 'echo',
    serverId: 'ok-server',
    title: 'Echo',
  }],
};

const failedDiagnostic: DesktopPetMcpServerDiagnosticLike = {
  command: 'node',
  commandPathExists: false,
  cwd: 'missing',
  cwdExists: false,
  durationMs: 10,
  error: 'spawn failed',
  ok: false,
  serverId: 'bad-server',
  stderrSnippet: 'bad cwd',
  timeoutMs: 15_000,
  toolCount: 0,
  tools: [],
};

const okCheck = createMcpServerCheckStateFromDiagnostic(okDiagnostic);
assert.equal(okCheck.commandPathExists, true);
assert.equal(okCheck.cwdExists, true);
assert.equal(okCheck.durationMs, 25);
assert.equal(okCheck.error, null);
assert.equal(okCheck.timeoutMs, 15_000);
assert.equal(okCheck.toolCount, 1);
assert.equal(typeof okCheck.lastCheckedAt, 'number');
assert.equal(createMcpServerCheckStateFromError(new Error('manual failure')).error, 'manual failure');

const batch = await runSettingsMcpDiagnosticsBatch({
  currentTools: [{
    description: 'Old tool.',
    inputSchema: {},
    name: 'old',
    serverId: 'ok-server',
    title: 'Old',
  }],
  inspectServer: async (serverId) => (serverId === 'ok-server' ? okDiagnostic : failedDiagnostic),
  servers: [createServer('ok-server'), createServer('bad-server')],
});

assert.equal(batch.totalCount, 2);
assert.equal(batch.okCount, 1);
assert.equal(batch.failedCount, 1);
assert.equal(batch.checksByServerId['ok-server']?.toolCount, 1);
assert.equal(batch.checksByServerId['bad-server']?.error, 'spawn failed');
assert.equal(batch.tools.some((tool) => tool.serverId === 'ok-server' && tool.name === 'old'), false);
assert.equal(batch.tools.some((tool) => tool.serverId === 'ok-server' && tool.name === 'echo'), true);

console.log('agent MCP diagnostics batch smoke passed');
