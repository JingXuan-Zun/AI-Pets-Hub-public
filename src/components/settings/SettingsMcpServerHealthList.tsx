import { AlertCircle, CheckCircle2, Clock3, TriangleAlert } from 'lucide-react';
import {
  type SettingsMcpServerHealthStatus,
  type SettingsMcpServerHealthSummary,
} from './settingsMcpHealthSummary';

interface SettingsMcpServerHealthListProps {
  summaries: SettingsMcpServerHealthSummary[];
}

function getStatusIcon(status: SettingsMcpServerHealthStatus) {
  switch (status) {
    case 'ok':
      return CheckCircle2;
    case 'warning':
      return TriangleAlert;
    case 'error':
      return AlertCircle;
    default:
      return Clock3;
  }
}

function getStatusClassName(status: SettingsMcpServerHealthStatus) {
  if (status === 'error') {
    return 'text-destructive';
  }

  if (status === 'warning') {
    return 'text-amber-600';
  }

  return 'text-primary';
}

export function SettingsMcpServerHealthList({ summaries }: SettingsMcpServerHealthListProps) {
  if (!summaries.length) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
        No MCP servers configured.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summaries.map((summary) => {
        const Icon = getStatusIcon(summary.status);
        return (
          <div
            key={summary.server.id || summary.server.title}
            className="rounded-sm border border-dashed border-border bg-background/30 px-3 py-2"
          >
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${getStatusClassName(summary.status)}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-2xs text-foreground">
                  {summary.server.id || 'unnamed-server'}
                </div>
                <div className="truncate text-2xs text-muted-foreground">
                  {summary.commandHint}
                </div>
              </div>
              <div className="shrink-0 text-right text-3xs text-muted-foreground">
                <div>{summary.statusLabel}</div>
                <div>{summary.toolCount} tools</div>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-3xs text-muted-foreground">
              <span>last refresh: {summary.lastRefreshLabel}</span>
              {summary.diagnostics.map((item) => (
                <span key={item}>{item}</span>
              ))}
              {summary.error ? <span className="text-destructive">{summary.error}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
