import { strict as assert } from 'node:assert';
import { createSettingsMcpLifecycleSummaries } from '../src/components/settings/settingsMcpLifecycleSummary';
import { readProjectFile } from './smokeTestHarness.ts';

const now = Date.now();
const summaries = createSettingsMcpLifecycleSummaries([
  {
    closeKind: 'process-exit',
    createdAt: now - 3000,
    error: 'spawn ENOENT',
    id: 'history-1',
    ok: false,
    retryAfterMs: 1500,
    serverId: 'broken-server',
    status: 'restart-cooldown',
    type: 'session',
  },
  {
    createdAt: now - 2000,
    error: 'MCP session broken-server restart cooling down after failure',
    id: 'history-2',
    ok: false,
    retryAfterMs: 900,
    serverId: 'broken-server',
    status: 'restart-blocked',
    type: 'session',
  },
  {
    createdAt: now - 1000,
    id: 'history-3',
    ok: true,
    serverId: 'recovered-server',
    status: 'restart-recovered',
    type: 'session',
  },
  {
    createdAt: now - 500,
    id: 'history-4',
    ok: true,
    serverId: 'broken-server',
    status: 'ok',
    type: 'diagnostic',
  },
]);

assert.equal(summaries.length, 2);
assert.equal(summaries[0]?.serverId, 'recovered-server');
assert.equal(summaries[0]?.severity, 'recovered');
assert.equal(summaries[1]?.serverId, 'broken-server');
assert.equal(summaries[1]?.blockedCount, 1);
assert.equal(summaries[1]?.cooldownCount, 1);
assert.equal(summaries[1]?.severity, 'blocked');
assert.ok((summaries[1]?.nextRetryAt ?? 0) > now - 2000);
assert.ok(summaries[1]?.suggestedFixes.some((suggestion) => /PATH/u.test(suggestion)));
assert.ok(summaries[1]?.suggestedFixes.some((suggestion) => /manual reset/u.test(suggestion)));

const liveSummaries = createSettingsMcpLifecycleSummaries([
  {
    createdAt: now - 1000,
    id: 'history-5',
    ok: true,
    serverId: 'cooling-live-server',
    status: 'restart-recovered',
    type: 'session',
  },
], [
  {
    closed: false,
    nextRestartAt: now + 4000,
    pendingCount: 2,
    restartLastError: 'startup timed out',
    restartStatus: 'cooldown',
    restartWaitMs: 4000,
    serverId: 'cooling-live-server',
  },
  {
    closed: false,
    lastUsedAt: now - 250,
    pendingCount: 0,
    restartStatus: 'ok',
    serverId: 'live-only-server',
  },
]);

assert.equal(liveSummaries.length, 2);
assert.equal(liveSummaries[0]?.serverId, 'live-only-server');
assert.equal(liveSummaries[0]?.hasLiveSession, true);
assert.equal(liveSummaries[0]?.hasLifecycleHistory, false);
assert.equal(liveSummaries[0]?.liveRestartStatus, 'ok');
assert.equal(liveSummaries[1]?.serverId, 'cooling-live-server');
assert.equal(liveSummaries[1]?.severity, 'cooldown');
assert.equal(liveSummaries[1]?.livePendingCount, 2);
assert.ok((liveSummaries[1]?.nextRetryAt ?? 0) > now);
assert.ok(liveSummaries[1]?.suggestedFixes.some((suggestion) => /timeout/u.test(suggestion)));

const panelSource = readProjectFile('src/components/settings/SettingsMcpLifecycleSummaryPanel.tsx');
const actionsSource = readProjectFile('src/components/settings/SettingsMcpLifecycleActions.tsx');
const historyPanelSource = readProjectFile('src/components/settings/SettingsMcpHistoryPanel.tsx');
const sectionSource = readProjectFile('src/components/settings/SettingsMcpSection.tsx');

assert.match(panelSource, /MCP lifecycle/u);
assert.match(panelSource, /next retry/u);
assert.match(panelSource, /getMcpSessionStatus/u);
assert.match(panelSource, /live active/u);
assert.match(panelSource, /suggestedFixes/u);
assert.match(panelSource, /SettingsMcpLifecycleActions/u);
assert.match(actionsSource, /resetMcpSession/u);
assert.match(actionsSource, /inspectMcpServer/u);
assert.match(actionsSource, /onEditServer/u);
assert.match(actionsSource, /onRefreshHistory/u);
assert.match(historyPanelSource, /SettingsMcpLifecycleSummaryPanel/u);
assert.match(historyPanelSource, /onRunServerDiagnostic/u);
assert.match(sectionSource, /const editServer = \(serverId: string\)/u);
assert.match(sectionSource, /onRunServerDiagnostic=\{\(serverId\) => testServer\(serverId\)\}/u);

console.log('agent MCP lifecycle summary UI smoke passed');
