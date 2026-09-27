import {
  createSettingsMcpLifecycleSummaries,
  type SettingsMcpLifecycleServerSummary,
} from './settingsMcpLifecycleSummary';

export type SettingsMcpLifecycleHardeningCheckId =
  | 'controlled-close-reason'
  | 'live-session-status'
  | 'operator-guidance'
  | 'restart-blocked'
  | 'restart-cooldown'
  | 'restart-recovered';

export interface SettingsMcpLifecycleHardeningCheck {
  detail: string;
  id: SettingsMcpLifecycleHardeningCheckId;
  status: 'ready' | 'todo';
  title: string;
}

export interface SettingsMcpLifecycleHardeningEvidenceReport {
  checks: SettingsMcpLifecycleHardeningCheck[];
  generatedAt: string;
  kind: 'settings-mcp-lifecycle-hardening-evidence';
  readyCount: number;
  serverCount: number;
  status: 'blocked' | 'partial' | 'ready';
  summaryText: string;
  summaries: SettingsMcpLifecycleServerSummary[];
  version: 1;
}

const CONTROLLED_CLOSE_KINDS = new Set([
  'app-quit',
  'client-dispose',
  'config-save',
  'idle-timeout',
  'manual-reset',
  'replaced',
]);

function hasControlledClose(
  entries: DesktopPetMcpHistoryEntryLike[],
  sessions: DesktopPetMcpSessionStatusLike[],
) {
  const closeKinds = [
    ...entries.map((entry) => entry.closeKind || ''),
    ...sessions.flatMap((session) => [
      session.closeKind || '',
      session.lastCloseKind || '',
    ]),
  ];
  return closeKinds.some((kind) => CONTROLLED_CLOSE_KINDS.has(kind));
}

function createCheck(
  id: SettingsMcpLifecycleHardeningCheckId,
  title: string,
  ready: boolean,
  detail: string,
): SettingsMcpLifecycleHardeningCheck {
  return {
    detail,
    id,
    status: ready ? 'ready' : 'todo',
    title,
  };
}

function createChecks(options: {
  entries: DesktopPetMcpHistoryEntryLike[];
  sessions: DesktopPetMcpSessionStatusLike[];
  summaries: SettingsMcpLifecycleServerSummary[];
}) {
  const summaries = options.summaries;
  return [
    createCheck(
      'restart-cooldown',
      'Restart cooldown evidence',
      summaries.some((summary) => summary.cooldownCount > 0 || summary.liveRestartStatus === 'cooldown'),
      'At least one lifecycle row should show cooldown after failure.',
    ),
    createCheck(
      'restart-blocked',
      'Restart blocked evidence',
      summaries.some((summary) => summary.blockedCount > 0),
      'At least one lifecycle row should show retry blocking during cooldown.',
    ),
    createCheck(
      'restart-recovered',
      'Restart recovered evidence',
      summaries.some((summary) => summary.recoveredCount > 0),
      'At least one lifecycle row should show recovery after a failed session.',
    ),
    createCheck(
      'live-session-status',
      'Live session status evidence',
      summaries.some((summary) => summary.hasLiveSession),
      'At least one server should expose live pooled-session status.',
    ),
    createCheck(
      'controlled-close-reason',
      'Controlled close reason evidence',
      hasControlledClose(options.entries, options.sessions),
      'A controlled close kind such as manual reset, app quit, replaced, or idle timeout should be visible.',
    ),
    createCheck(
      'operator-guidance',
      'Operator guidance evidence',
      summaries.some((summary) => summary.suggestedFixes.length > 0),
      'Lifecycle summaries should produce actionable fixes for failure evidence.',
    ),
  ];
}

function createOverallStatus(checks: SettingsMcpLifecycleHardeningCheck[], summaryCount: number) {
  const readyCount = checks.filter((check) => check.status === 'ready').length;
  if (summaryCount === 0 || readyCount === 0) {
    return 'blocked' as const;
  }

  return readyCount === checks.length ? 'ready' as const : 'partial' as const;
}

export function createSettingsMcpLifecycleHardeningEvidenceReport(options: {
  entries: DesktopPetMcpHistoryEntryLike[];
  sessions?: DesktopPetMcpSessionStatusLike[];
}): SettingsMcpLifecycleHardeningEvidenceReport {
  const sessions = options.sessions ?? [];
  const summaries = createSettingsMcpLifecycleSummaries(options.entries, sessions);
  const checks = createChecks({ entries: options.entries, sessions, summaries });
  const readyCount = checks.filter((check) => check.status === 'ready').length;
  const status = createOverallStatus(checks, summaries.length);
  return {
    checks,
    generatedAt: new Date().toISOString(),
    kind: 'settings-mcp-lifecycle-hardening-evidence',
    readyCount,
    serverCount: summaries.length,
    status,
    summaries,
    summaryText: `MCPLifecycleHardeningEvidence status=${status} ready=${readyCount}/${checks.length} servers=${summaries.length}`,
    version: 1,
  };
}
