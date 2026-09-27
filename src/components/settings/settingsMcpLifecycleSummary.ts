export type SettingsMcpLifecycleSeverity = 'quiet' | 'cooldown' | 'blocked' | 'recovered';

export interface SettingsMcpLifecycleServerSummary {
  blockedCount: number;
  cooldownCount: number;
  hasLifecycleHistory: boolean;
  hasLiveSession: boolean;
  lastCloseKind: string;
  lastError: string;
  lastEventAt: number;
  lastRetryAfterMs: number | null;
  lastStatus: string;
  liveActivityAt: number;
  liveCloseKind: string;
  liveCloseReason: string;
  liveClosed: boolean | null;
  livePendingCount: number | null;
  liveRestartStatus: string;
  liveRestartWaitMs: number | null;
  nextRetryAt: number | null;
  recoveredCount: number;
  serverId: string;
  severity: SettingsMcpLifecycleSeverity;
  suggestedFixes: string[];
  totalCount: number;
}

const MCP_LIFECYCLE_STATUSES = new Set([
  'restart-blocked',
  'restart-cooldown',
  'restart-recovered',
]);

function isMcpLifecycleEntry(entry: DesktopPetMcpHistoryEntryLike) {
  return entry.type === 'session' && MCP_LIFECYCLE_STATUSES.has(entry.status);
}

function getLifecycleSeverity(status: string): SettingsMcpLifecycleSeverity {
  if (status === 'restart-blocked') {
    return 'blocked';
  }

  if (status === 'restart-cooldown') {
    return 'cooldown';
  }

  if (status === 'restart-recovered') {
    return 'recovered';
  }

  return 'quiet';
}

function getSummarySeverity(
  status: string,
  session?: DesktopPetMcpSessionStatusLike,
): SettingsMcpLifecycleSeverity {
  if (session?.restartStatus === 'cooldown') {
    return 'cooldown';
  }

  return getLifecycleSeverity(status);
}

function addSuggestion(suggestions: string[], suggestion: string) {
  if (!suggestions.includes(suggestion)) {
    suggestions.push(suggestion);
  }
}

function createSuggestedFixes(
  entries: DesktopPetMcpHistoryEntryLike[],
  session?: DesktopPetMcpSessionStatusLike,
) {
  const suggestions: string[] = [];
  const sessionError = session?.restartLastError || session?.closeReason || session?.lastCloseReason || '';
  const combinedError = [...entries.map((entry) => entry.error || ''), sessionError].join(' ');
  const closeKinds = new Set([
    ...entries.map((entry) => entry.closeKind || ''),
    session?.closeKind || '',
    session?.lastCloseKind || '',
  ].filter(Boolean));
  const blockedCount = entries.filter((entry) => entry.status === 'restart-blocked').length;

  if (closeKinds.has('process-exit')) {
    addSuggestion(suggestions, 'Check command, args, cwd, and whether the server exits after startup.');
  }

  if (/enoent|not found|cannot find|spawn/i.test(combinedError)) {
    addSuggestion(suggestions, 'Verify the server command is installed and available on PATH.');
  }

  if (/cwd|working directory|directory/i.test(combinedError)) {
    addSuggestion(suggestions, 'Verify the configured cwd exists and matches the server package.');
  }

  if (/timeout|timed out/i.test(combinedError)) {
    addSuggestion(suggestions, 'Increase timeout or reduce server startup work.');
  }

  if (/env|environment|api[_ -]?key|credential/i.test(combinedError)) {
    addSuggestion(suggestions, 'Check required environment variables and credentials.');
  }

  if (blockedCount > 0) {
    addSuggestion(suggestions, 'After fixing config, use manual reset or wait for the cooldown retry.');
  }

  return suggestions.slice(0, 3);
}

function getSessionActivityAt(session?: DesktopPetMcpSessionStatusLike) {
  return Math.max(
    Number(session?.lastClosedAt ?? 0),
    Number(session?.lastUsedAt ?? 0),
    Number(session?.restartLastFailureAt ?? 0),
    Number(session?.restartLastStartedAt ?? 0),
  );
}

function getNextRetryAt(
  lastEntry: DesktopPetMcpHistoryEntryLike | undefined,
  session?: DesktopPetMcpSessionStatusLike,
) {
  if (Number(session?.nextRestartAt ?? 0) > 0) {
    return Number(session?.nextRestartAt);
  }

  const lastRetryAfterMs = lastEntry?.retryAfterMs ?? null;
  return lastRetryAfterMs && lastRetryAfterMs > 0 && lastEntry
    ? lastEntry.createdAt + lastRetryAfterMs
    : null;
}

function createSummary(
  serverId: string,
  entries: DesktopPetMcpHistoryEntryLike[],
  session?: DesktopPetMcpSessionStatusLike,
): SettingsMcpLifecycleServerSummary {
  const sortedEntries = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  const lastEntry = sortedEntries[sortedEntries.length - 1];
  const liveRestartWaitMs = session?.restartWaitMs ?? null;
  const lastRetryAfterMs = liveRestartWaitMs && liveRestartWaitMs > 0
    ? liveRestartWaitMs
    : lastEntry?.retryAfterMs ?? null;

  return {
    blockedCount: sortedEntries.filter((entry) => entry.status === 'restart-blocked').length,
    cooldownCount: sortedEntries.filter((entry) => entry.status === 'restart-cooldown').length,
    hasLifecycleHistory: sortedEntries.length > 0,
    hasLiveSession: Boolean(session),
    lastCloseKind: lastEntry?.closeKind || session?.closeKind || session?.lastCloseKind || '',
    lastError: lastEntry?.error || session?.restartLastError || '',
    lastEventAt: lastEntry?.createdAt ?? 0,
    lastRetryAfterMs,
    lastStatus: lastEntry?.status || 'no lifecycle history',
    liveActivityAt: getSessionActivityAt(session),
    liveCloseKind: session?.closeKind || session?.lastCloseKind || '',
    liveCloseReason: session?.closeReason || session?.lastCloseReason || '',
    liveClosed: session ? session.closed : null,
    livePendingCount: session?.pendingCount ?? null,
    liveRestartStatus: session?.restartStatus || '',
    liveRestartWaitMs,
    nextRetryAt: getNextRetryAt(lastEntry, session),
    recoveredCount: sortedEntries.filter((entry) => entry.status === 'restart-recovered').length,
    serverId,
    severity: getSummarySeverity(lastEntry?.status || '', session),
    suggestedFixes: createSuggestedFixes(sortedEntries, session),
    totalCount: sortedEntries.length,
  };
}

export function createSettingsMcpLifecycleSummaries(
  entries: DesktopPetMcpHistoryEntryLike[],
  sessions: DesktopPetMcpSessionStatusLike[] = [],
): SettingsMcpLifecycleServerSummary[] {
  const entriesByServerId = new Map<string, DesktopPetMcpHistoryEntryLike[]>();
  const sessionsByServerId = new Map<string, DesktopPetMcpSessionStatusLike>();

  entries.filter(isMcpLifecycleEntry).forEach((entry) => {
    const serverId = entry.serverId?.trim() || 'unknown-server';
    entriesByServerId.set(serverId, [...(entriesByServerId.get(serverId) ?? []), entry]);
  });

  sessions.forEach((session) => {
    const serverId = session.serverId?.trim() || 'unknown-server';
    sessionsByServerId.set(serverId, session);
  });

  return [...new Set([...entriesByServerId.keys(), ...sessionsByServerId.keys()])]
    .map((serverId) => createSummary(
      serverId,
      entriesByServerId.get(serverId) ?? [],
      sessionsByServerId.get(serverId),
    ))
    .sort((a, b) => Math.max(b.lastEventAt, b.liveActivityAt) - Math.max(a.lastEventAt, a.liveActivityAt));
}
