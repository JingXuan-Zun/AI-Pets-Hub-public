import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RotateCcw } from 'lucide-react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import {
  createSettingsMcpLifecycleSummaries,
  type SettingsMcpLifecycleServerSummary,
  type SettingsMcpLifecycleSeverity,
} from './settingsMcpLifecycleSummary';
import { SettingsMcpLifecycleActions } from './SettingsMcpLifecycleActions';

interface SettingsMcpLifecycleSummaryPanelProps {
  disabled?: boolean;
  entries: DesktopPetMcpHistoryEntryLike[];
  onEditServer?: (serverId: string) => void;
  onFeedback?: (message: string) => void;
  onRefreshHistory?: () => Promise<void>;
  onRunDiagnostic?: (serverId: string) => Promise<void> | void;
}

function getLifecycleIcon(severity: SettingsMcpLifecycleSeverity) {
  if (severity === 'recovered') {
    return CheckCircle2;
  }

  if (severity === 'blocked') {
    return AlertTriangle;
  }

  if (severity === 'cooldown') {
    return RotateCcw;
  }

  return Clock3;
}

function getLifecycleClassName(severity: SettingsMcpLifecycleSeverity) {
  if (severity === 'blocked') {
    return 'text-destructive';
  }

  if (severity === 'cooldown') {
    return 'text-amber-600';
  }

  if (severity === 'recovered') {
    return 'text-primary';
  }

  return 'text-muted-foreground';
}

function formatShortTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRetry(summary: SettingsMcpLifecycleServerSummary) {
  if (!summary.nextRetryAt || summary.severity === 'recovered') {
    return '';
  }

  const waitMs = Math.max(0, summary.nextRetryAt - Date.now());
  return waitMs > 0
    ? `next retry in ${Math.ceil(waitMs / 1000)}s`
    : 'retry window open';
}

function formatCounts(summary: SettingsMcpLifecycleServerSummary) {
  return [
    `${summary.cooldownCount} cooldown`,
    `${summary.blockedCount} blocked`,
    `${summary.recoveredCount} recovered`,
  ].join(' / ');
}

function formatLiveState(summary: SettingsMcpLifecycleServerSummary) {
  if (!summary.hasLiveSession) {
    return 'no live pooled session';
  }

  const state = summary.liveClosed ? 'live closed' : 'live active';
  const pending = summary.livePendingCount != null ? `pending ${summary.livePendingCount}` : '';
  const restart = summary.liveRestartStatus ? `restart ${summary.liveRestartStatus}` : '';
  return [state, pending, restart].filter(Boolean).join(' / ');
}

function formatLiveClose(summary: SettingsMcpLifecycleServerSummary) {
  if (!summary.liveCloseKind && !summary.liveCloseReason) {
    return '';
  }

  if (summary.liveCloseKind && summary.liveCloseReason && summary.liveCloseKind !== summary.liveCloseReason) {
    return `live close ${summary.liveCloseKind}: ${summary.liveCloseReason}`;
  }

  return `live close ${summary.liveCloseKind || summary.liveCloseReason}`;
}

function SettingsMcpLifecycleSummaryItem({
  disabled,
  onEditServer,
  onFeedback,
  onRefreshHistory,
  onRefreshSessions,
  onRunDiagnostic,
  summary,
}: {
  disabled: boolean;
  onEditServer?: (serverId: string) => void;
  onFeedback?: (message: string) => void;
  onRefreshHistory?: () => Promise<void>;
  onRefreshSessions: () => Promise<void>;
  onRunDiagnostic?: (serverId: string) => Promise<void> | void;
  summary: SettingsMcpLifecycleServerSummary;
}) {
  const Icon = getLifecycleIcon(summary.severity);
  const retryText = formatRetry(summary);
  const liveCloseText = formatLiveClose(summary);

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getLifecycleClassName(summary.severity)}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-2xs text-foreground">
            {summary.serverId}
          </div>
          <div className="truncate text-3xs text-muted-foreground">
            {summary.lastStatus} / {formatCounts(summary)}
          </div>
          <div className="truncate text-3xs text-muted-foreground">
            {formatLiveState(summary)}
          </div>
        </div>
        <div className="shrink-0 text-right text-3xs text-muted-foreground">
          <div>{summary.lastEventAt ? formatShortTime(summary.lastEventAt) : 'live only'}</div>
          {retryText ? <div>{retryText}</div> : null}
        </div>
      </div>
      {summary.lastCloseKind || summary.lastError ? (
        <div className="mt-1 truncate text-3xs text-muted-foreground">
          {summary.lastCloseKind ? `close ${summary.lastCloseKind}` : 'last event'}
          {summary.lastError ? ` / ${summary.lastError}` : ''}
        </div>
      ) : null}
      {liveCloseText ? (
        <div className="mt-1 truncate text-3xs text-muted-foreground">
          {liveCloseText}
        </div>
      ) : null}
      {summary.suggestedFixes.length ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
          {summary.suggestedFixes.map((suggestion) => (
            <span key={suggestion}>{suggestion}</span>
          ))}
        </div>
      ) : null}
      <SettingsMcpLifecycleActions
        disabled={disabled}
        serverId={summary.serverId}
        onEditServer={onEditServer}
        onFeedback={onFeedback}
        onRefreshHistory={onRefreshHistory}
        onRefreshSessions={onRefreshSessions}
        onRunDiagnostic={onRunDiagnostic}
      />
    </div>
  );
}

export function SettingsMcpLifecycleSummaryPanel({
  disabled = false,
  entries,
  onEditServer,
  onFeedback,
  onRefreshHistory,
  onRunDiagnostic,
}: SettingsMcpLifecycleSummaryPanelProps) {
  const [sessions, setSessions] = useState<DesktopPetMcpSessionStatusLike[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refreshSessions = async () => {
      try {
        const result = await desktopPetShellRuntime.getMcpSessionStatus();
        if (!cancelled) {
          setSessions(result.sessions ?? []);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      }
    };
    void refreshSessions();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const refreshSessions = async () => {
    const result = await desktopPetShellRuntime.getMcpSessionStatus();
    setSessions(result.sessions ?? []);
  };
  const summaries = createSettingsMcpLifecycleSummaries(entries, sessions);

  if (!summaries.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <RotateCcw className="h-3.5 w-3.5" />
        MCP lifecycle
      </div>
      {summaries.map((summary) => (
        <SettingsMcpLifecycleSummaryItem
          key={summary.serverId}
          disabled={disabled}
          summary={summary}
          onEditServer={onEditServer}
          onFeedback={onFeedback}
          onRefreshHistory={onRefreshHistory}
          onRefreshSessions={refreshSessions}
          onRunDiagnostic={onRunDiagnostic}
        />
      ))}
    </div>
  );
}
