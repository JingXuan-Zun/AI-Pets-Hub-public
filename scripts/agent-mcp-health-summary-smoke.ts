import { strict as assert } from 'node:assert';
import { createSettingsMcpHealthSummaries } from '../src/components/settings/settingsMcpHealthSummary';
import { type SettingsMcpServerDraft } from '../src/components/settings/settingsMcpConfigFormUtils';

function createServer(overrides: Partial<SettingsMcpServerDraft> = {}): SettingsMcpServerDraft {
  return {
    argsText: 'server.js\n--flag',
    command: 'node',
    cwd: '',
    envJson: '{}',
    id: 'external-fake',
    title: 'External Fake',
    ...overrides,
  };
}

const pending = createSettingsMcpHealthSummaries({
  servers: [createServer()],
  tools: [],
});
assert.equal(pending[0]?.status, 'pending');
assert.equal(pending[0]?.lastRefreshLabel, 'not refreshed');

const ok = createSettingsMcpHealthSummaries({
  lastRefreshAt: 1_000,
  servers: [createServer()],
  tools: [{
    description: 'Echo text.',
    inputSchema: { type: 'object' },
    name: 'echo',
    serverId: 'external-fake',
    title: 'Echo',
  }],
});
assert.equal(ok[0]?.status, 'ok');
assert.equal(ok[0]?.toolCount, 1);
assert.match(ok[0]?.commandHint ?? '', /node/u);

const noTools = createSettingsMcpHealthSummaries({
  lastRefreshAt: 1_000,
  servers: [createServer({ id: 'empty-server' })],
  tools: [],
});
assert.equal(noTools[0]?.status, 'warning');
assert.equal(noTools[0]?.statusLabel, 'no tools');

const failed = createSettingsMcpHealthSummaries({
  lastError: 'spawn failed',
  lastRefreshAt: 1_000,
  servers: [createServer()],
  tools: [],
});
assert.equal(failed[0]?.status, 'error');
assert.equal(failed[0]?.error, 'spawn failed');

const serverCheckOk = createSettingsMcpHealthSummaries({
  checksByServerId: {
    'external-fake': {
      commandPathExists: true,
      cwdExists: true,
      durationMs: 42,
      error: null,
      lastCheckedAt: 2_000,
      timeoutMs: 15_000,
      toolCount: 2,
    },
  },
  lastError: 'global refresh failed',
  lastRefreshAt: 1_000,
  servers: [createServer()],
  tools: [],
});
assert.equal(serverCheckOk[0]?.status, 'ok');
assert.equal(serverCheckOk[0]?.error, null);
assert.equal(serverCheckOk[0]?.toolCount, 2);
assert.notEqual(serverCheckOk[0]?.lastRefreshLabel, failed[0]?.lastRefreshLabel);
assert.deepEqual(serverCheckOk[0]?.diagnostics, ['42ms', 'timeout 15000ms']);

const serverCheckFailed = createSettingsMcpHealthSummaries({
  checksByServerId: {
    'external-fake': {
      commandPathExists: false,
      cwdExists: false,
      error: 'server-only spawn failed',
      lastCheckedAt: 2_000,
      stderrSnippet: 'spawn failed detail',
      toolCount: 0,
    },
  },
  servers: [createServer()],
  tools: [],
});
assert.equal(serverCheckFailed[0]?.status, 'error');
assert.equal(serverCheckFailed[0]?.error, 'server-only spawn failed');
assert.deepEqual(serverCheckFailed[0]?.diagnostics, [
  'cwd missing',
  'command path missing',
  'stderr: spawn failed detail',
]);

const compatibilityFailure = createSettingsMcpHealthSummaries({
  checksByServerId: {
    'external-fake': {
      compatibilityIssueCode: 'runtime-missing',
      compatibilityNextAction: 'Install the required runtime.',
      compatibilityStatus: 'blocked',
      compatibilitySummary: 'The configured runtime is unavailable.',
      error: 'spawn node ENOENT',
      lastCheckedAt: 2_000,
      toolCount: 0,
    },
  },
  servers: [createServer()],
  tools: [],
});
assert.equal(compatibilityFailure[0]?.status, 'error');
assert.deepEqual(compatibilityFailure[0]?.diagnostics, [
  'compatibility: runtime-missing',
  'The configured runtime is unavailable.',
  'next: Install the required runtime.',
]);

const invalidEnv = createSettingsMcpHealthSummaries({
  lastRefreshAt: 1_000,
  servers: [createServer({ envJson: '[]' })],
  tools: [],
});
assert.equal(invalidEnv[0]?.status, 'error');
assert.equal(invalidEnv[0]?.error, 'Environment JSON must be an object.');

const missingCommand = createSettingsMcpHealthSummaries({
  servers: [createServer({ command: '' })],
  tools: [],
});
assert.equal(missingCommand[0]?.status, 'error');
assert.equal(missingCommand[0]?.commandHint, 'missing command');

console.log('agent MCP health summary smoke passed');
