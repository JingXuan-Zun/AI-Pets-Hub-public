import { strict as assert } from 'node:assert';
import {
  createSettingsMcpLifecycleHardeningEvidenceReport,
} from '../src/components/settings/settingsMcpLifecycleHardeningEvidence';

const now = Date.now();
const entries = [
  {
    closeKind: 'process-exit',
    createdAt: now - 5000,
    error: 'spawn ENOENT',
    id: 'history-1',
    ok: false,
    retryAfterMs: 1500,
    serverId: 'broken-server',
    status: 'restart-cooldown',
    type: 'session',
  },
  {
    createdAt: now - 4000,
    error: 'MCP session broken-server restart cooling down after failure',
    id: 'history-2',
    ok: false,
    retryAfterMs: 900,
    serverId: 'broken-server',
    status: 'restart-blocked',
    type: 'session',
  },
  {
    createdAt: now - 3000,
    id: 'history-3',
    ok: true,
    serverId: 'recovered-server',
    status: 'restart-recovered',
    type: 'session',
  },
  {
    closeKind: 'manual-reset',
    createdAt: now - 2000,
    id: 'history-4',
    ok: true,
    serverId: 'broken-server',
    status: 'manual-reset',
    type: 'session',
  },
] satisfies DesktopPetMcpHistoryEntryLike[];

const sessions = [
  {
    closed: false,
    lastCloseKind: 'manual-reset',
    lastClosedAt: now - 1800,
    lastUsedAt: now - 200,
    pendingCount: 0,
    restartStatus: 'ok',
    serverId: 'broken-server',
  },
  {
    closed: false,
    nextRestartAt: now + 3000,
    pendingCount: 1,
    restartLastError: 'startup timed out',
    restartStatus: 'cooldown',
    restartWaitMs: 3000,
    serverId: 'cooling-live-server',
  },
] satisfies DesktopPetMcpSessionStatusLike[];

const report = createSettingsMcpLifecycleHardeningEvidenceReport({ entries, sessions });
assert.equal(report.kind, 'settings-mcp-lifecycle-hardening-evidence');
assert.equal(report.status, 'ready');
assert.equal(report.readyCount, 6);
assert.equal(report.checks.length, 6);
assert.match(report.summaryText, /MCPLifecycleHardeningEvidence status=ready ready=6\/6/u);
assert.ok(report.serverCount >= 3);
assert.equal(report.checks.find((check) => check.id === 'restart-cooldown')?.status, 'ready');
assert.equal(report.checks.find((check) => check.id === 'restart-blocked')?.status, 'ready');
assert.equal(report.checks.find((check) => check.id === 'restart-recovered')?.status, 'ready');
assert.equal(report.checks.find((check) => check.id === 'live-session-status')?.status, 'ready');
assert.equal(report.checks.find((check) => check.id === 'controlled-close-reason')?.status, 'ready');
assert.equal(report.checks.find((check) => check.id === 'operator-guidance')?.status, 'ready');
assert.ok(report.summaries.some((summary) => summary.suggestedFixes.some((fix) => /PATH/u.test(fix))));
assert.ok(report.summaries.some((summary) => summary.liveRestartStatus === 'cooldown'));

const blockedReport = createSettingsMcpLifecycleHardeningEvidenceReport({
  entries: [{
    createdAt: now,
    id: 'diagnostic-1',
    ok: true,
    serverId: 'quiet-server',
    status: 'ok',
    type: 'diagnostic',
  }],
  sessions: [],
});
assert.equal(blockedReport.status, 'blocked');
assert.equal(blockedReport.readyCount, 0);
assert.equal(blockedReport.serverCount, 0);
assert.ok(blockedReport.checks.every((check) => check.status === 'todo'));

console.log('agent MCP lifecycle hardening evidence smoke passed');
