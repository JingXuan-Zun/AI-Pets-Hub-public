import { History, RefreshCcw, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useSettingsMcpSessionPool } from './useSettingsMcpSessionPool';

interface SettingsMcpSessionPoolPanelProps {
  disabled: boolean;
  onFeedback: (message: string) => void;
  onShowHistory?: (serverId: string) => void;
}

function formatAge(timestamp?: number | null) {
  if (!timestamp) {
    return 'unknown';
  }

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
}

function formatIdleTimeout(timeoutMs?: number) {
  if (!timeoutMs) {
    return 'no idle eviction';
  }

  return timeoutMs < 60_000
    ? `${Math.round(timeoutMs / 1000)}s idle`
    : `${Math.round(timeoutMs / 60_000)}m idle`;
}

function formatCloseReason(session: DesktopPetMcpSessionStatusLike) {
  const kind = session.closeKind || session.lastCloseKind || '';
  const reason = session.closeReason || session.lastCloseReason || '';
  if (!kind && !reason) {
    return '';
  }

  return kind && reason && kind !== reason ? `${kind}: ${reason}` : kind || reason;
}

function formatRestartStatus(session: DesktopPetMcpSessionStatusLike) {
  const failures = session.restartConsecutiveFailures ?? 0;
  const waitMs = session.restartWaitMs ?? 0;
  if (!failures && session.restartStatus !== 'cooldown') {
    return '';
  }

  const waitLabel = waitMs > 0 ? ` / retry in ${Math.ceil(waitMs / 1000)}s` : '';
  return `restart ${session.restartStatus || 'unknown'} / ${failures} failure(s)${waitLabel}`;
}

function getResetCloseKind(result: Awaited<ReturnType<ReturnType<typeof useSettingsMcpSessionPool>['resetSession']>>) {
  return 'closeKind' in result ? result.closeKind : '';
}

export function SettingsMcpSessionPoolPanel({
  disabled,
  onFeedback,
  onShowHistory,
}: SettingsMcpSessionPoolPanelProps) {
  const { refreshSessions: refreshSessionPool, resetSession, sessions } = useSettingsMcpSessionPool();

  const refreshSessions = async () => {
    const result = await refreshSessionPool();
    onFeedback(`MCP sessions refreshed: ${(result.sessions ?? []).length} active.`);
  };

  const resetSessionPool = async (serverId?: string) => {
    const result = await resetSession(serverId);
    const closeKind = getResetCloseKind(result);
    const resetReason = closeKind ? ` (${closeKind})` : '';
    onFeedback(result.ok
      ? `MCP session reset: ${result.closedCount} closed${resetReason}.`
      : result.error || 'MCP session reset failed.');
    await refreshSessions();
  };

  return (
    <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-2xs font-medium text-foreground">MCP sessions</div>
          <div className="text-3xs text-muted-foreground">{sessions.length} pooled stdio sessions</div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} title="Refresh MCP sessions" onClick={() => void refreshSessions()}>
            <RefreshCcw />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" disabled={disabled || sessions.length === 0} title="Reset all MCP sessions" onClick={() => void resetSessionPool()}>
            <RotateCcw />
          </Button>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="text-3xs text-muted-foreground">No active pooled sessions.</div>
        ) : sessions.map((session) => {
          const closeReason = formatCloseReason(session);
          const restartStatus = formatRestartStatus(session);
          return (
            <div key={session.serverId} className="flex items-center justify-between gap-2 rounded-sm border border-border/70 bg-background/40 px-2 py-1">
              <div className="min-w-0">
                <div className="truncate font-mono text-3xs text-foreground">{session.serverId}</div>
                <div className="text-3xs text-muted-foreground">
                  {session.closed ? 'closed' : 'active'} / pending {session.pendingCount} / {formatAge(session.lastUsedAt)} / {formatIdleTimeout(session.idleTimeoutMs)}
                </div>
                {closeReason ? (
                  <div className="truncate text-3xs text-muted-foreground">
                    last close {closeReason} / {formatAge(session.lastClosedAt)}
                  </div>
                ) : null}
                {restartStatus ? (
                  <div className="truncate text-3xs text-muted-foreground">{restartStatus}</div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onShowHistory ? (
                  <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} title={`Show ${session.serverId} history`} onClick={() => onShowHistory(session.serverId)}>
                    <History />
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} title={`Reset ${session.serverId}`} onClick={() => void resetSessionPool(session.serverId)}>
                  <RotateCcw />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
