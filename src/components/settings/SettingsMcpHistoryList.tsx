import { Activity, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';

interface SettingsMcpHistoryListProps {
  entries: DesktopPetMcpHistoryEntryLike[];
}

function getHistoryIcon(entry: DesktopPetMcpHistoryEntryLike) {
  if (entry.status === 'started') {
    return Clock3;
  }

  return entry.ok ? CheckCircle2 : AlertCircle;
}

function getHistoryIconClassName(entry: DesktopPetMcpHistoryEntryLike) {
  if (entry.status === 'started') {
    return 'text-muted-foreground';
  }

  return entry.ok ? 'text-primary' : 'text-destructive';
}

function formatHistoryTime(createdAt: number) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatHistoryTarget(entry: DesktopPetMcpHistoryEntryLike) {
  const serverId = entry.serverId || 'unknown-server';
  return entry.toolName ? `${serverId}/${entry.toolName}` : serverId;
}

function formatHistoryDetails(entry: DesktopPetMcpHistoryEntryLike) {
  const parts = [
    entry.durationMs != null ? `${entry.durationMs}ms` : '',
    entry.toolCount != null ? `${entry.toolCount} tools` : '',
    entry.closeKind ? `close ${entry.closeKind}` : '',
    entry.retryAfterMs != null ? `retry ${Math.ceil(entry.retryAfterMs / 1000)}s` : '',
    entry.requestId ? `request ${entry.requestId.slice(0, 18)}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function SettingsMcpHistoryList({ entries }: SettingsMcpHistoryListProps) {
  if (!entries.length) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        No MCP diagnostics or cancellation history yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        MCP history
      </div>
      {entries.map((entry) => {
        const Icon = getHistoryIcon(entry);
        const details = formatHistoryDetails(entry);

        return (
          <div
            key={entry.id}
            className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2"
          >
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getHistoryIconClassName(entry)}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-2xs text-foreground">
                  {formatHistoryTarget(entry)}
                </div>
                <div className="truncate text-3xs text-muted-foreground">
                  {entry.type} · {entry.status}{details ? ` · ${details}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-3xs text-muted-foreground">
                {formatHistoryTime(entry.createdAt)}
              </div>
            </div>
            {entry.error ? (
              <div className="mt-1 truncate text-3xs text-destructive">{entry.error}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
